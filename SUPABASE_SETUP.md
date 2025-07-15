# Supabase Setup Instructions

## Overview
Your Empart app is now fully integrated with Supabase! The codebase includes complete authentication flows, database services, and data management. Follow these steps to complete the setup.

## Required Steps

### 1. Create Supabase Project
1. Go to [supabase.com](https://supabase.com) and sign up/sign in
2. Create a new project
3. Choose your organization and project name
4. Select a database region (choose closest to your users)
5. Set a secure database password
6. Wait for the project to be created

### 2. Get Project Credentials
1. Go to your project dashboard
2. Navigate to Settings → API
3. Copy the following:
   - **Project URL** (something like `https://your-project-id.supabase.co`)
   - **Anon public key** (starts with `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`)

### 3. Set Environment Variables
1. In your project root, copy the example environment file:
   ```bash
   cp .env.example .env
   ```
2. Edit the `.env` file and add your Supabase credentials:
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

### 4. Run Database Schema
1. In your Supabase project dashboard, go to the SQL Editor
2. Open the file `database/schema.sql` from your project
3. Copy and paste the entire contents into the SQL Editor
4. Click "Run" to execute the schema

This will create:
- `profiles` table for user information
- `emotions` table for storing emotional data
- Row Level Security (RLS) policies for data protection
- Necessary indexes and constraints

### 5. Test the Integration
1. Start your development server:
   ```bash
   npm start
   ```
2. The app will now show authentication screens
3. Try signing up with a test email
4. Check your email for verification (if enabled)
5. Sign in and test the emotion list functionality

## Features Implemented

### Authentication
- ✅ Sign up with email/password
- ✅ Sign in with email/password
- ✅ Sign out functionality
- ✅ Automatic authentication state management
- ✅ Protected routes (requires authentication)

### Database Integration
- ✅ User profiles with automatic creation
- ✅ Emotions CRUD operations (Create, Read, Update, Delete)
- ✅ Real-time data synchronization
- ✅ Sorting and filtering
- ✅ Row Level Security for data protection

### UI Components
- ✅ Authentication screens (Sign in/Sign up)
- ✅ Emotions list with Supabase data
- ✅ Fallback to sample data when not authenticated
- ✅ Loading states and error handling
- ✅ Sign out button in profile

## Database Schema

### Tables Created:
1. **profiles** - User profile information
2. **emotions** - Emotional data with 3-axis coordinates

### Security:
- Row Level Security (RLS) enabled
- Users can only access their own data
- Automatic user profile creation via trigger

## Next Steps
1. Complete the setup steps above
2. Test the authentication flow
3. Add real emotional data
4. Customize the UI further as needed
5. Deploy to app stores when ready

## Troubleshooting
- If you get environment variable errors, make sure `.env` file exists and has correct values
- If authentication doesn't work, check your Supabase project URL and anon key
- If database operations fail, ensure the schema was executed successfully
- Check the Supabase dashboard logs for any errors

## Support
- Supabase documentation: [docs.supabase.com](https://docs.supabase.com)
- React Native integration: [supabase.com/docs/guides/getting-started/quickstarts/react-native](https://supabase.com/docs/guides/getting-started/quickstarts/react-native)