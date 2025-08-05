# Streaming Chat Edge Function

This Supabase Edge Function provides real-time streaming chat functionality using OpenAI's API with Server-Sent Events (SSE).

## Setup

### 1. Set Environment Variables

First, set your OpenAI API key as a secret in Supabase:

```bash
supabase secrets set OPENAI_API_KEY=your-openai-api-key-here
```

### 2. Deploy the Function

Deploy the edge function to your Supabase project:

```bash
# From the project root directory
supabase functions deploy stream-chat
```

### 3. Test the Function

You can test the function using curl:

```bash
curl -X POST https://your-project.supabase.co/functions/v1/stream-chat \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "Hello, how are you?"}
    ]
  }'
```

## Client Usage

The function expects a POST request with the following body:

```typescript
{
  messages: Array<{
    role: 'system' | 'user' | 'assistant'
    content: string
  }>,
  model?: string,        // Default: 'gpt-4-turbo-preview'
  temperature?: number,  // Default: 0.7
  max_tokens?: number   // Default: 1000
}
```

## Response Format

The function returns Server-Sent Events (SSE) with the following format:

```
data: {"content": "token here"}\n\n
data: {"content": "next token"}\n\n
...
data: [DONE]\n\n
```

Error responses:
```
data: {"error": "error message"}\n\n
```

## Features

- **Real-time Streaming**: Tokens are sent as they're generated
- **Error Handling**: Graceful error handling with proper SSE formatting
- **CORS Support**: Configured for cross-origin requests
- **Abort Support**: Clients can cancel streams using AbortController
- **Clean SSE Format**: Properly formatted Server-Sent Events

## Security

- Uses Supabase authentication (anon key or authenticated user)
- OpenAI API key is stored securely as a Supabase secret
- CORS headers are configured (adjust for production)

## Monitoring

View function logs:
```bash
supabase functions logs stream-chat
```

## Troubleshooting

1. **Function not responding**: Check that OPENAI_API_KEY is set correctly
2. **CORS errors**: Ensure your client origin is allowed in corsHeaders
3. **Authentication errors**: Verify your Supabase anon key is correct
4. **Streaming not working**: Check that client properly handles SSE format