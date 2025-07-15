import { supabase } from '../supabase';

// Diagnostic script to check what database components are missing
export const diagnoseDatabaseSetup = async () => {
  const results: Record<string, any> = {};

  try {
    console.log('🔍 Diagnosing database setup...');

    // Check if profiles table exists
    try {
      const { data: profilesTable, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .limit(1);
      
      results.profilesTable = {
        exists: !profilesError,
        error: profilesError?.message,
        canQuery: !!profilesTable
      };
    } catch (error: any) {
      results.profilesTable = {
        exists: false,
        error: error.message,
        canQuery: false
      };
    }

    // Check if emotions table exists
    try {
      const { data: emotionsTable, error: emotionsError } = await supabase
        .from('emotions')
        .select('*')
        .limit(1);
      
      results.emotionsTable = {
        exists: !emotionsError,
        error: emotionsError?.message,
        canQuery: !!emotionsTable
      };
    } catch (error: any) {
      results.emotionsTable = {
        exists: false,
        error: error.message,
        canQuery: false
      };
    }

    // Check if we can access auth.users (this will fail due to RLS, but should show table exists)
    try {
      const { data: authUsers, error: authError } = await supabase
        .from('auth.users')
        .select('*')
        .limit(1);
      
      results.authUsers = {
        accessible: !authError,
        error: authError?.message
      };
    } catch (error: any) {
      results.authUsers = {
        accessible: false,
        error: error.message
      };
    }

    // Check RLS policies for profiles table
    try {
      const { data: policies, error: policiesError } = await supabase
        .rpc('check_policies_exist');
      
      results.policies = {
        checked: !policiesError,
        data: policies,
        error: policiesError?.message
      };
    } catch (error: any) {
      results.policies = {
        checked: false,
        error: error.message
      };
    }

    // Check if handle_new_user function exists
    try {
      const { data: functions, error: functionsError } = await supabase
        .rpc('check_functions_exist');
      
      results.functions = {
        checked: !functionsError,
        data: functions,
        error: functionsError?.message
      };
    } catch (error: any) {
      results.functions = {
        checked: false,
        error: error.message
      };
    }

    // Check if trigger exists
    try {
      const { data: triggers, error: triggersError } = await supabase
        .rpc('check_triggers_exist');
      
      results.triggers = {
        checked: !triggersError,
        data: triggers,
        error: triggersError?.message
      };
    } catch (error: any) {
      results.triggers = {
        checked: false,
        error: error.message
      };
    }

    console.log('📊 Database Diagnosis Results:');
    console.log('===================================');
    
    Object.entries(results).forEach(([key, value]) => {
      console.log(`${key}:`, JSON.stringify(value, null, 2));
      console.log('---');
    });

    return results;

  } catch (error) {
    console.error('❌ Error during database diagnosis:', error);
    throw error;
  }
};

// Simple check for essential components
export const checkEssentialComponents = async () => {
  try {
    console.log('🔧 Checking essential database components...');

    // Test profile creation
    const testUserId = crypto.randomUUID();
    
    try {
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
        console.log('❌ Profile creation failed:', error.message);
        
        if (error.message.includes('relation "profiles" does not exist')) {
          console.log('🚨 ISSUE: profiles table does not exist');
          return { issue: 'profiles_table_missing', error };
        }
        
        if (error.message.includes('permission denied')) {
          console.log('🚨 ISSUE: RLS policies not configured properly');
          return { issue: 'rls_policies_missing', error };
        }
        
        return { issue: 'unknown_profile_creation_error', error };
      }

      console.log('✅ Profile creation test successful');
      
      // Clean up test data
      await supabase.from('profiles').delete().eq('id', testUserId);
      
      return { issue: null, success: true };

    } catch (error: any) {
      console.log('❌ Profile creation test failed:', error.message);
      return { issue: 'profile_creation_exception', error };
    }

  } catch (error) {
    console.error('❌ Error checking essential components:', error);
    throw error;
  }
};