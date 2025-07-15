import { supabase } from './supabase';

export async function setupDatabase() {
  console.log('🔧 Setting up database schema...');
  
  try {
    // Note: Most of these operations require database admin access
    // You'll need to run the schema.sql file in the Supabase SQL editor
    
    console.log('ℹ️ Database setup requires admin access.');
    console.log('Please run the following steps in your Supabase dashboard:');
    console.log('');
    console.log('1. Go to your Supabase dashboard: https://app.supabase.com/');
    console.log('2. Navigate to SQL Editor');
    console.log('3. Copy and paste the contents of database/schema.sql');
    console.log('4. Run the SQL script');
    console.log('');
    console.log('Alternatively, you can run this command in your terminal:');
    console.log('npx supabase db reset (if you have Supabase CLI installed)');
    
    // Test if basic tables exist
    const { error: profilesError } = await supabase
      .from('profiles')
      .select('count', { count: 'exact', head: true });
    
    if (profilesError) {
      if (profilesError.message.includes('relation "profiles" does not exist')) {
        console.log('❌ Profiles table does not exist - please run the schema.sql');
        return { success: false, issue: 'missing_schema' };
      }
    }
    
    const { error: emotionsError } = await supabase
      .from('emotions')
      .select('count', { count: 'exact', head: true });
    
    if (emotionsError) {
      if (emotionsError.message.includes('relation "emotions" does not exist')) {
        console.log('❌ Emotions table does not exist - please run the schema.sql');
        return { success: false, issue: 'missing_schema' };
      }
    }
    
    console.log('✅ Database schema appears to be set up correctly');
    return { success: true };
    
  } catch (error) {
    console.error('❌ Error checking database setup:', error);
    return { success: false, error };
  }
}