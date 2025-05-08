const { OpenAI } = require('openai');
const fs = require('fs');
const path = require('path');

// Load API key from the key file
function loadApiKey() {
  try {
    const keyPath = path.resolve(__dirname, '../keys/openrouter.key');
    if (fs.existsSync(keyPath)) {
      return fs.readFileSync(keyPath, 'utf8').trim();
    }
    
    // Fallback: try to load from config
    const configPath = path.resolve(__dirname, './ai.config.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (config.openRouter && config.openRouter.key) {
        return config.openRouter.key;
      }
    }
    
    console.error('API key not found. Please run ./start-emulator.sh first');
    return 'YOUR_API_KEY_REQUIRED';
  } catch (error) {
    console.error('Error loading API key:', error);
    return 'ERROR_LOADING_API_KEY';
  }
}

// API key from the key file
const apiKey = loadApiKey();
const baseURL = "https://openrouter.ai/api/v1";

// Create a simple fetch function to test the API directly
async function testDirectFetch() {
  console.log('Testing direct fetch to OpenRouter API...');
  console.log('Using API key (first 10 chars):', apiKey.substring(0, 10) + '...');
  
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
    
    // Log the full request and response for debugging
    console.log('Request headers:', {
      'Authorization': `Bearer ${apiKey.substring(0, 10)}...`,
      'HTTP-Referer': 'https://okdates.web.app',
      'X-Title': 'OkDates App',
      'Content-Type': 'application/json'
    });
    
    const data = await response.json();
    console.log('Direct fetch response:');
    console.log(JSON.stringify(data, null, 2));
    console.log('Response status:', response.status);
    console.log('Response headers:', response.headers);
    
    if (data.error) {
      console.error('Error from direct fetch:', data.error);
    }
  } catch (error) {
    console.error('Error with direct fetch:', error);
  }
}

// Test using the OpenAI library with direct API key
async function testOpenAILibrary() {
  console.log('\nTesting OpenAI library with OpenRouter...');
  
  // Use the API key directly - no defaultHeaders with Authorization
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