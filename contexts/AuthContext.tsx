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

// Development auto-login configuration
// Set credentials in .env.local file: EXPO_PUBLIC_DEV_EMAIL and EXPO_PUBLIC_DEV_PASSWORD
const DEV_EMAIL = process.env.EXPO_PUBLIC_DEV_EMAIL || '';
const DEV_PASSWORD = process.env.EXPO_PUBLIC_DEV_PASSWORD || '';
const DEV_AUTO_LOGIN = __DEV__ && DEV_EMAIL && DEV_PASSWORD; // Auto-enable if credentials are provided

// Helper function for dev auto-login
const performDevAutoLogin = async () => {
  if (!DEV_EMAIL || !DEV_PASSWORD) {
    console.log('⚠️ DEV MODE: No auto-login credentials provided in .env.local');
    console.log('💡 TIP: Add EXPO_PUBLIC_DEV_EMAIL and EXPO_PUBLIC_DEV_PASSWORD to .env.local');
    return null;
  }

  console.log('🚀 DEV MODE: Attempting auto-login with:', DEV_EMAIL);
  console.log('🔐 DEV MODE: Password length:', DEV_PASSWORD.length, 'chars');

  // Debug: Check if password is being read correctly
  if (DEV_PASSWORD.includes('^')) {
    console.log('⚠️ DEV MODE: Password contains special characters');
  }

  try {
    // Try to sign in with provided credentials
    const { data: authData, error } = await supabase.auth.signInWithPassword({
      email: DEV_EMAIL.trim(),
      password: DEV_PASSWORD.trim(),
    });

    if (error) {
      console.error('❌ DEV MODE: Auto-login failed:', error.message);
      console.log('💡 TIP: Make sure the account exists and credentials are correct in .env.local');

      // Try with hardcoded credentials as a fallback test
      if (DEV_EMAIL === 'christianpowell416@gmail.com') {
        console.log('🔄 DEV MODE: Trying alternative login method...');
        // You can temporarily hardcode and test here if needed
      }

      return null;
    }

    console.log('✅ DEV MODE: Auto-login successful!');
    return authData.session;
  } catch (err) {
    console.error('❌ DEV MODE: Unexpected error during auto-login:', err);
    return null;
  }
};

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);


  // Load initial session with dev auto-login
  useEffect(() => {
    const getInitialSession = async () => {
      console.log('🔍 Checking for existing session...');

      try {
        const { data: { session: existingSession } } = await supabase.auth.getSession();
        console.log('📋 Existing session:', existingSession ? 'Found' : 'Not found');

        // Force auto-login in development mode
        if (DEV_AUTO_LOGIN) {
          console.log('🚀 DEV MODE: Auto-login enabled');

          // Even if there's a session, check if it's valid
          if (existingSession) {
            console.log('🔄 DEV MODE: Session exists, validating...');
            // Try to get user to validate session
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
              console.log('✅ DEV MODE: Session is valid for:', user.email);
              setSession(existingSession);
              setUser(user);

              // Load profile
              try {
                const userProfile = await getUserProfileForUser(user);
                setProfile(userProfile);
              } catch (profileError) {
                console.error('Error loading profile:', profileError);
                setProfile(null);
              }

              setLoading(false);
              return;
            } else {
              console.log('⚠️ DEV MODE: Session invalid, clearing and re-logging...');
              await supabase.auth.signOut();
            }
          }

          // Perform auto-login
          const autoSession = await performDevAutoLogin();
          if (autoSession) {
            setSession(autoSession);
            setUser(autoSession.user);

            // Load profile
            try {
              const userProfile = await getUserProfileForUser(autoSession.user);
              setProfile(userProfile);
            } catch (profileError) {
              console.error('Error loading profile after auto-login:', profileError);
              setProfile(null);
            }
          } else {
            console.log('⚠️ DEV MODE: Auto-login failed, proceeding without session');
            setSession(null);
            setUser(null);
            setProfile(null);
          }
        } else {
          // Normal session handling when auto-login is disabled
          setSession(existingSession);
          setUser(existingSession?.user ?? null);

          if (existingSession?.user) {
            try {
              const userProfile = await getUserProfile();
              setProfile(userProfile);
            } catch (error) {
              console.error('Error loading user profile:', error);
              setProfile(null);
            }
          }
        }
      } catch (error) {
        console.error('❌ Error in getInitialSession:', error);

        // If there's an error but dev mode is on, try auto-login anyway
        if (DEV_AUTO_LOGIN) {
          const autoSession = await performDevAutoLogin();
          if (autoSession) {
            setSession(autoSession);
            setUser(autoSession.user);
          }
        }
      } finally {
        console.log('🏁 Initial session loading complete');
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
      console.log('🔧 AuthContext: Attempting Supabase sign in');
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      console.log('🔧 AuthContext: Supabase response data:', !!data);
      console.log('🔧 AuthContext: Supabase response error:', error);

      if (error) throw error;
      
      // The auth state change listener will handle setting user and profile
    } catch (error) {
      console.error('🔧 AuthContext: Error signing in:', error);
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