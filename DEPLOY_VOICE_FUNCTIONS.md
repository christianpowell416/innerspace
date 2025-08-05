# 🚀 Deploy Voice Chat Functions to Supabase

## Step 1: Get Supabase Access Token

1. Go to: https://app.supabase.com/account/tokens
2. Click "Generate new token"
3. Name it "Voice Chat Functions"
4. Copy the token

## Step 2: Set Environment Variables

In your terminal/command prompt, set:

```bash
# Windows
set SUPABASE_ACCESS_TOKEN=your-token-here

# Mac/Linux
export SUPABASE_ACCESS_TOKEN=your-token-here
```

## Step 3: Set OpenAI API Key in Supabase

```bash
npx supabase secrets set OPENAI_API_KEY=your-openai-api-key-here
```

## Step 4: Link Project

```bash
npx supabase link --project-ref fppphepgzcxiiobezfow
```

## Step 5: Deploy Functions

```bash
# Deploy transcription function
npx supabase functions deploy transcribe

# Deploy voice streaming function  
npx supabase functions deploy chat-stream
```

## Step 6: Test Functions

Run this test script to verify deployment:

```bash
node test-functions.js
```

You should see:
- `transcribe: 200` (or 500 with error message)
- `chat-stream: 200` (or 500 with error message)

## Alternative: Manual Deployment via Dashboard

If CLI doesn't work:

1. Go to: https://app.supabase.com/project/fppphepgzcxiiobezfow/functions
2. Click "Create a new function"
3. Name: `transcribe`
4. Copy code from `supabase/functions/transcribe/index.ts`
5. Click "Deploy function"
6. Repeat for `chat-stream`

## Step 7: Update Client Code

Once deployed, I'll update the voice service to use the real functions with OpenAI voice streaming.