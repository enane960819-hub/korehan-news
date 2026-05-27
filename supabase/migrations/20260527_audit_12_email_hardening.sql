-- ═════════════════════════════════════════════════════════════════════
-- Audit 12 (Email deliverability) — token expiry + consent audit + UX
-- ═════════════════════════════════════════════════════════════════════
-- Closes:
--   EMAIL-F4   Confirmation tokens never expire — set a 48h TTL
--   EMAIL-F5   No marketing-consent audit fields (IP/UA/version)
--   EMAIL-F12  unsubscribe RPC conflates "expired" with "already unsub'd"
--
-- Companion changes:
--   - newsletter-send Edge Function (PR same batch) now reads locale
--     to pick KR/EN confirm template — no schema change there, the
--     locale column already exists from 20260506_newsletter_v2.sql.
--
-- OWNER MUST APPLY this migration. Idempotent — safe to re-run.

-- ─── EMAIL-F4: confirm-token expiry ─────────────────────────────────
ALTER TABLE public.newsletter_subs
  ADD COLUMN IF NOT EXISTS confirm_token_expires_at timestamptz;

-- Backfill: any pending row gets 48h from now. Future inserts set
-- this at insert time via the RPC below.
UPDATE public.newsletter_subs
   SET confirm_token_expires_at = now() + interval '48 hours'
 WHERE confirm_token IS NOT NULL
   AND confirm_token_expires_at IS NULL;

-- ─── EMAIL-F5: consent audit fields ─────────────────────────────────
-- GDPR Art 7(1) and PIPA Art 22 both require demonstrable consent.
-- Capturing IP + UA + the privacy-policy version active at the
-- moment of consent is the standard pattern; covers operator
-- defense if a regulator asks "prove this user opted in".
ALTER TABLE public.newsletter_subs
  ADD COLUMN IF NOT EXISTS consent_ip            inet,
  ADD COLUMN IF NOT EXISTS consent_user_agent    text,
  ADD COLUMN IF NOT EXISTS consent_text_version  text;

COMMENT ON COLUMN public.newsletter_subs.consent_ip IS
  'EMAIL-F5: IP of the confirm request, for GDPR Art 7(1) / PIPA Art 22 demonstrable consent.';
COMMENT ON COLUMN public.newsletter_subs.consent_text_version IS
  'EMAIL-F5: privacy-policy version at consent time. Bump in migrations whenever the policy materially changes so old consents are tied to old policy.';

-- ─── Update newsletter_request_subscribe to capture consent ─────────
-- Note: there may already be an RPC by this name from
-- 20260506_newsletter_v2.sql. CREATE OR REPLACE preserves grants.
-- The existing signature is (p_email, p_name, p_source); we extend
-- with optional IP / UA / policy-version params. Older frontends
-- calling with the 3-arg shape still work (Postgres parameter
-- defaults).
CREATE OR REPLACE FUNCTION public.newsletter_request_subscribe(
  p_email          text,
  p_name           text DEFAULT NULL,
  p_source         text DEFAULT NULL,
  p_locale         text DEFAULT 'en',
  p_consent_ip     inet DEFAULT NULL,
  p_consent_ua     text DEFAULT NULL,
  p_consent_text_version text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_email text;
  v_status text;
  v_confirm_token text;
  v_unsub_token text;
  v_row public.newsletter_subs%ROWTYPE;
BEGIN
  v_email := btrim(lower(coalesce(p_email, '')));
  IF v_email = '' OR position('@' IN v_email) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_email');
  END IF;
  IF length(v_email) > 320 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_email');
  END IF;

  SELECT * INTO v_row FROM public.newsletter_subs WHERE email = v_email;
  IF FOUND THEN
    IF v_row.status = 'confirmed' THEN
      RETURN jsonb_build_object('ok', true, 'status', 'already_confirmed');
    ELSIF v_row.status = 'unsubscribed' THEN
      -- Resubscribe path: reset status + new token + capture consent.
      v_confirm_token := encode(gen_random_bytes(24), 'hex');
      UPDATE public.newsletter_subs
         SET status                   = 'pending',
             confirm_token            = v_confirm_token,
             confirm_token_expires_at = now() + interval '48 hours',
             name                     = COALESCE(NULLIF(btrim(p_name),''), v_row.name),
             source                   = COALESCE(NULLIF(btrim(p_source),''), v_row.source),
             locale                   = COALESCE(NULLIF(btrim(p_locale),''), v_row.locale, 'en'),
             consent_ip               = p_consent_ip,
             consent_user_agent       = p_consent_ua,
             consent_text_version     = p_consent_text_version,
             updated_at               = now()
       WHERE id = v_row.id;
      RETURN jsonb_build_object('ok', true, 'status', 'pending_resubscribe', 'token', v_confirm_token, 'email', v_email);
    ELSE
      -- Already pending: rotate token (the previous email link may
      -- be lost) and refresh expiry.
      v_confirm_token := encode(gen_random_bytes(24), 'hex');
      UPDATE public.newsletter_subs
         SET confirm_token            = v_confirm_token,
             confirm_token_expires_at = now() + interval '48 hours',
             name                     = COALESCE(NULLIF(btrim(p_name),''), v_row.name),
             locale                   = COALESCE(NULLIF(btrim(p_locale),''), v_row.locale, 'en'),
             consent_ip               = p_consent_ip,
             consent_user_agent       = p_consent_ua,
             consent_text_version     = p_consent_text_version,
             updated_at               = now()
       WHERE id = v_row.id;
      RETURN jsonb_build_object('ok', true, 'status', 'pending', 'token', v_confirm_token, 'email', v_email);
    END IF;
  END IF;

  v_confirm_token := encode(gen_random_bytes(24), 'hex');
  v_unsub_token   := encode(gen_random_bytes(24), 'hex');
  INSERT INTO public.newsletter_subs
    (email, name, source, locale, status, confirm_token, confirm_token_expires_at,
     unsubscribe_token, consent_ip, consent_user_agent, consent_text_version)
    VALUES
    (v_email,
     NULLIF(btrim(p_name), ''),
     NULLIF(btrim(p_source), ''),
     COALESCE(NULLIF(btrim(p_locale),''), 'en'),
     'pending',
     v_confirm_token,
     now() + interval '48 hours',
     v_unsub_token,
     p_consent_ip,
     p_consent_ua,
     p_consent_text_version);

  RETURN jsonb_build_object('ok', true, 'status', 'pending', 'token', v_confirm_token, 'email', v_email);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.newsletter_request_subscribe(text, text, text, text, inet, text, text) FROM public;
GRANT  EXECUTE ON FUNCTION public.newsletter_request_subscribe(text, text, text, text, inet, text, text) TO anon, authenticated;

-- ─── EMAIL-F4 + F12: token expiry + clearer unsubscribe semantics ───
-- newsletter_confirm checks expiry; newsletter_unsubscribe
-- distinguishes "already unsubscribed" from "bad token" so the
-- unsubscribe.html page can render a friendlier message.
CREATE OR REPLACE FUNCTION public.newsletter_confirm(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row public.newsletter_subs%ROWTYPE;
BEGIN
  IF p_token IS NULL OR length(p_token) < 8 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_token');
  END IF;
  SELECT * INTO v_row FROM public.newsletter_subs WHERE confirm_token = p_token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'token_not_found');
  END IF;
  -- EMAIL-F4: enforce expiry.
  IF v_row.confirm_token_expires_at IS NOT NULL AND v_row.confirm_token_expires_at < now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'token_expired');
  END IF;
  IF v_row.status = 'confirmed' THEN
    RETURN jsonb_build_object('ok', true, 'status', 'already_confirmed', 'email', v_row.email);
  END IF;
  UPDATE public.newsletter_subs
     SET status        = 'confirmed',
         confirm_token = NULL,
         confirm_token_expires_at = NULL,
         confirmed_at  = now(),
         updated_at    = now()
   WHERE id = v_row.id;
  RETURN jsonb_build_object('ok', true, 'status', 'confirmed', 'email', v_row.email);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.newsletter_confirm(text) FROM public;
GRANT  EXECUTE ON FUNCTION public.newsletter_confirm(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.newsletter_unsubscribe_by_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row public.newsletter_subs%ROWTYPE;
BEGIN
  IF p_token IS NULL OR length(p_token) < 8 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_token');
  END IF;
  -- Test-token guard from PR audit P1 — never let `test-<cid>`
  -- tokens unsubscribe a real subscriber.
  IF p_token LIKE 'test-%' THEN
    RETURN jsonb_build_object('ok', true, 'status', 'test_token_no_op');
  END IF;
  SELECT * INTO v_row FROM public.newsletter_subs WHERE unsubscribe_token = p_token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'token_not_found');
  END IF;
  -- EMAIL-F12: distinguish "already unsubscribed" from invalid.
  IF v_row.status = 'unsubscribed' THEN
    RETURN jsonb_build_object('ok', true, 'status', 'already_unsubscribed', 'email', v_row.email);
  END IF;
  UPDATE public.newsletter_subs
     SET status         = 'unsubscribed',
         unsubscribed_at = now(),
         updated_at     = now()
   WHERE id = v_row.id;
  RETURN jsonb_build_object('ok', true, 'status', 'unsubscribed', 'email', v_row.email);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.newsletter_unsubscribe_by_token(text) FROM public;
GRANT  EXECUTE ON FUNCTION public.newsletter_unsubscribe_by_token(text) TO anon, authenticated;
