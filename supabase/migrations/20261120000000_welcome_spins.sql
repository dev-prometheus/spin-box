BEGIN;

CREATE TABLE public.welcome_spins (
  visit_id uuid NOT NULL,
  attempt integer NOT NULL CHECK (attempt > 0),
  outcome text NOT NULL CHECK (outcome IN ('WIN', 'LOSE', 'RETRY')),
  PRIMARY KEY (visit_id, attempt)
);
CREATE TABLE public.welcome_claims (
  visit_id uuid PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE
);
ALTER TABLE public.welcome_spins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.welcome_claims ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.welcome_spins, public.welcome_claims FROM PUBLIC, anon, authenticated;

-- Preserve existing balances and treat pre-campaign accounts as already eligible for the old grant.
ALTER TABLE public.users ADD COLUMN welcome_reward_eligible boolean NOT NULL DEFAULT false;
ALTER TABLE public.users ALTER COLUMN welcome_reward_eligible SET DEFAULT true;

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  referrer uuid;
  raw_ref text := NEW.raw_user_meta_data->>'referrer_id';
BEGIN
  IF raw_ref ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    SELECT id INTO referrer FROM public.users WHERE id = raw_ref::uuid;
  END IF;
  INSERT INTO public.users (id, email, account_credits, referral_balance, referrer_id)
  VALUES (NEW.id, NEW.email, 0, 0, referrer)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.record_welcome_spin(p_visit uuid, p_attempt integer, p_outcome text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  previous public.welcome_spins;
  recorded text;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_visit::text, 0));
  SELECT outcome INTO recorded FROM public.welcome_spins
  WHERE visit_id = p_visit AND attempt = p_attempt;
  IF FOUND THEN RETURN recorded; END IF;

  SELECT * INTO previous FROM public.welcome_spins
  WHERE visit_id = p_visit ORDER BY attempt DESC LIMIT 1;
  IF previous.outcome IN ('WIN', 'LOSE') THEN RETURN previous.outcome; END IF;
  IF p_attempt IS DISTINCT FROM coalesce(previous.attempt, 0) + 1 THEN
    RAISE EXCEPTION 'Invalid welcome attempt';
  END IF;
  INSERT INTO public.welcome_spins VALUES (p_visit, p_attempt, p_outcome);
  RETURN p_outcome;
END;
$$;

CREATE FUNCTION public.claim_welcome_spin(p_visit uuid, p_user uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  eligible boolean;
BEGIN
  SELECT welcome_reward_eligible INTO eligible FROM public.users WHERE id = p_user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Profile missing'; END IF;
  IF EXISTS (SELECT 1 FROM public.welcome_claims WHERE visit_id = p_visit AND user_id = p_user) THEN
    RETURN 'CLAIMED';
  END IF;
  IF eligible IS NOT TRUE THEN RETURN 'INELIGIBLE'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.welcome_spins WHERE visit_id = p_visit AND outcome = 'WIN') THEN
    RETURN 'INVALID';
  END IF;
  INSERT INTO public.welcome_claims VALUES (p_visit, p_user) ON CONFLICT DO NOTHING;
  IF NOT FOUND THEN RETURN 'USED'; END IF;
  UPDATE public.users SET account_credits = coalesce(account_credits, 0) + 1,
    welcome_reward_eligible = false, updated_at = now() WHERE id = p_user;
  RETURN 'CLAIMED';
END;
$$;

REVOKE ALL ON FUNCTION public.record_welcome_spin(uuid, integer, text), public.claim_welcome_spin(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_welcome_spin(uuid, integer, text), public.claim_welcome_spin(uuid, uuid) TO service_role;
COMMIT;
