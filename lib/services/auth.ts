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
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  if (userError || !user) {
    return null;
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Profile not found
    }
    console.error('Error fetching user profile:', error);
    throw error;
  }

  return data;
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

// Listen to auth changes
export const onAuthStateChange = (callback: (event: string, session: any) => void) => {
  return supabase.auth.onAuthStateChange(callback);
};

// Check if user is authenticated
export const isAuthenticated = async (): Promise<boolean> => {
  const { data: { user } } = await supabase.auth.getUser();
  return !!user;
};