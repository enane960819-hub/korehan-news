-- ============================================================
-- Zoom Review Classes
-- 2026-04-29
--
-- Free weekly Zoom review class for pro-plan users who submitted
-- writing >= 3 times in the past 7 days.
--
-- - zoom_classes: admin-managed schedule (one row per session)
-- - zoom_class_signups: user RSVPs, capped by max_participants
-- - get_upcoming_zoom_class(): one-shot status payload for the
--   study-room card (next class + my eligibility + my signup)
-- - signup_zoom_class / cancel_zoom_class_signup: gated mutations
-- ============================================================

CREATE TABLE IF NOT EXISTS public.zoom_classes (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  title             text        NOT NULL,
  description       text,
  scheduled_at      timestamptz NOT NULL,
  duration_minutes  int         NOT NULL DEFAULT 60,
  max_participants  int         NOT NULL DEFAULT 10 CHECK (max_participants > 0),
  zoom_url          text,
  status            text        NOT NULL DEFAULT 'open'
                       CHECK (status IN ('open','closed','cancelled','completed')),
  required_plan     text        NOT NULL DEFAULT 'pro',
  required_writing_count int    NOT NULL DEFAULT 3 CHECK (required_writing_count >= 0),
  required_window_days int      NOT NULL DEFAULT 7 CHECK (required_window_days > 0),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS zoom_classes_scheduled_idx
  ON public.zoom_classes(scheduled_at);
CREATE INDEX IF NOT EXISTS zoom_classes_status_idx
  ON public.zoom_classes(status, scheduled_at);

CREATE TABLE IF NOT EXISTS public.zoom_class_signups (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id      uuid        NOT NULL REFERENCES public.zoom_classes(id) ON DELETE CASCADE,
  user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  signed_up_at  timestamptz NOT NULL DEFAULT now(),
  status        text        NOT NULL DEFAULT 'registered'
                  CHECK (status IN ('registered','cancelled','attended','no_show')),
  UNIQUE(class_id, user_id)
);

CREATE INDEX IF NOT EXISTS zoom_signups_class_idx
  ON public.zoom_class_signups(class_id, status);
CREATE INDEX IF NOT EXISTS zoom_signups_user_idx
  ON public.zoom_class_signups(user_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.zoom_classes_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS zoom_classes_touch ON public.zoom_classes;
CREATE TRIGGER zoom_classes_touch
  BEFORE UPDATE ON public.zoom_classes
  FOR EACH ROW EXECUTE FUNCTION public.zoom_classes_touch_updated_at();

-- ─── RLS ────────────────────────────────────────────────────
ALTER TABLE public.zoom_classes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zoom_class_signups ENABLE ROW LEVEL SECURITY;

-- Anyone signed in can read the class catalog
DROP POLICY IF EXISTS "zoom_classes_read_all" ON public.zoom_classes;
CREATE POLICY "zoom_classes_read_all" ON public.zoom_classes
  FOR SELECT TO authenticated
  USING (true);

-- Service role / admin manages classes (via SQL editor or admin panel)
DROP POLICY IF EXISTS "zoom_classes_admin_all" ON public.zoom_classes;
CREATE POLICY "zoom_classes_admin_all" ON public.zoom_classes
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Users see only their own signups
DROP POLICY IF EXISTS "zoom_signups_read_own" ON public.zoom_class_signups;
CREATE POLICY "zoom_signups_read_own" ON public.zoom_class_signups
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "zoom_signups_admin_all" ON public.zoom_class_signups;
CREATE POLICY "zoom_signups_admin_all" ON public.zoom_class_signups
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Mutations go through SECURITY DEFINER RPCs, not direct table writes,
-- so we deliberately do NOT grant INSERT/UPDATE/DELETE on signups to
-- authenticated users. SELECT is fine for reading own row.
GRANT SELECT ON public.zoom_classes       TO authenticated;
GRANT SELECT ON public.zoom_class_signups TO authenticated;

-- ─── Eligibility helper ─────────────────────────────────────
-- Counts the user's writing submissions in the trailing N days.
-- Mirrors the topic-writing flow ('writing' content_type) — article
-- study no longer submits writing_text, so it isn't counted here.
CREATE OR REPLACE FUNCTION public.zoom_user_weekly_writing_count(
  p_user_id uuid,
  p_window_days int DEFAULT 7
)
RETURNS int
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::int
  FROM public.user_submissions
  WHERE user_id = p_user_id
    AND content_type = 'writing'
    AND study_date >= (CURRENT_DATE - (p_window_days || ' days')::interval)::date
    AND status IN ('submitted','ai_drafted','ai_reviewed','admin_approved','sent');
$$;

-- ─── Read RPC: study-room card payload ─────────────────────
-- Returns the next open class plus everything the UI needs to
-- render the card in one round trip.
CREATE OR REPLACE FUNCTION public.get_upcoming_zoom_class()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id        uuid := auth.uid();
  v_class          public.zoom_classes%ROWTYPE;
  v_count          int;
  v_my_status      text;
  v_plan           text := 'free';
  v_writing_count  int  := 0;
  v_eligible       boolean := false;
  v_reason         text;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_signed_in');
  END IF;

  -- Pick the next class that hasn't started yet
  SELECT * INTO v_class
  FROM public.zoom_classes
  WHERE status = 'open'
    AND scheduled_at > now()
  ORDER BY scheduled_at ASC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', true, 'class', null);
  END IF;

  -- Current registered headcount
  SELECT COUNT(*)::int INTO v_count
  FROM public.zoom_class_signups
  WHERE class_id = v_class.id
    AND status = 'registered';

  -- My signup status (NULL = not signed up)
  SELECT status INTO v_my_status
  FROM public.zoom_class_signups
  WHERE class_id = v_class.id
    AND user_id  = v_user_id;

  -- Plan
  SELECT plan INTO v_plan
  FROM public.user_subscriptions
  WHERE user_id = v_user_id
    AND status  = 'active'
    AND (expires_at IS NULL OR expires_at > now())
  LIMIT 1;
  v_plan := COALESCE(v_plan, 'free');

  -- Writing count in the configured window
  v_writing_count := public.zoom_user_weekly_writing_count(
    v_user_id, v_class.required_window_days
  );

  -- Determine eligibility + reason
  IF v_plan <> v_class.required_plan THEN
    v_eligible := false;
    v_reason := 'plan_required';
  ELSIF v_writing_count < v_class.required_writing_count THEN
    v_eligible := false;
    v_reason := 'writing_count_required';
  ELSE
    v_eligible := true;
    v_reason := null;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'class', jsonb_build_object(
      'id',                v_class.id,
      'title',             v_class.title,
      'description',       v_class.description,
      'scheduled_at',      v_class.scheduled_at,
      'duration_minutes',  v_class.duration_minutes,
      'max_participants',  v_class.max_participants,
      'current_count',     v_count,
      'is_full',           v_count >= v_class.max_participants,
      'required_plan',     v_class.required_plan,
      'required_writing_count', v_class.required_writing_count,
      'required_window_days',   v_class.required_window_days,
      -- Only expose the Zoom URL to users who registered for this class
      'zoom_url',          CASE WHEN v_my_status = 'registered'
                                THEN v_class.zoom_url ELSE NULL END
    ),
    'me', jsonb_build_object(
      'plan',                v_plan,
      'writing_count',       v_writing_count,
      'signup_status',       v_my_status,
      'eligible',            v_eligible,
      'eligibility_reason',  v_reason
    )
  );
END;
$$;

-- ─── Write RPC: sign up ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.signup_zoom_class(p_class_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id      uuid := auth.uid();
  v_class        public.zoom_classes%ROWTYPE;
  v_count        int;
  v_plan         text := 'free';
  v_writing      int;
  v_existing     text;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_signed_in');
  END IF;

  SELECT * INTO v_class FROM public.zoom_classes WHERE id = p_class_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'class_not_found');
  END IF;

  IF v_class.status <> 'open' OR v_class.scheduled_at <= now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'class_closed');
  END IF;

  -- Plan gate
  SELECT plan INTO v_plan
  FROM public.user_subscriptions
  WHERE user_id = v_user_id
    AND status  = 'active'
    AND (expires_at IS NULL OR expires_at > now())
  LIMIT 1;
  v_plan := COALESCE(v_plan, 'free');

  IF v_plan <> v_class.required_plan THEN
    RETURN jsonb_build_object('ok', false, 'error', 'plan_required',
                              'required_plan', v_class.required_plan);
  END IF;

  -- Writing-count gate
  v_writing := public.zoom_user_weekly_writing_count(
    v_user_id, v_class.required_window_days
  );
  IF v_writing < v_class.required_writing_count THEN
    RETURN jsonb_build_object('ok', false, 'error', 'writing_count_required',
                              'required', v_class.required_writing_count,
                              'have',     v_writing);
  END IF;

  -- Already registered? Treat as success (idempotent)
  SELECT status INTO v_existing
  FROM public.zoom_class_signups
  WHERE class_id = p_class_id AND user_id = v_user_id;

  IF v_existing = 'registered' THEN
    RETURN jsonb_build_object('ok', true, 'already_registered', true);
  END IF;

  -- Capacity check (lock the class row to avoid races)
  PERFORM 1 FROM public.zoom_classes WHERE id = p_class_id FOR UPDATE;

  SELECT COUNT(*)::int INTO v_count
  FROM public.zoom_class_signups
  WHERE class_id = p_class_id AND status = 'registered';

  IF v_count >= v_class.max_participants THEN
    RETURN jsonb_build_object('ok', false, 'error', 'class_full');
  END IF;

  -- Insert or revive a previously cancelled signup
  INSERT INTO public.zoom_class_signups (class_id, user_id, status)
  VALUES (p_class_id, v_user_id, 'registered')
  ON CONFLICT (class_id, user_id) DO UPDATE
    SET status = 'registered', signed_up_at = now();

  RETURN jsonb_build_object('ok', true, 'current_count', v_count + 1);
END;
$$;

-- ─── Write RPC: cancel signup ──────────────────────────────
CREATE OR REPLACE FUNCTION public.cancel_zoom_class_signup(p_class_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_signed_in');
  END IF;

  UPDATE public.zoom_class_signups
     SET status = 'cancelled'
   WHERE class_id = p_class_id
     AND user_id  = v_user_id
     AND status   = 'registered';

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_upcoming_zoom_class()           TO authenticated;
GRANT EXECUTE ON FUNCTION public.signup_zoom_class(uuid)             TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_zoom_class_signup(uuid)      TO authenticated;
GRANT EXECUTE ON FUNCTION public.zoom_user_weekly_writing_count(uuid, int) TO authenticated;
