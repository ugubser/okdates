const fs = require('fs');
const path = require('path');

// Load API key from the key file
function loadApiKey() {
  try {
    // Try different key formats
    const keyPaths = [
      path.resolve(__dirname, '../keys/openrouter.key'),
      path.resolve(__dirname, '../keys/openrouter-direct.key')
    ];
    
    for (const keyPath of keyPaths) {
      if (fs.existsSync(keyPath)) {
        const key = fs.readFileSync(keyPath, 'utf8').trim();
        console.log(`Found key at ${keyPath}`);
        
        // For openrouter-direct.key, add the prefix
        if (keyPath.includes('direct')) {
          return 'sk-or-v1-' + key;
        }
        
        return key;
      }
    }
    
    console.error('API key not found at expected locations');
    return null;
  } catch (error) {
    console.error('Error loading API key:', error);
    return null;
  }
}

async function testOpenRouterDirectly() {
  // Load API key
  const apiKey = loadApiKey();
  if (!apiKey) {
    console.error('Cannot proceed without API key');
    process.exit(1);
  }
  
  console.log('Using API key (first 5 chars):', apiKey.substring(0, 5) + '...');
  console.log('API key length:', apiKey.length);
  
  try {
    // Try multiple authorization header formats
    const formats = [
      { name: 'Bearer with space', value: `Bearer ${apiKey}` },
      { name: 'bearer with space', value: `bearer ${apiKey}` },
      { name: 'No space', value: `Bearer${apiKey}` },
      { name: 'Only key', value: apiKey }
    ];
    
    for (const format of formats) {
      console.log(`\nTrying authorization format: ${format.name}`);
      
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': format.value,
          'HTTP-Referer': 'https://okdates.web.app',
          'X-Title': 'OkDates App',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'mistralai/mixtral-8x7b-instruct',
          messages: [
            { role: 'user', content: 'Say hello briefly!' }
          ],
          max_tokens: 30
        })
      });
      
      console.log(`Response status: ${response.status}`);
      if (response.ok) {
        const data = await response.json();
        console.log('Success! Response:', JSON.stringify(data, null, 2));
        
        // If we get a successful response, no need to try other formats
        break;
      } else {
        const errorData = await response.json();
        console.log('Error response:', errorData);
        console.log('Response headers:', response.headers);
      }
    }
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run the test
testOpenRouterDirectly().catch(console.error);