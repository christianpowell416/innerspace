#!/usr/bin/env node

// Simple function deployment script using Supabase Management API
const fs = require('fs')
const path = require('path')

async function deployFunction(functionName, functionCode, projectRef, accessToken) {
  const url = `https://api.supabase.com/v1/projects/${projectRef}/functions`
  
  const payload = {
    slug: functionName,
    name: functionName,
    source_code: functionCode,
    verify_jwt: false,
    import_map: {},
    entrypoint: 'index.ts'
  }
  
  console.log(`Deploying function: ${functionName}`)
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    })
    
    if (response.ok) {
      console.log(`✅ Successfully deployed ${functionName}`)
    } else {
      const error = await response.text()
      console.error(`❌ Failed to deploy ${functionName}:`, error)
    }
  } catch (error) {
    console.error(`❌ Error deploying ${functionName}:`, error.message)
  }
}

async function main() {
  const projectRef = 'fppphepgzcxiiobezfow'
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN
  
  if (!accessToken) {
    console.error('❌ SUPABASE_ACCESS_TOKEN environment variable is required')
    console.log('Please get your access token from: https://app.supabase.com/account/tokens')
    process.exit(1)
  }
  
  // Read function files
  const transcribeCode = fs.readFileSync(path.join(__dirname, 'supabase/functions/transcribe/index.ts'), 'utf8')
  const chatStreamCode = fs.readFileSync(path.join(__dirname, 'supabase/functions/chat-stream/index.ts'), 'utf8')
  
  // Deploy functions
  await deployFunction('transcribe', transcribeCode, projectRef, accessToken)
  await deployFunction('chat-stream', chatStreamCode, projectRef, accessToken)
}

main().catch(console.error)