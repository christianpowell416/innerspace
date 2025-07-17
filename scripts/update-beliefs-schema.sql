-- Add belief column and rename label to emotion
-- Run this in your Supabase SQL editor BEFORE populating the data

-- Add the belief column
ALTER TABLE beliefs ADD COLUMN belief TEXT;

-- Rename label to emotion
ALTER TABLE beliefs RENAME COLUMN label TO emotion;

-- Add comments for documentation
COMMENT ON COLUMN beliefs.belief IS 'The belief text associated with this belief entry';
COMMENT ON COLUMN beliefs.emotion IS 'The emotion label for this belief entry';