# Google OAuth Setup Guide

This guide will help you set up Google OAuth authentication for the Empart app.

## Prerequisites

- Google Cloud Console account
- Supabase project set up

## Step 1: Create Google OAuth Application

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google+ API:
   - Go to "APIs & Services" > "Library"
   - Search for "Google+ API" and enable it
4. Create OAuth 2.0 credentials:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth 2.0 Client IDs"
   - Select "Web application" as the application type
   - Add authorized redirect URIs:
     - For development: `http://localhost:19006/auth/callback` (Expo web)
     - For production web: `https://your-domain.com/auth/callback`
     - For mobile deep linking: Use custom scheme like `com.yourapp.empart://auth/callback`

## Step 2: Configure Environment Variables

1. Copy your Google OAuth credentials:
   - Client ID
   - Client Secret

2. Add them to your `.env` file:
   ```
   EXPO_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
   EXPO_PUBLIC_GOOGLE_CLIENT_SECRET=your-google-client-secret
   ```

## Step 3: Configure Supabase OAuth (Recommended Approach)

The app is configured to use Supabase's built-in OAuth provider, which is more secure and easier to set up:

1. Go to your Supabase dashboard
2. Navigate to "Authentication" > "Providers"
3. Enable Google provider
4. Add your Google OAuth credentials:
   - Client ID (from Step 1)
   - Client Secret (from Step 1)
5. Set the redirect URL to: `https://your-project-ref.supabase.co/auth/v1/callback`

## Step 4: Configure Redirect URIs in Google Console

Update your Google OAuth app with the correct redirect URIs:

1. Go back to Google Cloud Console > Credentials
2. Edit your OAuth 2.0 Client ID
3. Add these authorized redirect URIs:
   - `https://fppphepgzcxiiobezfow.supabase.co/auth/v1/callback` (your actual Supabase URL)
   - For web development: `http://localhost:19006` 
   - For web development: `http://localhost:8081` 
   - For Expo Go iPhone: `https://auth.expo.io/@christianpowell416/empart` (your Expo Go redirect)
   - For Android emulator: `http://localhost:19006` (should already be added)
   - For Android emulator alt: `http://localhost:8081` (should already be added)

**Important:** 
- The Supabase redirect URL is what Google will use for the OAuth flow
- The localhost URLs are for when you're testing on web during development
- For Expo Go, you need to add the `auth.expo.io` redirect URI with your project slug
- Find your project slug by running `expo whoami` and checking your app.json

## Step 5: Configure App Scheme

Make sure your `app.json` includes the proper scheme for deep linking:

```json
{
  "expo": {
    "scheme": "empart",
    "web": {
      "bundler": "metro"
    }
  }
}
```

## Security Notes

- Never commit your Google Client Secret to version control
- Consider using Supabase's OAuth provider for better security
- Use different OAuth apps for development and production
- Regularly rotate your OAuth credentials

## Troubleshooting

- **"OAuth client not found"**: Check that your Client ID is correct
- **"Redirect URI mismatch"**: Ensure your redirect URIs match exactly
- **"Invalid client"**: Verify your Client Secret is correct
- **Deep linking issues**: Check your app scheme configuration

## Testing

1. Start your development server: `npm start`
2. Navigate to the sign-in page
3. Tap "Continue with Google"
4. Complete the OAuth flow
5. Verify successful authentication

For any issues, check the console logs for detailed error messages.