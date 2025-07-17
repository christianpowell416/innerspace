-- Rename existing columns to match new schema
-- Run this in your Supabase SQL editor if you already have existing columns

-- Rename limiting_beliefs to belief
ALTER TABLE beliefs RENAME COLUMN limiting_beliefs TO belief;

-- Rename label to emotion
ALTER TABLE beliefs RENAME COLUMN label TO emotion;

-- Update the comments
COMMENT ON COLUMN beliefs.belief IS 'The belief text associated with this belief entry';
COMMENT ON COLUMN beliefs.emotion IS 'The emotion label for this belief entry';