import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface ChatRequest {
  messages: ChatMessage[]
  model?: string
  temperature?: number
  max_tokens?: number
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Validate request method
    if (req.method !== 'POST') {
      throw new Error('Method not allowed. Use POST.')
    }

    // Parse request body
    const body: ChatRequest = await req.json()
    
    if (!body.messages || !Array.isArray(body.messages)) {
      throw new Error('Messages array is required')
    }

    if (!OPENAI_API_KEY) {
      throw new Error('OpenAI API key not configured')
    }

    // Create a readable stream for SSE
    const encoder = new TextEncoder()
    const stream = new TransformStream()
    const writer = stream.writable.getWriter()

    // Start the OpenAI streaming request
    const openAIRequest = fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: body.model || 'gpt-4-turbo-preview',
        messages: body.messages,
        temperature: body.temperature ?? 0.7,
        max_tokens: body.max_tokens ?? 1000,
        stream: true,
      }),
    })

    // Process the streaming response
    openAIRequest.then(async (response) => {
      if (!response.ok) {
        const error = await response.text()
        await writer.write(encoder.encode(`data: {"error": "${error}"}\n\n`))
        await writer.close()
        return
      }

      const reader = response.body?.getReader()
      if (!reader) {
        await writer.write(encoder.encode(`data: {"error": "No response body"}\n\n`))
        await writer.close()
        return
      }

      const decoder = new TextDecoder()
      let buffer = ''

      try {
        while (true) {
          const { done, value } = await reader.read()
          
          if (done) {
            break
          }

          // Decode the chunk and add to buffer
          buffer += decoder.decode(value, { stream: true })
          
          // Process complete SSE messages from buffer
          const lines = buffer.split('\n')
          buffer = lines.pop() || '' // Keep incomplete line in buffer

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim()
              
              if (data === '[DONE]') {
                // Send completion signal
                await writer.write(encoder.encode('data: [DONE]\n\n'))
                break
              }

              try {
                const json = JSON.parse(data)
                const content = json.choices?.[0]?.delta?.content
                
                if (content) {
                  // Forward the content token
                  await writer.write(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`))
                }
              } catch (e) {
                // Skip invalid JSON
                console.error('Failed to parse chunk:', e)
              }
            }
          }
        }
      } catch (error) {
        console.error('Stream processing error:', error)
        await writer.write(encoder.encode(`data: {"error": "${error.message}"}\n\n`))
      } finally {
        await writer.close()
      }
    }).catch(async (error) => {
      console.error('OpenAI request error:', error)
      await writer.write(encoder.encode(`data: {"error": "${error.message}"}\n\n`))
      await writer.close()
    })

    // Return SSE response
    return new Response(stream.readable, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })

  } catch (error) {
    console.error('Request error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})