const https = require('https');

const functions = ['stream-chat', 'chat-stream', 'transcribe', 'hello-world'];
const baseUrl = 'fppphepgzcxiiobezfow.supabase.co';
const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZwcHBoZXBnemN4aWlvYmV6Zm93Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI1NDc5NDEsImV4cCI6MjA2ODEyMzk0MX0.h_8rjxPyr7dZ-gpeIDGvTY-30PPsVNO95OestbHek8k';

async function testFunction(funcName) {
  return new Promise((resolve) => {
    const postData = JSON.stringify({ test: true });
    
    const options = {
      hostname: baseUrl,
      port: 443,
      path: `/functions/v1/${funcName}`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      console.log(`${funcName}: ${res.statusCode}`);
      resolve(res.statusCode);
    });

    req.on('error', (e) => {
      console.log(`${funcName}: ERROR - ${e.message}`);
      resolve('ERROR');
    });

    req.write(postData);
    req.end();
  });
}

async function testAll() {
  console.log('Testing Supabase Edge Functions...');
  for (const func of functions) {
    await testFunction(func);
  }
}

testAll();