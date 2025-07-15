import { supabase } from './supabase';

export async function diagnoseDatabaseIssues() {
  console.log('🔍 Diagnosing database setup...');
  
  try {
    // Check if we can connect to Supabase
    console.log('1. Testing Supabase connection...');
    const { data: healthCheck, error: healthError } = await supabase
      .from('profiles')
      .select('count', { count: 'exact', head: true });
    
    if (healthError) {
      console.error('❌ Supabase connection failed:', healthError);
      if (healthError.message.includes('relation "profiles" does not exist')) {
        console.log('💡 Issue: The profiles table does not exist in your Supabase database');
        return { issue: 'missing_profiles_table', error: healthError };
      }
    } else {
      console.log('✅ Supabase connection successful');
    }

    // Check current user (should be null when not authenticated)
    console.log('2. Checking current authentication state...');
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError) {
      console.error('❌ Auth check failed:', userError);
    } else {
      console.log('✅ Auth state:', user ? `Logged in as ${user.email}` : 'Not logged in');
    }

    // Test if we can query the profiles table structure
    console.log('3. Checking profiles table structure...');
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .limit(1);
    
    if (profilesError) {
      console.error('❌ Profiles table query failed:', profilesError);
      return { issue: 'profiles_table_error', error: profilesError };
    } else {
      console.log('✅ Profiles table accessible, current count:', healthCheck?.count || 0);
    }

    // Check RLS policies by attempting a basic operation
    console.log('4. Testing RLS policies...');
    if (user) {
      const { data: userProfile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (profileError && profileError.code !== 'PGRST116') { // PGRST116 = not found
        console.error('❌ RLS policy test failed:', profileError);
        return { issue: 'rls_policy_error', error: profileError };
      } else {
        console.log('✅ RLS policies working');
        if (userProfile) {
          console.log('✅ User profile exists:', userProfile);
        } else {
          console.log('ℹ️ User profile does not exist yet (normal for new users)');
        }
      }
    }

    console.log('✅ Database diagnosis complete - no major issues detected');
    return { issue: null };
    
  } catch (error) {
    console.error('❌ Unexpected error during diagnosis:', error);
    return { issue: 'unexpected_error', error };
  }
}

// Function to manually create a profile (fallback)
export async function createUserProfile(userId: string, email: string) {
  try {
    console.log('🔧 Attempting to manually create profile...');
    
    const { data, error } = await supabase
      .from('profiles')
      .insert({
        id: userId,
        email: email,
      })
      .select()
      .single();
    
    if (error) {
      console.error('❌ Manual profile creation failed:', error);
      throw error;
    }
    
    console.log('✅ Profile created successfully:', data);
    return data;
  } catch (error) {
    console.error('❌ Error in manual profile creation:', error);
    throw error;
  }
}