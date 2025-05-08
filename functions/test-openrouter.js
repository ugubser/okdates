const { OpenAI } = require('openai');

// API key from the runtime config
const apiKey = "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";
const baseURL = "https://openrouter.ai/api/v1";

// Create a simple fetch function to test the API directly
async function testDirectFetch() {
  console.log('Testing direct fetch to OpenRouter API...');
  
  try {
    const response = await fetch(`${baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://okdates.web.app',
        'X-Title': 'OkDates App',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-4-maverick',
        messages: [
          { role: 'user', content: 'Say hello!' }
        ]
      })
    });
    
    const data = await response.json();
    console.log('Direct fetch response:');
    console.log(JSON.stringify(data, null, 2));
    
    if (data.error) {
      console.error('Error from direct fetch:', data.error);
    }
  } catch (error) {
    console.error('Error with direct fetch:', error);
  }
}

// Test using the OpenAI library
async function testOpenAILibrary() {
  console.log('\nTesting OpenAI library with OpenRouter...');
  
  const openai = new OpenAI({
    apiKey: apiKey,
    baseURL: baseURL,
    defaultHeaders: {
      'HTTP-Referer': 'https://okdates.web.app',
      'X-Title': 'OkDates App'
    }
  });
  
  try {
    const response = await openai.chat.completions.create({
      model: 'meta-llama/llama-4-maverick',
      messages: [
        { role: 'user', content: 'Say hello!' }
      ],
      max_tokens: 50
    });
    
    console.log('OpenAI library response:');
    console.log(JSON.stringify(response, null, 2));
  } catch (error) {
    console.error('Error with OpenAI library:', error);
    
    if (error.response) {
      console.error('Error response:', error.response.data);
    }
  }
}

// Run both tests
async function runTests() {
  await testDirectFetch();
  await testOpenAILibrary();
}

runTests().catch(error => {
  console.error('Test failed:', error);
});