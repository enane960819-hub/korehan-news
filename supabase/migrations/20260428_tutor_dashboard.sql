-- ============================================================
-- Tutor dashboard schema
-- Run this in Supabase SQL Editor.
--
-- Context: a private tutor dashboard for English-class student management
-- (Preply tutoring), accessible only to a fixed allowlist of emails
-- (the project admin and aliciarburgess@gmail.com). Stores per-student
-- profile + skill scores and per-lesson notes, plans, and AI-generated
-- post-lesson feedback. The same dataset is shared between tutor and
-- admin (no per-tutor isolation needed for now), gated by an email
-- allowlist enforced via RLS.
-- ============================================================

-- 1. Students table
CREATE TABLE IF NOT EXISTS public.tutor_students (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  name            text        NOT NULL,
  email           text,
  preply_handle   text,
  level           text,                       -- e.g. 'A2', 'B1', 'B2'
  goal            text,
  notes           text,
  -- Five skill axes, 0-100
  skill_speaking  int         NOT NULL DEFAULT 0 CHECK (skill_speaking  BETWEEN 0 AND 100),
  skill_listening int         NOT NULL DEFAULT 0 CHECK (skill_listening BETWEEN 0 AND 100),
  skill_reading   int         NOT NULL DEFAULT 0 CHECK (skill_reading   BETWEEN 0 AND 100),
  skill_writing   int         NOT NULL DEFAULT 0 CHECK (skill_writing   BETWEEN 0 AND 100),
  skill_grammar   int         NOT NULL DEFAULT 0 CHECK (skill_grammar   BETWEEN 0 AND 100),
  archived        boolean     NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tutor_students_owner_idx
  ON public.tutor_students(owner_id);

-- 2. Lessons table
CREATE TABLE IF NOT EXISTS public.tutor_lessons (
  id                       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id               uuid        NOT NULL REFERENCES public.tutor_students(id) ON DELETE CASCADE,
  owner_id                 uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  scheduled_at             timestamptz,
  duration_minutes         int         NOT NULL DEFAULT 60,
  status                   text        NOT NULL DEFAULT 'scheduled'
                             CHECK (status IN ('scheduled','completed','canceled')),
  topic                    text,
  lesson_notes             text,         -- in-class notes
  next_plan                text,         -- next-lesson plan
  ai_feedback              text,         -- AI-generated post-lesson feedback
  ai_feedback_generated_at timestamptz,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tutor_lessons_student_idx
  ON public.tutor_lessons(student_id);
CREATE INDEX IF NOT EXISTS tutor_lessons_scheduled_idx
  ON public.tutor_lessons(scheduled_at DESC);

-- 3. updated_at trigger
CREATE OR REPLACE FUNCTION public.tutor_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tutor_students_touch ON public.tutor_students;
CREATE TRIGGER tutor_students_touch
  BEFORE UPDATE ON public.tutor_students
  FOR EACH ROW EXECUTE FUNCTION public.tutor_touch_updated_at();

DROP TRIGGER IF EXISTS tutor_lessons_touch ON public.tutor_lessons;
CREATE TRIGGER tutor_lessons_touch
  BEFORE UPDATE ON public.tutor_lessons
  FOR EACH ROW EXECUTE FUNCTION public.tutor_touch_updated_at();

-- 4. RLS — only the email allowlist can read/write
ALTER TABLE public.tutor_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tutor_lessons  ENABLE ROW LEVEL SECURITY;

-- Helper: returns true when the calling user's email is on the tutor allowlist.
-- Update this list (and korehan-shared.js TUTOR_EMAILS) together if it changes.
CREATE OR REPLACE FUNCTION public.is_tutor_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT lower(coalesce((auth.jwt() ->> 'email'), '')) IN (
    'enane960819@gmail.com',
    'aliciarburgess@gmail.com'
  );
$$;

DROP POLICY IF EXISTS "tutor_students_allowlist_all" ON public.tutor_students;
CREATE POLICY "tutor_students_allowlist_all" ON public.tutor_students
  FOR ALL USING (public.is_tutor_user())
  WITH CHECK (public.is_tutor_user());

DROP POLICY IF EXISTS "tutor_lessons_allowlist_all" ON public.tutor_lessons;
CREATE POLICY "tutor_lessons_allowlist_all" ON public.tutor_lessons
  FOR ALL USING (public.is_tutor_user())
  WITH CHECK (public.is_tutor_user());

-- 5. Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tutor_students TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tutor_lessons  TO authenticated;
