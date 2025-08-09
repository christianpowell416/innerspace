import { supabase } from '../supabase';
import { Database } from '../database.types';

export type Profile = Database['public']['Tables']['profiles']['Row'];

// Sign up with email and password
export const signUp = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    console.error('Error signing up:', error);
    throw error;
  }

  return data;
};

// Sign in with email and password
export const signIn = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    console.error('Error signing in:', error);
    throw error;
  }

  return data;
};

// Sign out
export const signOut = async () => {
  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error('Error signing out:', error);
    throw error;
  }
};

// Get current user
export const getCurrentUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error) {
    console.error('Error getting current user:', error);
    throw error;
  }

  return user;
};

// Get user profile
export const getUserProfile = async (): Promise<Profile | null> => {
  console.log('🔍 Getting user profile...');
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  if (userError || !user) {
    console.log('🔍 No user found for profile fetch');
    return null;
  }

  console.log('🔍 Fetching profile for user:', user.id);
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      console.log('🔍 Profile not found for user, creating new profile...');
      
      // Create profile for new OAuth users
      try {
        const { data: newProfile, error: createError } = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            email: user.email,
            first_name: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select()
          .single();
          
        if (createError) {
          console.error('Error creating profile:', createError);
          return null;
        }
        
        console.log('🔍 Profile created successfully');
        return newProfile;
      } catch (createError) {
        console.error('Error creating profile:', createError);
        return null;
      }
    }
    console.error('Error fetching user profile:', error);
    throw error;
  }

  console.log('🔍 Profile fetched successfully');
  return data;
};

// Get user profile for a specific user (avoids additional getUser call)
export const getUserProfileForUser = async (user: any): Promise<Profile | null> => {
  console.log('🔍 Getting user profile for user:', user.id);

  const startTime = Date.now();
  
  try {
    console.log('🔍 Executing profile query at', new Date().toISOString());
    
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
      
    const queryTime = Date.now() - startTime;
    console.log('🔍 Profile query completed in', queryTime, 'ms');

    if (error) {
      if (error.code === 'PGRST116') {
        console.log('🔍 Profile not found for user, creating new profile...');
        
        // Create profile for new OAuth users
        try {
          console.log('🔍 Inserting new profile...');
          const { data: newProfile, error: createError } = await supabase
            .from('profiles')
            .insert({
              id: user.id,
              email: user.email,
              first_name: null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .select()
            .single();
            
          if (createError) {
            console.error('Error creating profile:', createError);
            return null;
          }
          
          console.log('🔍 Profile created successfully');
          return newProfile;
        } catch (createError) {
          console.error('Error creating profile:', createError);
          return null;
        }
      }
      console.error('Error fetching user profile:', error);
      throw error;
    }

    console.log('🔍 Profile fetched successfully');
    return data;
  } catch (error) {
    const queryTime = Date.now() - startTime;
    console.error('🔍 Error in getUserProfileForUser after', queryTime, 'ms:', error);
    throw error;
  }
};

// Update user profile
export const updateUserProfile = async (updates: Partial<Profile>): Promise<Profile> => {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  if (userError || !user) {
    throw new Error('User not authenticated');
  }

  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', user.id)
    .select()
    .single();

  if (error) {
    console.error('Error updating user profile:', error);
    throw error;
  }

  return data;
};

// Update user first name
export const updateUserFirstName = async (firstName: string): Promise<Profile> => {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  if (userError || !user) {
    throw new Error('User not authenticated');
  }

  const { data, error } = await supabase
    .from('profiles')
    .update({ 
      first_name: firstName,
      updated_at: new Date().toISOString()
    })
    .eq('id', user.id)
    .select()
    .single();

  if (error) {
    console.error('Error updating user first name:', error);
    throw error;
  }

  return data;
};

// Listen to auth changes
export const onAuthStateChange = (callback: (event: string, session: any) => void) => {
  return supabase.auth.onAuthStateChange(callback);
};

// Check if user is authenticated
export const isAuthenticated = async (): Promise<boolean> => {
  const { data: { user } } = await supabase.auth.getUser();
  return !!user;
};