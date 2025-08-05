#!/usr/bin/env node

// Test if Supabase functions are accessible
const fetch = require('node-fetch')

async function testFunction(functionName, supabaseUrl, anonKey) {
  const url = `${supabaseUrl}/functions/v1/${functionName}`
  
  console.log(`Testing ${functionName} at: ${url}`)
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${anonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ test: true })
    })
    
    console.log(`Status: ${response.status}`)
    
    if (response.status === 404) {
      console.log(`❌ Function ${functionName} not found - needs to be deployed`)
    } else if (response.status === 500) {
      console.log(`⚠️ Function ${functionName} exists but has an error (likely missing OpenAI API key)`)
    } else {
      const text = await response.text()
      console.log(`Response: ${text}`)
    }
  } catch (error) {
    console.error(`Error testing ${functionName}:`, error.message)
  }
  
  console.log('---')
}

async function main() {
  const supabaseUrl = 'https://fppphepgzcxiiobezfow.supabase.co'
  const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZwcHBoZXBnemN4aWlvYmV6Zm93Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI1NDc5NDEsImV4cCI6MjA2ODEyMzk0MX0.h_8rjxPyr7dZ-gpeIDGvTY-30PPsVNO95OestbHek8k'
  
  await testFunction('transcribe', supabaseUrl, anonKey)
  await testFunction('chat-stream', supabaseUrl, anonKey)
}

main().catch(console.error)