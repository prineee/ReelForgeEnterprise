-- Persistent backing store for services/billing/* (CreditManager/BillingEngine),
-- replacing InMemoryCreditLedger (services/billing/CreditTransaction.ts).
--
-- InMemoryCreditLedger is a plain in-process Map: on Vercel, every
-- serverless instance has its own copy, disconnected from the real
-- authoritative balance the dashboard/Razorpay purchases/lib/credits.ts's
-- requireCredits() already use (public.users.credits). In production,
-- DEV_SEED_CREDITS is forced to 0, so ReserveCredits sees a real 0 for any
-- user this particular process instance hasn't seen — regardless of their
-- actual users.credits balance — surfacing as InsufficientCreditsError even
-- when the user has plenty of real credits.
--
-- public.users.credits remains the ONE authoritative balance (unchanged,
-- reused — same column the dashboard, Razorpay purchase flow, and
-- lib/credits.ts's requireCredits() already read/write). This migration
-- adds:
--   - credit_reservations: the open/settled HELD->CONSUMED|RELEASED
--     lifecycle for Movie Studio's reserve-then-consume-or-release flow.
--     Not a second balance — users.credits is decremented at reserve time
--     and this table only tracks the in-flight hold so it can later be
--     consumed (finalized) or released (returned), matching
--     CreditManager.ts's existing reserve()/consume()/release() semantics.
--   - four columns added to the pre-existing (unused — 1 legacy row,
--     no application code references it) credit_transactions table, so it
--     can record the same detail CreditTransactionRecord already carries
--     (production_id/reservation_id/category/balance_after) instead of
--     only (type, amount, description).
--
-- All balance-mutating operations are atomic Postgres functions (reserve/
-- consume/release/grant), not read-balance-then-write-balance from
-- application code — two concurrent reserve_credits() calls for the same
-- user cannot both succeed against the same balance, because the second
-- serializes behind the first on `select ... for update` against the
-- user's own row. Idempotency for reserve_credits() is enforced by a
-- unique (production_id, category) constraint, keyed off the same
-- WorkflowContext.id already used as productionId throughout — a retried
-- ReserveCredits for the same workflow returns the original reservation
-- instead of reserving a second time.
--
-- Only ever called via the service-role client (lib/supabase/admin.ts) —
-- EXECUTE is revoked from anon/authenticated below so this can never be
-- invoked from the browser even if someone tried supabase.rpc() with the
-- publishable key.

-- ── credit_reservations ──────────────────────────────────────────────────

create table if not exists public.credit_reservations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  production_id text not null,
  category text,
  amount integer not null check (amount > 0),
  status text not null default 'HELD' check (status in ('HELD', 'CONSUMED', 'RELEASED')),
  label text,
  provider_id text,
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (production_id, category)
);

create index if not exists credit_reservations_user_id_idx on public.credit_reservations (user_id);
create index if not exists credit_reservations_status_idx on public.credit_reservations (status);

alter table public.credit_reservations enable row level security;

-- ── credit_transactions: additive columns onto the existing table ────────

alter table public.credit_transactions
  add column if not exists production_id text,
  add column if not exists reservation_id uuid references public.credit_reservations(id),
  add column if not exists category text,
  add column if not exists balance_after integer;

create index if not exists credit_transactions_user_id_idx on public.credit_transactions (user_id);
create index if not exists credit_transactions_production_id_idx on public.credit_transactions (production_id);

alter table public.credit_transactions enable row level security;

-- ── Atomic operations ─────────────────────────────────────────────────────

-- Reserves p_amount for p_user_id against public.users.credits iff the
-- available balance covers it, recording the hold in credit_reservations
-- and an audit entry in credit_transactions — all inside one transaction.
-- Raises 'INSUFFICIENT_CREDITS:<userId>:<available>:<requested>' (parsed
-- by SupabaseCreditLedger into the same InsufficientCreditsError message
-- CreditManager.ts already threw) when the balance is too low.
--
-- Idempotent per (production_id, category): if a reservation for that
-- exact pair already exists, the unique_violation below rolls back this
-- entire invocation (including the credits deduction above it — a PL/pgSQL
-- exception block rolls back everything since the start of the function)
-- and returns the pre-existing reservation instead of reserving again.
create or replace function public.reserve_credits(
  p_user_id uuid,
  p_production_id text,
  p_category text,
  p_amount integer,
  p_label text,
  p_provider_id text,
  p_reason text
) returns public.credit_reservations
language plpgsql
as $$
declare
  v_current_credits integer;
  v_result public.credit_reservations;
begin
  if p_amount <= 0 then
    raise exception 'reserve_credits: amount must be positive' using errcode = '22023';
  end if;

  select credits into v_current_credits from public.users where id = p_user_id for update;
  if not found then
    raise exception 'reserve_credits: user % not found', p_user_id using errcode = 'P0002';
  end if;

  if v_current_credits < p_amount then
    raise exception 'INSUFFICIENT_CREDITS:%:%:%', p_user_id, v_current_credits, p_amount;
  end if;

  update public.users set credits = credits - p_amount where id = p_user_id;

  insert into public.credit_reservations
    (user_id, production_id, category, amount, status, label, provider_id, reason)
    values (p_user_id, p_production_id, p_category, p_amount, 'HELD', p_label, p_provider_id, p_reason)
    returning * into v_result;

  insert into public.credit_transactions (user_id, type, amount, description, production_id, reservation_id, category, balance_after)
    values (p_user_id, 'RESERVATION', p_amount, p_reason, p_production_id, v_result.id, p_category, v_current_credits - p_amount);

  return v_result;
exception
  when unique_violation then
    select * into v_result from public.credit_reservations
      where production_id = p_production_id and category is not distinct from p_category;
    return v_result;
end;
$$;

-- Finalizes p_amount (<= the held amount) from a HELD reservation. Any
-- unused remainder is returned to public.users.credits in the same
-- transaction (mirrors CreditManager.consume()'s existing "unused portion
-- released" behavior). Raises if the reservation is missing, not HELD, or
-- p_amount is out of range — atomic via `for update` on the reservation row.
create or replace function public.consume_credits(
  p_reservation_id uuid,
  p_amount integer,
  p_reason text
) returns public.credit_reservations
language plpgsql
as $$
declare
  v_reservation public.credit_reservations;
  v_unused integer;
  v_balance_after integer;
begin
  select * into v_reservation from public.credit_reservations where id = p_reservation_id for update;
  if not found then
    raise exception 'consume_credits: reservation % not found', p_reservation_id using errcode = 'P0002';
  end if;
  if v_reservation.status <> 'HELD' then
    raise exception 'consume_credits: reservation % is already %', p_reservation_id, v_reservation.status using errcode = 'P0001';
  end if;
  if p_amount <= 0 or p_amount > v_reservation.amount then
    raise exception 'consume_credits: invalid amount % for reservation % (held %)', p_amount, p_reservation_id, v_reservation.amount using errcode = '22023';
  end if;

  v_unused := v_reservation.amount - p_amount;

  update public.credit_reservations set status = 'CONSUMED', updated_at = now() where id = p_reservation_id;

  if v_unused > 0 then
    update public.users set credits = credits + v_unused where id = v_reservation.user_id;
  end if;

  select credits into v_balance_after from public.users where id = v_reservation.user_id;

  insert into public.credit_transactions (user_id, type, amount, description, production_id, reservation_id, category, balance_after)
    values (v_reservation.user_id, 'CONSUMPTION', p_amount, p_reason, v_reservation.production_id, p_reservation_id, v_reservation.category, v_balance_after);

  if v_unused > 0 then
    insert into public.credit_transactions (user_id, type, amount, description, production_id, reservation_id, category, balance_after)
      values (v_reservation.user_id, 'RESERVATION_RELEASE', v_unused, 'Unused portion of reservation released after partial consumption', v_reservation.production_id, p_reservation_id, v_reservation.category, v_balance_after);
  end if;

  select * into v_reservation from public.credit_reservations where id = p_reservation_id;
  return v_reservation;
end;
$$;

-- Returns an entire unused HELD reservation to public.users.credits, marks
-- it RELEASED. Raises if the reservation is missing or not HELD (already
-- consumed/released elsewhere) — matches CreditManager.release()'s
-- existing requireHeldReservation() check, now enforced atomically via
-- `for update` instead of an in-memory Map lookup.
create or replace function public.release_credits(
  p_reservation_id uuid,
  p_reason text
) returns public.credit_reservations
language plpgsql
as $$
declare
  v_reservation public.credit_reservations;
  v_balance_after integer;
begin
  select * into v_reservation from public.credit_reservations where id = p_reservation_id for update;
  if not found then
    raise exception 'release_credits: reservation % not found', p_reservation_id using errcode = 'P0002';
  end if;
  if v_reservation.status <> 'HELD' then
    raise exception 'release_credits: reservation % is already %', p_reservation_id, v_reservation.status using errcode = 'P0001';
  end if;

  update public.credit_reservations set status = 'RELEASED', updated_at = now() where id = p_reservation_id;
  update public.users set credits = credits + v_reservation.amount where id = v_reservation.user_id;

  select credits into v_balance_after from public.users where id = v_reservation.user_id;

  insert into public.credit_transactions (user_id, type, amount, description, production_id, reservation_id, category, balance_after)
    values (v_reservation.user_id, 'RESERVATION_RELEASE', v_reservation.amount, p_reason, v_reservation.production_id, p_reservation_id, v_reservation.category, v_balance_after);

  select * into v_reservation from public.credit_reservations where id = p_reservation_id;
  return v_reservation;
end;
$$;

-- Adds credits outright (PURCHASE/REFUND/ADJUSTMENT — CreditManager's
-- grantCredits()/refund()) with no availability check. Atomic via a single
-- UPDATE ... RETURNING (no separate read-then-write).
create or replace function public.grant_credits(
  p_user_id uuid,
  p_amount integer,
  p_type text,
  p_production_id text,
  p_reason text
) returns integer
language plpgsql
as $$
declare
  v_new_balance integer;
begin
  if p_amount <= 0 then
    raise exception 'grant_credits: amount must be positive' using errcode = '22023';
  end if;

  update public.users set credits = credits + p_amount where id = p_user_id
    returning credits into v_new_balance;
  if not found then
    raise exception 'grant_credits: user % not found', p_user_id using errcode = 'P0002';
  end if;

  insert into public.credit_transactions (user_id, type, amount, description, production_id, balance_after)
    values (p_user_id, p_type, p_amount, p_reason, p_production_id, v_new_balance);

  return v_new_balance;
end;
$$;

-- ── Security: service-role only ───────────────────────────────────────────

revoke all on function public.reserve_credits(uuid, text, text, integer, text, text, text) from public, anon, authenticated;
revoke all on function public.consume_credits(uuid, integer, text) from public, anon, authenticated;
revoke all on function public.release_credits(uuid, text) from public, anon, authenticated;
revoke all on function public.grant_credits(uuid, integer, text, text, text) from public, anon, authenticated;

grant execute on function public.reserve_credits(uuid, text, text, integer, text, text, text) to service_role;
grant execute on function public.consume_credits(uuid, integer, text) to service_role;
grant execute on function public.release_credits(uuid, text) to service_role;
grant execute on function public.grant_credits(uuid, integer, text, text, text) to service_role;
