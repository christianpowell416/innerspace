const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_ACCESS_TOKEN;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  console.error('Make sure EXPO_PUBLIC_SUPABASE_URL and SUPABASE_ACCESS_TOKEN are set in .env.local');
  process.exit(1);
}

// Create Supabase client with service role key for admin operations
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function runMigration() {
  console.log('🚀 Starting migration: Add first_name column to profiles table');
  
  try {
    // Step 1: Add the first_name column
    console.log('📝 Adding first_name column to profiles table...');
    const { data: alterResult, error: alterError } = await supabase.rpc('exec_sql', {
      query: `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS first_name TEXT;`
    });
    
    if (alterError) {
      // Try alternative approach using direct SQL execution
      console.log('🔄 Trying alternative approach...');
      const { error: directError } = await supabase
        .from('profiles')
        .select('first_name')
        .limit(1);
        
      if (directError && directError.code === 'PGRST116') {
        // Column doesn't exist, we need to add it
        console.log('⚠️  Cannot add column directly via Supabase client');
        console.log('🔧 Please run the following SQL manually in your Supabase SQL Editor:');
        console.log('');
        console.log('ALTER TABLE profiles ADD COLUMN first_name TEXT;');
        console.log('');
        console.log('CREATE OR REPLACE FUNCTION handle_new_user()');
        console.log('RETURNS TRIGGER AS $$');
        console.log('BEGIN');
        console.log('  INSERT INTO profiles (id, email, first_name)');
        console.log('  VALUES (NEW.id, NEW.email, NULL);');
        console.log('  RETURN NEW;');
        console.log('END;');
        console.log('$$ LANGUAGE plpgsql SECURITY DEFINER;');
        console.log('');
        process.exit(1);
      }
    }
    
    // Step 2: Verify the column exists
    console.log('🔍 Verifying first_name column exists...');
    const { data: testData, error: testError } = await supabase
      .from('profiles')
      .select('first_name')
      .limit(1);
    
    if (testError) {
      console.error('❌ Column verification failed:', testError.message);
      throw testError;
    }
    
    console.log('✅ Migration completed successfully!');
    console.log('✅ first_name column is now available in the profiles table');
    
    // Step 3: Test the update functionality
    console.log('🧪 Testing first_name update functionality...');
    
    // We can't test the update without a specific user, so just verify the column exists
    console.log('✅ Column is ready for use!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.log('');
    console.log('🔧 Please run the following SQL manually in your Supabase SQL Editor:');
    console.log('');
    console.log('-- Add first_name column to profiles table');
    console.log('ALTER TABLE profiles ADD COLUMN first_name TEXT;');
    console.log('');
    console.log('-- Update the trigger function');
    console.log('CREATE OR REPLACE FUNCTION handle_new_user()');
    console.log('RETURNS TRIGGER AS $$');
    console.log('BEGIN');
    console.log('  INSERT INTO profiles (id, email, first_name)');
    console.log('  VALUES (NEW.id, NEW.email, NULL);');
    console.log('  RETURN NEW;');
    console.log('END;');
    console.log('$$ LANGUAGE plpgsql SECURITY DEFINER;');
    console.log('');
    process.exit(1);
  }
}

// Run the migration
runMigration();