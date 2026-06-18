-- Idempotent migration: adds note_date column for one-per-day enforcement
-- and ensures the old date/updated_at columns are dropped.
-- Safe to run whether or not migration 20260617000000 was previously applied.

-- 1. Drop old trigger (notes are now immutable except for same-day text edits)
DROP TRIGGER IF EXISTS trg_notes_updated_at ON public.notes;

-- 2. Drop old index and unique constraint (IF EXISTS makes these safe to re-run)
DROP INDEX IF EXISTS idx_notes_user_date;
ALTER TABLE public.notes DROP CONSTRAINT IF EXISTS notes_user_id_date_key;

-- 3. Drop old columns if still present
ALTER TABLE public.notes DROP COLUMN IF EXISTS date;
ALTER TABLE public.notes DROP COLUMN IF EXISTS updated_at;

-- 4. Add note_date: the canonical calendar date for this note ("YYYY-MM-DD"),
--    set by the client at insert time from the user's local clock.
--    DEFAULT '' allows the backfill UPDATE below to target unset rows safely.
ALTER TABLE public.notes
  ADD COLUMN IF NOT EXISTS note_date text NOT NULL DEFAULT '';

-- 5. Backfill existing rows from created_at (UTC date string)
UPDATE public.notes
  SET note_date = to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD')
  WHERE note_date = '';

-- 6. Enforce one note per user per calendar day
ALTER TABLE public.notes DROP CONSTRAINT IF EXISTS notes_user_id_note_date_key;
ALTER TABLE public.notes
  ADD CONSTRAINT notes_user_id_note_date_key UNIQUE (user_id, note_date);

-- 7. Indexes
DROP INDEX IF EXISTS idx_notes_user_created_at;
CREATE INDEX IF NOT EXISTS idx_notes_user_created_at
  ON public.notes (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notes_user_note_date
  ON public.notes (user_id, note_date);
