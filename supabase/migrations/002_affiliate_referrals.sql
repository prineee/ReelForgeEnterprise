-- ============================================================
-- Migration 002: Affiliate referral system + 30% commission
-- Run in Supabase SQL Editor after 001 (schema.sql)
-- ============================================================

-- 1. Add referred_by to users (stores the referral_code that brought them here)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS referred_by TEXT;

CREATE INDEX IF NOT EXISTS idx_users_referred_by ON public.users(referred_by);

-- 2. Set commission default to 30%
ALTER TABLE public.affiliates
  ALTER COLUMN commission SET DEFAULT 30.00;

-- Update existing affiliates to 30% commission
UPDATE public.affiliates SET commission = 30.00 WHERE commission = 20.00;

-- ============================================================
-- Helper: generate a random 8-char alphanumeric referral code
-- (no O, 0, I, 1 to avoid confusion)
-- ============================================================
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  chars  TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code   TEXT := '';
  i      INT;
BEGIN
  FOR i IN 1..8 LOOP
    code := code || substr(chars, floor(random() * length(chars) + 1)::INT, 1);
  END LOOP;
  RETURN code;
END;
$$;

-- ============================================================
-- Trigger: auto-create affiliate record when a user row is inserted
-- (fires after handle_new_user creates the public.users row)
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_affiliate_for_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_code TEXT;
  v_attempts INT := 0;
BEGIN
  -- Retry until a unique code is found
  LOOP
    v_code := public.generate_referral_code();
    v_attempts := v_attempts + 1;
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.affiliates WHERE referral_code = v_code
    ) OR v_attempts > 50;
  END LOOP;

  INSERT INTO public.affiliates (user_id, referral_code, commission, earnings)
  VALUES (NEW.id, v_code, 30.00, 0.00)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_user_created_create_affiliate ON public.users;

CREATE TRIGGER on_user_created_create_affiliate
  AFTER INSERT ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.create_affiliate_for_user();

-- Backfill: create affiliate records for existing users who don't have one
INSERT INTO public.affiliates (user_id, referral_code, commission, earnings)
SELECT
  u.id,
  (
    SELECT code FROM (
      SELECT public.generate_referral_code() AS code
      FROM generate_series(1, 1)
    ) sub
    WHERE NOT EXISTS (SELECT 1 FROM public.affiliates a WHERE a.referral_code = sub.code)
    LIMIT 1
  ),
  30.00,
  0.00
FROM public.users u
WHERE NOT EXISTS (SELECT 1 FROM public.affiliates a WHERE a.user_id = u.id);

-- ============================================================
-- RPC: atomically credit commission to an affiliate when a
-- referred user makes a payment
-- Usage: SELECT credit_affiliate_commission('<user_id>', 18.00)
-- ============================================================
CREATE OR REPLACE FUNCTION public.credit_affiliate_commission(
  p_user_id       UUID,
  p_payment_amount DECIMAL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_referral_code  TEXT;
  v_commission_pct DECIMAL;
BEGIN
  -- Look up who referred this user
  SELECT referred_by INTO v_referral_code
  FROM public.users
  WHERE id = p_user_id AND referred_by IS NOT NULL;

  IF v_referral_code IS NULL THEN RETURN; END IF;

  -- Look up that affiliate's commission rate
  SELECT commission INTO v_commission_pct
  FROM public.affiliates
  WHERE referral_code = v_referral_code;

  IF v_commission_pct IS NULL THEN RETURN; END IF;

  -- Atomically add earnings
  UPDATE public.affiliates
  SET earnings = earnings + ROUND(p_payment_amount * v_commission_pct / 100, 2)
  WHERE referral_code = v_referral_code;
END;
$$;
