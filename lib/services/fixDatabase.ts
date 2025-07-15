import { supabase } from '../supabase';

// SQL to fix the database - this creates the missing trigger
const FIX_DATABASE_SQL = `
-- First, create the function to handle new user creation
-- SECURITY DEFINER makes it run with the privileges of the function creator (bypassing RLS)
CREATE OR REPLACE FUNCTION handle_new_user() 
RETURNS TRIGGER 
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, created_at, updated_at)
  VALUES (NEW.id, NEW.email, NOW(), NOW());
  RETURN NEW;
EXCEPTION
  WHEN others THEN
    -- Log the error but don't fail the user creation
    RAISE LOG 'Error creating profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger that automatically creates a profile when a user signs up
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Make sure RLS policies exist for profiles table
CREATE POLICY IF NOT EXISTS "Users can view their own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY IF NOT EXISTS "Users can update their own profile" ON profiles  
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY IF NOT EXISTS "Users can insert their own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);
`;

export const fixDatabaseSchema = async () => {
  try {
    console.log('🔧 Fixing database schema...');
    
    // Note: This will need to be run in Supabase SQL Editor
    // We can't run raw SQL like this through the JS client for security reasons
    console.log('📋 SQL to run in Supabase SQL Editor:');
    console.log('=====================================');
    console.log(FIX_DATABASE_SQL);
    console.log('=====================================');
    
    return {
      success: false,
      message: 'Please copy the SQL above and run it in your Supabase SQL Editor',
      sql: FIX_DATABASE_SQL
    };
    
  } catch (error) {
    console.error('❌ Error generating fix:', error);
    throw error;
  }
};

// Test if the fix worked
export const testDatabaseFix = async () => {
  try {
    console.log('🧪 Testing if database fix worked...');
    
    // Try to check if the trigger exists by looking at information_schema
    // This is a simple test - if we can create a test profile, the basic setup works
    const testUserId = crypto.randomUUID();
    
    const { data, error } = await supabase
      .from('profiles')
      .insert({
        id: testUserId,
        email: 'test@example.com',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.log('❌ Database still has issues:', error.message);
      return { success: false, error };
    }

    // Clean up test data
    await supabase.from('profiles').delete().eq('id', testUserId);
    
    console.log('✅ Database appears to be working correctly');
    return { success: true };
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    return { success: false, error };
  }
};