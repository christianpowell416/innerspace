-- Create flowcharts table for storing user flowchart data
-- Run this in your Supabase SQL editor

CREATE TABLE IF NOT EXISTS flowcharts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'My Flowchart',
  structure JSONB NOT NULL,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_default BOOLEAN DEFAULT FALSE,
  
  -- Note: Unique constraint for default flowchart will be added separately
);

-- Add RLS (Row Level Security) policies
ALTER TABLE flowcharts ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own flowcharts
CREATE POLICY "Users can view own flowcharts" ON flowcharts
  FOR SELECT USING (auth.uid() = user_id);

-- Policy: Users can insert their own flowcharts
CREATE POLICY "Users can insert own flowcharts" ON flowcharts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own flowcharts
CREATE POLICY "Users can update own flowcharts" ON flowcharts
  FOR UPDATE USING (auth.uid() = user_id);

-- Policy: Users can delete their own flowcharts
CREATE POLICY "Users can delete own flowcharts" ON flowcharts
  FOR DELETE USING (auth.uid() = user_id);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS flowcharts_user_id_idx ON flowcharts(user_id);
CREATE INDEX IF NOT EXISTS flowcharts_last_updated_idx ON flowcharts(last_updated);

-- Create partial unique index to ensure only one default flowchart per user
CREATE UNIQUE INDEX IF NOT EXISTS flowcharts_user_default_idx 
ON flowcharts(user_id) WHERE is_default = TRUE;

-- Add comments for documentation
COMMENT ON TABLE flowcharts IS 'Stores user-created flowcharts for IFS therapy visualization';
COMMENT ON COLUMN flowcharts.structure IS 'JSONB containing nodes and edges data';
COMMENT ON COLUMN flowcharts.is_default IS 'Whether this is the user default flowchart (only one per user)';

-- NOTE: No default flowchart structure is provided
-- All flowcharts must be generated via AI based on user requirements
-- This ensures fresh, personalized flowcharts for each user