import { checkEssentialComponents } from './diagnoseDatabase';
import { fixDatabaseSchema, testDatabaseFix } from './fixDatabase';

// Run this to diagnose the database issue
export const runDatabaseDiagnosis = async () => {
  try {
    console.log('🔍 Starting database diagnosis...');
    
    const result = await checkEssentialComponents();
    
    if (result.issue) {
      console.log('\n🚨 DIAGNOSIS COMPLETE - ISSUE FOUND:');
      console.log(`Issue: ${result.issue}`);
      
      switch (result.issue) {
        case 'profiles_table_missing':
          console.log('\n📋 SOLUTION: Create the profiles table');
          console.log('Run the following SQL in Supabase SQL Editor:');
          console.log(`
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT,
  username TEXT UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);
          `);
          break;
          
        case 'rls_policies_missing':
          console.log('\n📋 SOLUTION: Fix RLS policies');
          console.log('The profiles table exists but RLS policies are not working correctly.');
          break;
          
        case 'profile_creation_exception':
          console.log('\n📋 SOLUTION: Check database connection and permissions');
          break;
          
        default:
          console.log('\n📋 SOLUTION: Unknown issue - check error details above');
      }
      
      if (result.error) {
        console.log('\nError details:', result.error);
      }
    } else {
      console.log('\n✅ DIAGNOSIS COMPLETE - NO ISSUES FOUND');
      console.log('The database appears to be set up correctly.');
      console.log('No authentication issues found.');
    }
    
    // Show the fix instructions
    console.log('\n🔧 GENERATING DATABASE FIX...');
    const fix = await fixDatabaseSchema();
    
    return { ...result, fix };
    
  } catch (error) {
    console.error('❌ Failed to run diagnosis:', error);
    throw error;
  }
};