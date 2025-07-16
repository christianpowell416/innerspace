import { supabase } from '../supabase';
import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import Constants from 'expo-constants';

// Complete the auth session for web
if (Platform.OS === 'web') {
  WebBrowser.maybeCompleteAuthSession();
}

export const signInWithGoogle = async (): Promise<void> => {
  try {
    const isExpoGo = Constants.appOwnership === 'expo';
    
    let redirectTo: string;
    
    if (Platform.OS === 'web') {
      redirectTo = `${window.location.origin}`;
    } else if (isExpoGo) {
      redirectTo = makeRedirectUri({ 
        scheme: undefined,
        preferLocalhost: true 
      });
    } else {
      redirectTo = makeRedirectUri({ scheme: 'empart' });
    }

    console.log('Starting Google OAuth with redirect:', redirectTo);

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });

    if (error) {
      console.error('Supabase OAuth error:', error);
      throw error;
    }
    
    console.log('OAuth initiated, data:', { hasUrl: !!data?.url, provider: data?.provider });
    
    if (Platform.OS !== 'web' && data?.url) {
      console.log('Opening auth session...');
      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        redirectTo
      );
      
      console.log('WebBrowser result:', result);
      
      if (result.type === 'cancel') {
        throw new Error('Google sign-in was cancelled');
      } else if (result.type !== 'success') {
        throw new Error('Google sign-in failed');
      }
      
      console.log('OAuth flow completed successfully');
      
      // For mobile platforms, we need to handle the session manually
      if (result.url && isExpoGo) {
        console.log('Processing OAuth result URL for session...');
        try {
          // Parse the URL fragments to extract tokens
          const url = new URL(result.url);
          const fragment = url.hash.substring(1); // Remove the # character
          const params = new URLSearchParams(fragment);
          
          const accessToken = params.get('access_token');
          const refreshToken = params.get('refresh_token');
          
          if (accessToken && refreshToken) {
            console.log('Setting session with tokens...');
            const { data, error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            
            if (error) {
              console.error('Error setting session:', error);
              throw error;
            }
            
            console.log('Session set successfully:', data.user?.email);
          } else {
            console.warn('No tokens found in OAuth result URL');
          }
        } catch (urlError) {
          console.error('Error processing OAuth URL:', urlError);
          // Don't throw here, let the auth state listener handle it
        }
      }
    }
  } catch (error) {
    console.error('Google sign-in error:', error);
    throw error;
  }
};