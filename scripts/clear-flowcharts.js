#!/usr/bin/env node

/**
 * Script to delete all flowcharts from the Supabase database
 * This will force the app to generate fresh AI flowcharts
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Initialize Supabase client
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase environment variables');
  console.error('Please ensure EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY are set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function clearAllFlowcharts() {
  try {
    console.log('🗑️ Deleting all flowcharts from database...');
    
    // Get count of existing flowcharts
    const { count, error: countError } = await supabase
      .from('flowcharts')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      console.error('❌ Error counting flowcharts:', countError);
      process.exit(1);
    }
    
    console.log(`📊 Found ${count} flowcharts in database`);
    
    if (count === 0) {
      console.log('✅ No flowcharts to delete');
      return;
    }
    
    // Delete all flowcharts
    const { error } = await supabase
      .from('flowcharts')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all (using impossible ID to match all)
    
    if (error) {
      console.error('❌ Error deleting flowcharts:', error);
      process.exit(1);
    }
    
    console.log(`✅ Successfully deleted all ${count} flowcharts from database`);
    console.log('🤖 Next app launch will generate fresh AI flowcharts');
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  }
}

// Run the cleanup
clearAllFlowcharts();