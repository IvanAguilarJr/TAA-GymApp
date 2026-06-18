-- Migrate notes from one-per-day to multiple-per-week model.
-- Existing notes keep their id/text/created_at. Notes with created_at
-- before the current week's Sunday will be deleted by cleanupOldNotes
-- on the next app open (called from Home/Summary fetchData).

-- 1. Drop the updated_at trigger (notes are now immutable)
DROP TRIGGER IF EXISTS trg_notes_updated_at ON public.notes;

-- 2. Drop the old (user_id, date) index
DROP INDEX IF EXISTS idx_notes_user_date;

-- 3. Drop the unique constraint on (user_id, date)
ALTER TABLE public.notes DROP CONSTRAINT IF EXISTS notes_user_id_date_key;

-- 4. Drop columns no longer needed
ALTER TABLE public.notes DROP COLUMN IF EXISTS date;
ALTER TABLE public.notes DROP COLUMN IF EXISTS updated_at;

-- 5. Index for efficient week-range queries
CREATE INDEX IF NOT EXISTS idx_notes_user_created_at
  ON public.notes (user_id, created_at DESC);
