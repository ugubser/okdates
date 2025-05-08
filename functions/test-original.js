/**
 * Test script using the exact same configuration that worked previously
 */

const { OpenAI } = require('openai');

// This is the key that worked before
const apiKey = "";
const baseURL = "https://openrouter.ai/api/v1";

// Initialize client exactly as it was working before
const openai = new OpenAI({
  apiKey: apiKey,
  baseURL: baseURL,
  defaultHeaders: {
    'HTTP-Referer': 'https://okdates.web.app',
    'X-Title': 'OkDates App'
  }
});

async function testOriginalConfig() {
  console.log('Testing with original working configuration...');
  console.log('Using API key (first 10 chars):', apiKey.substring(0, 10) + '...');
  
  try {
    const response = await openai.chat.completions.create({
      model: 'meta-llama/llama-4-maverick:free',
      messages: [
        { role: 'user', content: 'Say hello!' }
      ],
      max_tokens: 50
    });
    
    console.log('✅ Success! Response:');
    console.log(JSON.stringify(response, null, 2));
  } catch (error) {
    console.error('❌ Error with OpenAI library:');
    console.error(error.message);
    
    if (error.response) {
      console.error('Error response:', error.response.data);
    }
    
    // Now try direct fetch for comparison
    console.log('\nTrying direct fetch instead...');
    
    try {
      const fetchResponse = await fetch(`${baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://okdates.web.app',
          'X-Title': 'OkDates App',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'meta-llama/llama-4-maverick:free',
          messages: [
            { role: 'user', content: 'Say hello!' }
          ],
          max_tokens: 50
        })
      });
      
      if (fetchResponse.ok) {
        const data = await fetchResponse.json();
        console.log('✅ Direct fetch succeeded!');
        console.log(JSON.stringify(data, null, 2));
      } else {
        const errorData = await fetchResponse.json();
        console.error('❌ Direct fetch also failed:');
        console.error(`Status: ${fetchResponse.status}`);
        console.error('Error:', errorData);
      }
    } catch (fetchError) {
      console.error('Error with direct fetch:', fetchError);
    }
  }
}

testOriginalConfig().catch(console.error);