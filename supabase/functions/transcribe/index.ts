import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TranscriptionRequest {
  audio: string // Base64 encoded audio
  format?: string // Audio format (wav, mp3, etc.)
  language?: string // Optional language hint
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

    const body: TranscriptionRequest = await req.json()
    
    if (!body.audio) {
      throw new Error('Audio data is required')
    }

    // Convert base64 to blob
    const audioBuffer = Uint8Array.from(atob(body.audio), c => c.charCodeAt(0))
    const audioBlob = new Blob([audioBuffer], { 
      type: `audio/${body.format || 'wav'}` 
    })

    // Create form data for Whisper API
    const formData = new FormData()
    formData.append('file', audioBlob, `audio.${body.format || 'wav'}`)
    formData.append('model', 'whisper-1')
    
    if (body.language) {
      formData.append('language', body.language)
    }

    // Call OpenAI Whisper API
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: formData,
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Whisper API error: ${error}`)
    }

    const transcription = await response.json()

    return new Response(
      JSON.stringify({
        success: true,
        text: transcription.text,
        language: transcription.language,
      }),
      {
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        },
      }
    )

  } catch (error) {
    console.error('Transcription error:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      {
        status: 400,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        },
      }
    )
  }
})