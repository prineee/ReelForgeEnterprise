-- Corrects consume_credits/release_credits/grant_credits (introduced in
-- 20260809140000_persistent_credit_ledger.sql moments earlier this same
-- session, no dependent application code yet) to return the
-- credit_transactions row they insert rather than the reservation row or a
-- bare integer.
--
-- Why: CreditManager.consume()/release()/grantCredits()/refund() have
-- always returned CreditTransactionRecord, and existing callers read
-- `.amount` off that return value expecting it to mean "amount just
-- consumed/released/granted" — e.g. WorkflowExecutor.settleReservationsOnSuccess()
-- computes `released = reservation.amount - record.amount` from
-- chargeUsage()'s result. A reservation row's `.amount` is the original
-- HELD amount, not the amount just settled, which would silently break
-- that calculation. Returning the transaction row (whose `.amount` is
-- exactly the amount that operation just moved) preserves the existing
-- contract.
--
-- Postgres requires DROP + CREATE (not CREATE OR REPLACE) to change a
-- function's return type.

drop function if exists public.consume_credits(uuid, integer, text);
drop function if exists public.release_credits(uuid, text);
drop function if exists public.grant_credits(uuid, integer, text, text, text);

create or replace function public.consume_credits(
  p_reservation_id uuid,
  p_amount integer,
  p_reason text
) returns public.credit_transactions
language plpgsql
as $$
declare
  v_reservation public.credit_reservations;
  v_unused integer;
  v_balance_after integer;
  v_txn public.credit_transactions;
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
    values (v_reservation.user_id, 'CONSUMPTION', p_amount, p_reason, v_reservation.production_id, p_reservation_id, v_reservation.category, v_balance_after)
    returning * into v_txn;

  if v_unused > 0 then
    insert into public.credit_transactions (user_id, type, amount, description, production_id, reservation_id, category, balance_after)
      values (v_reservation.user_id, 'RESERVATION_RELEASE', v_unused, 'Unused portion of reservation released after partial consumption', v_reservation.production_id, p_reservation_id, v_reservation.category, v_balance_after);
  end if;

  return v_txn;
end;
$$;

create or replace function public.release_credits(
  p_reservation_id uuid,
  p_reason text
) returns public.credit_transactions
language plpgsql
as $$
declare
  v_reservation public.credit_reservations;
  v_balance_after integer;
  v_txn public.credit_transactions;
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
    values (v_reservation.user_id, 'RESERVATION_RELEASE', v_reservation.amount, p_reason, v_reservation.production_id, p_reservation_id, v_reservation.category, v_balance_after)
    returning * into v_txn;

  return v_txn;
end;
$$;

create or replace function public.grant_credits(
  p_user_id uuid,
  p_amount integer,
  p_type text,
  p_production_id text,
  p_reason text
) returns public.credit_transactions
language plpgsql
as $$
declare
  v_new_balance integer;
  v_txn public.credit_transactions;
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
    values (p_user_id, p_type, p_amount, p_reason, p_production_id, v_new_balance)
    returning * into v_txn;

  return v_txn;
end;
$$;

revoke all on function public.consume_credits(uuid, integer, text) from public, anon, authenticated;
revoke all on function public.release_credits(uuid, text) from public, anon, authenticated;
revoke all on function public.grant_credits(uuid, integer, text, text, text) from public, anon, authenticated;

grant execute on function public.consume_credits(uuid, integer, text) to service_role;
grant execute on function public.release_credits(uuid, text) to service_role;
grant execute on function public.grant_credits(uuid, integer, text, text, text) to service_role;
