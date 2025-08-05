import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ChatStreamRequest {
  messages: Array<{
    role: 'system' | 'user' | 'assistant'
    content: string
  }>
  voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer'
  model?: string
  temperature?: number
  max_tokens?: number
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (req.method !== 'POST') {
      throw new Error('Method not allowed. Use POST.')
    }

    if (!OPENAI_API_KEY) {
      throw new Error('OpenAI API key not configured')
    }

    const body: ChatStreamRequest = await req.json()
    
    if (!body.messages || !Array.isArray(body.messages)) {
      throw new Error('Messages array is required')
    }

    const encoder = new TextEncoder()
    const stream = new TransformStream()
    const writer = stream.writable.getWriter()

    // Use regular streaming for now since audio modalities may not be available
    const requestBody = {
      model: body.model || 'gpt-4-turbo-preview',
      messages: body.messages,
      temperature: body.temperature ?? 0.7,
      max_tokens: body.max_tokens ?? 1000,
      stream: true,
    }

    console.log('🚀 Making OpenAI request with:', JSON.stringify(requestBody, null, 2))

    // Start the OpenAI streaming request
    const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })

    console.log('📡 OpenAI response status:', openAIResponse.status)

    if (!openAIResponse.ok) {
      const error = await openAIResponse.text()
      console.error('❌ OpenAI error:', error)
      await writer.write(encoder.encode(`data: {"error": "OpenAI API error: ${error}"}\n\n`))
      await writer.close()
      return new Response(stream.readable, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      })
    }

    const reader = openAIResponse.body?.getReader()
    if (!reader) {
      console.error('❌ No response body from OpenAI')
      await writer.write(encoder.encode(`data: {"error": "No response body from OpenAI"}\n\n`))
      await writer.close()
      return new Response(stream.readable, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      })
    }

    console.log('✅ Got response reader, starting to process stream...')

    const decoder = new TextDecoder()
    let buffer = ''
    let responseText = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        
        if (done) {
          console.log('📝 Stream completed, response length:', responseText.length)
          
          // Generate audio using TTS as fallback
          if (responseText.trim() && body.voice) {
            console.log('🔊 Generating TTS audio for response...')
            try {
              const ttsResponse = await fetch('https://api.openai.com/v1/audio/speech', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${OPENAI_API_KEY}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  model: 'tts-1',
                  input: responseText,
                  voice: body.voice || 'nova',
                  response_format: 'mp3'
                }),
              })

              if (ttsResponse.ok) {
                const audioBuffer = await ttsResponse.arrayBuffer()
                const audioBase64 = btoa(String.fromCharCode(...new Uint8Array(audioBuffer)))
                
                await writer.write(encoder.encode(`data: ${JSON.stringify({
                  type: 'audio',
                  audio: audioBase64,
                  format: 'mp3'
                })}\n\n`))
                
                console.log('🎵 TTS audio generated and sent')
              }
            } catch (ttsError) {
              console.error('⚠️ TTS generation failed:', ttsError)
            }
          }
          
          await writer.write(encoder.encode('data: [DONE]\n\n'))
          break
        }

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim()
            
            if (data === '[DONE]') {
              continue // We'll handle this after the loop
            }

            try {
              const json = JSON.parse(data)
              const content = json.choices?.[0]?.delta?.content
              
              if (content) {
                responseText += content
                await writer.write(encoder.encode(`data: ${JSON.stringify({
                  type: 'text',
                  content: content
                })}\n\n`))
              }
            } catch (e) {
              console.warn('Failed to parse chunk:', e)
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