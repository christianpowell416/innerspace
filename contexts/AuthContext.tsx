import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { Profile, getCurrentUser, getUserProfile, getUserProfileForUser } from '@/lib/services/auth';
import { signInWithGoogle } from '@/lib/services/oauth';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);


  // Load initial session
  useEffect(() => {
    const getInitialSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          try {
            const userProfile = await getUserProfile();
            setProfile(userProfile);
          } catch (error) {
            console.error('Error loading user profile:', error);
          }
        }
      } catch (error) {
        console.error('Error getting initial session:', error);
      } finally {
        setLoading(false);
      }
    };

    getInitialSession();
  }, []);

  // Listen for auth changes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔄 Auth state change:', event, 'User:', session?.user?.email || 'none');
        
        try {
          setSession(session);
          setUser(session?.user ?? null);
          
          if (session?.user) {
            console.log('🔄 Loading user profile in background...');
            
            // Load profile in background without blocking login
            getUserProfileForUser(session.user)
              .then((userProfile) => {
                if (userProfile) {
                  console.log('🔄 User profile loaded successfully in background');
                  setProfile(userProfile);
                } else {
                  console.log('🔄 Profile loading failed, continuing without profile');
                  setProfile(null);
                }
              })
              .catch((error) => {
                console.error('🔄 Error loading user profile in background:', error);
                setProfile(null);
              });
            
            // Continue immediately without waiting
            setProfile(null);
          } else {
            console.log('🔄 No user session, clearing profile');
            setProfile(null);
          }
        } catch (error) {
          console.error('Error in auth state change handler:', error);
          setProfile(null);
        } finally {
          // Always clear loading after processing the auth change
          console.log('🔄 Clearing loading for event:', event);
          setLoading(false);
          console.log('🔄 Auth state change processing complete');
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);


  const signIn = async (email: string, password: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      
      // The auth state change listener will handle setting user and profile
    } catch (error) {
      console.error('Error signing in:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) throw error;
      
      // Manually create profile if user was created successfully
      if (data.user) {
        try {
          const { error: profileError } = await supabase
            .from('profiles')
            .insert({
              id: data.user.id,
              email: data.user.email,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });
          
          if (profileError) {
            console.error('Profile creation failed:', profileError);
            // Don't throw here - the auth user was created successfully
            // Profile can be created later if needed
          }
        } catch (profileError) {
          console.error('Profile creation error:', profileError);
        }
      }
      
      // The auth state change listener will handle setting user and profile
    } catch (error) {
      console.error('Error signing up:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const handleSignInWithGoogle = async () => {
    setLoading(true);
    try {
      await signInWithGoogle();
      // Don't clear loading here - let the auth state change handle it
    } catch (error) {
      console.error('Error signing in with Google:', error);
      setLoading(false); // Only clear loading on error
      throw error;
    }
  };

  const signOut = async () => {
    console.log('🚪 Starting sign-out...');
    
    try {
      console.log('🚪 Calling supabase.auth.signOut()...');
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('🚪 Supabase signOut error:', error);
        throw error;
      }
      
      console.log('🚪 Supabase signOut completed successfully');
      
    } catch (error) {
      console.error('🚪 Sign-out error:', error);
      // Continue with cleanup even if signOut failed
    }
    
    // The auth state change listener will handle the cleanup
    console.log('🚪 Sign-out process complete');
  };


  const refreshProfile = async () => {
    if (user) {
      try {
        const userProfile = await getUserProfile();
        setProfile(userProfile);
      } catch (error) {
        console.error('Error refreshing profile:', error);
      }
    }
  };

  const value: AuthContextType = {
    user,
    profile,
    session,
    loading,
    signIn,
    signUp,
    signInWithGoogle: handleSignInWithGoogle,
    signOut,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};