-- Newsletter v2: double opt-in, unsubscribe tokens, campaigns
-- ================================================================
-- Builds on 20260412_newsletter_subs.sql by:
--   1. Replacing the single `active` flag with a status enum that
--      distinguishes pending → confirmed → unsubscribed → bounced.
--      The original flag stays NOT NULL for back-compat but the new
--      pipeline reads/writes status.
--   2. Adding per-subscriber tokens (confirm + unsubscribe) so the
--      email links can prove ownership without a session — required
--      for CAN-SPAM / GDPR compliant flows.
--   3. Tracking timestamps for confirmed_at / unsubscribed_at so the
--      admin can see recent churn and re-confirm bounced addresses.
--   4. New `newsletter_campaigns` table — admin drafts + sends here,
--      and the edge function copies + interpolates content per row.
--   5. New `newsletter_sends` log so we know who got what and can
--      suppress duplicates if a send retries.
--
-- Token strategy: random 32-byte URL-safe strings in a TEXT column.
-- We don't index them publicly (UNIQUE only); the edge function
-- handles confirm/unsubscribe lookups via service role.

-- ── 1) Extend newsletter_subs ────────────────────────────────────
ALTER TABLE public.newsletter_subs
  ADD COLUMN IF NOT EXISTS status            text
    NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','confirmed','unsubscribed','bounced')),
  ADD COLUMN IF NOT EXISTS confirm_token     text,
  ADD COLUMN IF NOT EXISTS unsubscribe_token text,
  ADD COLUMN IF NOT EXISTS confirmed_at      timestamptz,
  ADD COLUMN IF NOT EXISTS unsubscribed_at   timestamptz,
  ADD COLUMN IF NOT EXISTS last_sent_at      timestamptz,
  ADD COLUMN IF NOT EXISTS source            text DEFAULT 'footer';

-- Backfill existing rows: anyone already in the table is grandfathered
-- as confirmed (they signed up before we had the flow). New rows ride
-- the default 'pending' until the user clicks the confirm link.
UPDATE public.newsletter_subs
   SET status = 'confirmed',
       confirmed_at = COALESCE(confirmed_at, subscribed_at)
 WHERE status = 'pending' AND active = true;

CREATE UNIQUE INDEX IF NOT EXISTS newsletter_confirm_token_idx
  ON public.newsletter_subs (confirm_token) WHERE confirm_token IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS newsletter_unsubscribe_token_idx
  ON public.newsletter_subs (unsubscribe_token) WHERE unsubscribe_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS newsletter_status_idx
  ON public.newsletter_subs (status, subscribed_at DESC);

-- The old "Anyone can subscribe" policy let any client INSERT
-- arbitrary rows. The v2 flow goes through an SECURITY DEFINER RPC
-- so we can attach the confirmation token + dispatch the email
-- without trusting the client. Drop the loose policy.
DROP POLICY IF EXISTS "Anyone can subscribe" ON public.newsletter_subs;

-- ── 2) Campaigns (admin drafts, then sent) ───────────────────────
CREATE TABLE IF NOT EXISTS public.newsletter_campaigns (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject         text NOT NULL,
  preheader       text,
  body_html       text NOT NULL,
  body_text       text,
  from_name       text NOT NULL DEFAULT 'KoreHani',
  from_email      text NOT NULL DEFAULT 'hello@korehani.com',
  status          text NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','sending','sent','failed')),
  scheduled_at    timestamptz,
  sent_at         timestamptz,
  recipient_count int DEFAULT 0,
  created_by      uuid REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS newsletter_campaigns_status_idx
  ON public.newsletter_campaigns (status, created_at DESC);

ALTER TABLE public.newsletter_campaigns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS nc_service_full ON public.newsletter_campaigns;
CREATE POLICY nc_service_full ON public.newsletter_campaigns
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- ── 3) Send log — one row per (campaign, subscriber) ─────────────
CREATE TABLE IF NOT EXISTS public.newsletter_sends (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id  uuid NOT NULL REFERENCES public.newsletter_campaigns(id) ON DELETE CASCADE,
  sub_id       uuid NOT NULL REFERENCES public.newsletter_subs(id) ON DELETE CASCADE,
  email        text NOT NULL,
  status       text NOT NULL DEFAULT 'queued'
                  CHECK (status IN ('queued','sent','failed','bounced')),
  provider_id  text,        -- Resend message id when available
  error        text,
  sent_at      timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, sub_id)
);

CREATE INDEX IF NOT EXISTS newsletter_sends_campaign_idx
  ON public.newsletter_sends (campaign_id, status);

ALTER TABLE public.newsletter_sends ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ns_service_full ON public.newsletter_sends;
CREATE POLICY ns_service_full ON public.newsletter_sends
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- ── 4) Subscribe RPC (replaces the open INSERT policy) ───────────
-- Inserts or refreshes a pending row, generates a confirm token,
-- returns it so the edge function can email the link.
CREATE OR REPLACE FUNCTION public.newsletter_request_subscribe(
  p_email text,
  p_name  text DEFAULT NULL,
  p_source text DEFAULT 'footer'
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_token text := encode(gen_random_bytes(24), 'base64');
  v_unsub text := encode(gen_random_bytes(24), 'base64');
  v_existing public.newsletter_subs%ROWTYPE;
  v_id uuid;
BEGIN
  IF v_email IS NULL OR position('@' in v_email) = 0 OR length(v_email) > 254 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_email');
  END IF;
  -- URL-safe tokens (replace + and / and trim padding so they sit in
  -- a query string without escaping).
  v_token := translate(rtrim(v_token, '='), '+/', '-_');
  v_unsub := translate(rtrim(v_unsub, '='), '+/', '-_');

  SELECT * INTO v_existing FROM public.newsletter_subs WHERE email = v_email;
  IF FOUND THEN
    IF v_existing.status = 'confirmed' THEN
      RETURN jsonb_build_object('ok', true, 'status', 'already_confirmed');
    END IF;
    -- Re-issue tokens on every request so an old link can't be
    -- replayed after a re-subscribe.
    UPDATE public.newsletter_subs
       SET name             = COALESCE(p_name, name),
           confirm_token    = v_token,
           unsubscribe_token = v_unsub,
           status           = 'pending',
           unsubscribed_at  = NULL,
           source           = COALESCE(p_source, source),
           subscribed_at    = now()
     WHERE id = v_existing.id;
    RETURN jsonb_build_object('ok', true, 'status', 'resent', 'confirm_token', v_token);
  END IF;

  INSERT INTO public.newsletter_subs (email, name, status, confirm_token, unsubscribe_token, source)
    VALUES (v_email, p_name, 'pending', v_token, v_unsub, p_source)
    RETURNING id INTO v_id;
  RETURN jsonb_build_object('ok', true, 'status', 'sent', 'id', v_id, 'confirm_token', v_token);
END;
$$;
GRANT EXECUTE ON FUNCTION public.newsletter_request_subscribe(text, text, text) TO anon, authenticated;

-- ── 5) Confirm RPC — flips pending → confirmed by token ──────────
CREATE OR REPLACE FUNCTION public.newsletter_confirm(p_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row public.newsletter_subs%ROWTYPE;
BEGIN
  IF p_token IS NULL OR length(p_token) < 8 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_token');
  END IF;
  SELECT * INTO v_row FROM public.newsletter_subs WHERE confirm_token = p_token LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'token_not_found');
  END IF;
  UPDATE public.newsletter_subs
     SET status = 'confirmed',
         active = true,
         confirmed_at = COALESCE(confirmed_at, now()),
         confirm_token = NULL
   WHERE id = v_row.id;
  RETURN jsonb_build_object('ok', true, 'email', v_row.email);
END;
$$;
GRANT EXECUTE ON FUNCTION public.newsletter_confirm(text) TO anon, authenticated;

-- ── 6) Unsubscribe RPC — token-only, no session needed ───────────
CREATE OR REPLACE FUNCTION public.newsletter_unsubscribe(p_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row public.newsletter_subs%ROWTYPE;
BEGIN
  IF p_token IS NULL OR length(p_token) < 8 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_token');
  END IF;
  SELECT * INTO v_row FROM public.newsletter_subs WHERE unsubscribe_token = p_token LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'token_not_found');
  END IF;
  UPDATE public.newsletter_subs
     SET status = 'unsubscribed',
         active = false,
         unsubscribed_at = now()
   WHERE id = v_row.id;
  RETURN jsonb_build_object('ok', true, 'email', v_row.email);
END;
$$;
GRANT EXECUTE ON FUNCTION public.newsletter_unsubscribe(text) TO anon, authenticated;
