-- Add color column to exercises table.
-- Existing rows get the default yellow accent; new rows use whatever the app passes.
ALTER TABLE public.exercises
  ADD COLUMN IF NOT EXISTS color text NOT NULL DEFAULT '#FFD944';
