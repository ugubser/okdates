/**
 * Simple test script to verify OpenRouter API key is working
 * 
 * Instructions:
 * 1. Replace the API_KEY value with your OpenRouter key
 * 2. Run with: node test-key.js
 */

const API_KEY = 'YOUR_API_KEY_HERE'; // <-- Replace with your actual API key

async function testOpenRouterKey() {
  console.log('Testing OpenRouter API key...');
  
  if (API_KEY === 'YOUR_API_KEY_HERE') {
    console.error('⚠️ Please replace API_KEY in this file with your actual OpenRouter key');
    process.exit(1);
  }
  
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'HTTP-Referer': 'https://okdates.web.app',
        'X-Title': 'OkDates App',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'mistralai/mixtral-8x7b-instruct',
        messages: [
          { role: 'user', content: 'Say hello in exactly 5 words.' }
        ],
        max_tokens: 30
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ API key is working!');
      console.log('Response:', JSON.stringify(data, null, 2));
    } else {
      const errorData = await response.json();
      console.error('❌ API key is NOT working:');
      console.error(`Status: ${response.status}`);
      console.error('Error:', errorData);
      
      // Print authorization header value (with redacted key)
      const authHeader = `Bearer ${API_KEY.substring(0, 10)}...`;
      console.log('Authorization header used:', authHeader);
    }
  } catch (error) {
    console.error('Error testing API key:', error);
  }
}

// Run the test
testOpenRouterKey().catch(console.error);