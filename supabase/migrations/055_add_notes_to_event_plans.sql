-- Migration: Add notes column to event_plans table
-- Purpose: Allow users to add personal notes to their AI-generated event plans

-- Add notes column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'event_plans'
        AND column_name = 'notes'
    ) THEN
        ALTER TABLE public.event_plans ADD COLUMN notes TEXT DEFAULT '';
    END IF;
END $$;

-- Add comment for documentation
COMMENT ON COLUMN public.event_plans.notes IS 'User-added personal notes for the event plan (max 500 chars enforced at API level)';
