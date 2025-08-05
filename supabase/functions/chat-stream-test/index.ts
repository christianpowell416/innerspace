import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('🧪 Test function called')
    
    const body = await req.json()
    console.log('📝 Received payload:', JSON.stringify(body, null, 2))
    
    // Create a simple test stream response
    const encoder = new TextEncoder()
    const stream = new TransformStream()
    const writer = stream.writable.getWriter()
    
    // Send test data
    await writer.write(encoder.encode(`data: ${JSON.stringify({
      type: 'text',
      content: 'Hello! This is a test response.'
    })}\n\n`))
    
    await writer.write(encoder.encode(`data: ${JSON.stringify({
      type: 'audio',
      audio: 'dGVzdA==', // base64 for "test"
      format: 'mp3'
    })}\n\n`))
    
    await writer.write(encoder.encode('data: [DONE]\n\n'))
    await writer.close()
    
    console.log('✅ Test response sent')
    
    return new Response(stream.readable, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })

  } catch (error) {
    console.error('❌ Test function error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})