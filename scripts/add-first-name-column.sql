-- Add first_name column to profiles table
-- Run this script in your Supabase SQL Editor

-- Add the first_name column to the profiles table
ALTER TABLE profiles 
ADD COLUMN first_name TEXT;

-- Update the trigger function to include first_name when creating new profiles
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, first_name)
  VALUES (NEW.id, NEW.email, NULL);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- The trigger is already in place, so we don't need to recreate it
-- It will automatically use the updated function

-- Verify the column was added
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'profiles' AND table_schema = 'public';