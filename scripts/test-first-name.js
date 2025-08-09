// Test script to check if first_name column exists and is working
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testFirstNameColumn() {
  console.log('🧪 Testing if first_name column exists...');
  
  try {
    // Try to select first_name column from profiles table
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, first_name')
      .limit(1);
    
    if (error) {
      if (error.message.includes('first_name')) {
        console.log('❌ first_name column does not exist yet');
        console.log('');
        console.log('🔧 Please run this SQL in your Supabase SQL Editor:');
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
        return false;
      } else {
        console.error('❌ Database error:', error.message);
        return false;
      }
    }
    
    console.log('✅ first_name column exists and is accessible!');
    console.log('📊 Sample data:', data);
    return true;
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return false;
  }
}

// Run the test
testFirstNameColumn()
  .then(success => {
    if (success) {
      console.log('🎉 Migration verification passed! The first_name functionality should work now.');
    } else {
      console.log('⚠️  You need to run the SQL migration manually in Supabase.');
    }
  })
  .catch(console.error);