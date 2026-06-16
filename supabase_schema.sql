-- ============================================================
-- QINETIC — Supabase Schema
-- Phase 1: schema-only migration from Firebase
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================


-- ============================================================
-- SECTION 1: EXTENSIONS
-- ============================================================

-- pgcrypto supplies gen_random_uuid() used for primary keys
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ============================================================
-- SECTION 2: TABLES
-- ============================================================

-- ------------------------------------------------------------
-- 2a. profiles
--     One row per auth user. Created automatically via trigger
--     (see Section 4). Mirrors Firebase: users/{id}/profile/settings
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id           uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  weight_unit  text        NOT NULL DEFAULT 'kg',
  photo_url    text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- 2b. exercises
--     One row per exercise defined by the user.
--     Mirrors Firebase: users/{userId}/exercises/{exerciseId}
--
--     target_sets / target_reps  — the planned defaults shown in the UI
--     max_weight                 — denormalised max across all logged sets;
--                                  maintained by the app layer (Phase 2)
--     days                       — which weekdays this exercise is scheduled
--     "order"                    — drag-and-drop sort position
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.exercises (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name         text        NOT NULL,
  target_sets  int         NOT NULL DEFAULT 3,
  target_reps  int         NOT NULL DEFAULT 10,
  max_weight   numeric     NOT NULL DEFAULT 0,
  days         text[]      NOT NULL DEFAULT '{}',
  "order"      int         NOT NULL DEFAULT 0,
  muscle_tag   text,
  type_tag     text,
  emoji        text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- 2c. set_entries
--     One row per set within a logged session.
--     Replaces the nested WeightEntry[].sets[] array in Firebase.
--
--     logged_at  — the timestamp of the session this set belongs to;
--                  group by (exercise_id, date_trunc('day', logged_at))
--                  to reconstruct a full session (WeightEntry equivalent)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.set_entries (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id uuid        NOT NULL REFERENCES public.exercises(id) ON DELETE CASCADE,
  set_number  int         NOT NULL,
  weight      numeric     NOT NULL,
  reps        int         NOT NULL,
  logged_at   timestamptz NOT NULL DEFAULT now(),
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- 2d. notes
--     One per-day workout note per user.
--     Mirrors Firebase: users/{userId}/notes/{date}
--     UNIQUE(user_id, date) enforces one note per calendar day.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notes (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date       date        NOT NULL,
  text       text        NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);


-- ============================================================
-- SECTION 3: CONSTRAINTS
-- Matching existing validation limits in firebase/exercises.ts:
--   MAX_SETS = 4 | MAX_WEIGHT_KG = 1000 | MAX_REPS = 100
-- ============================================================

-- profiles: weight_unit must be one of the two supported values
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_weight_unit_check
  CHECK (weight_unit IN ('kg', 'lbs'));

-- exercises: target caps mirror MAX_SETS / MAX_REPS constants
ALTER TABLE public.exercises
  ADD CONSTRAINT exercises_target_sets_check
  CHECK (target_sets >= 1 AND target_sets <= 4);

ALTER TABLE public.exercises
  ADD CONSTRAINT exercises_target_reps_check
  CHECK (target_reps >= 1 AND target_reps <= 100);

ALTER TABLE public.exercises
  ADD CONSTRAINT exercises_max_weight_check
  CHECK (max_weight >= 0 AND max_weight <= 1000);

-- exercises: only known day abbreviations (+ "None" for unscheduled)
ALTER TABLE public.exercises
  ADD CONSTRAINT exercises_days_check
  CHECK (days <@ ARRAY['Mon','Tue','Wed','Thu','Fri','Sat','Sun','None']::text[]);

-- set_entries: hard limits matching the three MAX_* constants
ALTER TABLE public.set_entries
  ADD CONSTRAINT set_entries_set_number_check
  CHECK (set_number >= 1 AND set_number <= 4);

ALTER TABLE public.set_entries
  ADD CONSTRAINT set_entries_weight_check
  CHECK (weight >= 0 AND weight <= 1000);

ALTER TABLE public.set_entries
  ADD CONSTRAINT set_entries_reps_check
  CHECK (reps >= 0 AND reps <= 100);


-- ============================================================
-- SECTION 4: INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_exercises_user_id
  ON public.exercises (user_id);

CREATE INDEX IF NOT EXISTS idx_exercises_user_order
  ON public.exercises (user_id, "order");

-- Supports reconstructing sessions and the Summary tab aggregations
CREATE INDEX IF NOT EXISTS idx_set_entries_exercise_id
  ON public.set_entries (exercise_id);

CREATE INDEX IF NOT EXISTS idx_set_entries_logged_at
  ON public.set_entries (logged_at);

CREATE INDEX IF NOT EXISTS idx_notes_user_date
  ON public.notes (user_id, date);


-- ============================================================
-- SECTION 5: TRIGGERS & FUNCTIONS
-- ============================================================

-- ------------------------------------------------------------
-- 5a. Auto-update updated_at on any UPDATE
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE TRIGGER trg_exercises_updated_at
  BEFORE UPDATE ON public.exercises
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE TRIGGER trg_notes_updated_at
  BEFORE UPDATE ON public.notes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------------
-- 5b. Auto-create a profiles row when a new user signs up
--     Fires AFTER INSERT ON auth.users (Supabase internal table).
--     SECURITY DEFINER lets the function bypass RLS to insert.
--     display_name is pulled from OAuth metadata when available.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, weight_unit)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'display_name',
      NEW.raw_user_meta_data->>'full_name',
      split_part(NEW.email, '@', 1)
    ),
    'kg'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ============================================================
-- SECTION 6: ROW LEVEL SECURITY (RLS) POLICIES
-- Users may only read and write their own rows.
-- set_entries ownership is checked via the parent exercises row.
-- ============================================================

-- ------------------------------------------------------------
-- 6a. profiles
-- ------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles: select own"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "profiles: insert own"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles: update own"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles: delete own"
  ON public.profiles FOR DELETE
  USING (auth.uid() = id);

-- ------------------------------------------------------------
-- 6b. exercises
-- ------------------------------------------------------------
ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "exercises: select own"
  ON public.exercises FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "exercises: insert own"
  ON public.exercises FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "exercises: update own"
  ON public.exercises FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "exercises: delete own"
  ON public.exercises FOR DELETE
  USING (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 6c. set_entries
--     No direct user_id column — ownership is verified by joining
--     to exercises and checking that exercise's user_id.
-- ------------------------------------------------------------
ALTER TABLE public.set_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "set_entries: select own"
  ON public.set_entries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.exercises e
      WHERE e.id = set_entries.exercise_id
        AND e.user_id = auth.uid()
    )
  );

CREATE POLICY "set_entries: insert own"
  ON public.set_entries FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.exercises e
      WHERE e.id = exercise_id
        AND e.user_id = auth.uid()
    )
  );

CREATE POLICY "set_entries: update own"
  ON public.set_entries FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.exercises e
      WHERE e.id = set_entries.exercise_id
        AND e.user_id = auth.uid()
    )
  );

CREATE POLICY "set_entries: delete own"
  ON public.set_entries FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.exercises e
      WHERE e.id = set_entries.exercise_id
        AND e.user_id = auth.uid()
    )
  );

-- ------------------------------------------------------------
-- 6d. notes
-- ------------------------------------------------------------
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notes: select own"
  ON public.notes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "notes: insert own"
  ON public.notes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "notes: update own"
  ON public.notes FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "notes: delete own"
  ON public.notes FOR DELETE
  USING (auth.uid() = user_id);


-- ============================================================
-- SECTION 7: STORAGE — profile-pictures bucket
--
-- This section creates the private bucket and scopes all object
-- operations to the authenticated owner, matched by the first
-- path segment: {user_id}/{filename}
--
-- If you prefer to create the bucket via the Supabase dashboard,
-- skip the INSERT and run only the CREATE POLICY statements.
-- ============================================================

--INSERT INTO storage.buckets (id, name, public)
--VALUES ('profile-pictures', 'profile-pictures', false)
--ON CONFLICT (id) DO NOTHING;

-- RLS on storage.objects must be enabled (it is by default in Supabase)

CREATE POLICY "storage: upload own profile picture"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'profile-pictures'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "storage: read own profile picture"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'profile-pictures'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "storage: update own profile picture"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'profile-pictures'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "storage: delete own profile picture"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'profile-pictures'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
