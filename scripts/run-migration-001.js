const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

async function runMigration() {
  console.log('🚀 Starting database migration 001-add-core-tables...');

  // Initialize Supabase client using the same config as the app
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    console.error('❌ Missing EXPO_PUBLIC_SUPABASE_URL in .env.local');
    process.exit(1);
  }

  // Use service role key if available, otherwise use anon key (limited functionality)
  const supabaseKey = supabaseServiceKey || supabaseAnonKey;
  if (!supabaseKey) {
    console.error('❌ Missing both SUPABASE_SERVICE_ROLE_KEY and EXPO_PUBLIC_SUPABASE_ANON_KEY');
    process.exit(1);
  }

  if (!supabaseServiceKey) {
    console.warn('⚠️ Using anon key - some operations may be restricted');
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Read migration file
    const migrationPath = path.join(__dirname, '../lib/migrations/001-add-core-tables.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📂 Migration file loaded successfully');

    // Execute migration
    const { error } = await supabase.rpc('execute_sql', { sql_query: migrationSQL });

    if (error) {
      // Try alternative method if execute_sql doesn't exist
      console.log('⚠️ Direct SQL execution not available, trying batch execution...');

      // Split SQL into individual statements and execute them
      const statements = migrationSQL
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

      for (const statement of statements) {
        if (statement.length > 0) {
          console.log('🔄 Executing:', statement.substring(0, 50) + '...');
          const { error: stmtError } = await supabase.rpc('exec', { sql: statement });

          if (stmtError) {
            console.error('❌ Error executing statement:', stmtError);
            console.error('Statement:', statement);
            throw stmtError;
          }
        }
      }
    }

    console.log('✅ Migration 001-add-core-tables completed successfully!');
    console.log('📊 Added tables:');
    console.log('   - complexes');
    console.log('   - conversations');
    console.log('   - detected_emotions');
    console.log('   - detected_parts');
    console.log('   - detected_needs');
    console.log('🔐 Row Level Security enabled on all tables');
    console.log('🚀 Database is ready for backend integration!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
runMigration();