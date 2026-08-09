-- credit_transactions.type already carried a CHECK constraint restricting
-- it to a coarse, lowercase set: purchase/usage/refund/admin_grant (from
-- whatever earlier, unwired feature created this table — see this
-- migration's sibling 20260809140000_persistent_credit_ledger.sql for
-- confirmation the table had exactly one pre-existing row using
-- 'admin_grant'). CreditManager's actual lifecycle
-- (services/billing/BillingTypes.ts's TransactionType enum) is more
-- granular — PURCHASE/RESERVATION/CONSUMPTION/REFUND/RESERVATION_RELEASE/
-- ADJUSTMENT — and losing the RESERVATION vs RESERVATION_RELEASE
-- distinction to fit the old 4-value scheme isn't reasonable. This widens
-- the constraint additively (old values still valid, so the existing
-- 'admin_grant' row is untouched) rather than replacing it.

alter table public.credit_transactions drop constraint if exists credit_transactions_type_check;

alter table public.credit_transactions add constraint credit_transactions_type_check
  check (type = any (array[
    'purchase', 'usage', 'refund', 'admin_grant',
    'PURCHASE', 'RESERVATION', 'CONSUMPTION', 'REFUND', 'RESERVATION_RELEASE', 'ADJUSTMENT'
  ]));
