import { createClient } from '@supabase/supabase-js';
import { Database } from './database.types';

// Temporary hardcoded values for testing
const supabaseUrl = 'https://fppphepgzcxiiobezfow.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZwcHBoZXBnemN4aWlvYmV6Zm93Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI1NDc5NDEsImV4cCI6MjA2ODEyMzk0MX0.h_8rjxPyr7dZ-gpeIDGvTY-30PPsVNO95OestbHek8k';

console.log('🔧 Supabase URL (hardcoded):', supabaseUrl);
console.log('🔧 Supabase key exists:', !!supabaseAnonKey);

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Configure auth options for React Native
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});