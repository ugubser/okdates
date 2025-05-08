import { OpenAI } from 'openai';
import * as fs from 'fs';
import * as path from 'path';
import * as functions from 'firebase-functions';

// Try to get config from Firebase Functions config
let openRouterKey: string | undefined;
let openRouterBaseUrl = 'https://openrouter.ai/api/v1';
let openRouterModel = 'meta-llama/llama-4-maverick';

try {
  // Get from Firebase config
  const config = functions.config();
  if (config.openrouter) {
    console.log('Found OpenRouter config in Firebase Functions config');
    openRouterKey = config.openrouter.api_key;
    openRouterModel = config.openrouter.model || openRouterModel;
  } else {
    console.log('No OpenRouter config found in Firebase Functions config');
  }
} catch (error) {
  console.error('Error accessing Firebase Functions config:', error);
}

// If not found in Firebase config, try process.env
if (!openRouterKey) {
  openRouterKey = process.env.OPENROUTER_API_KEY;
  openRouterBaseUrl = process.env.OPENROUTER_BASE_URL || openRouterBaseUrl;
  openRouterModel = process.env.OPENROUTER_MODEL || openRouterModel;
  
  // For testing, always use hardcoded key in emulator mode
  if (!openRouterKey) {
    console.log('No API key found in environment or Firebase config, using fallback key');
    openRouterKey = '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';
  }
}

// If environment variables aren't set, attempt to load from config file
if (!openRouterKey) {
  try {
    const configPath = path.resolve(__dirname, '../../ai.config.json');
    console.log('Attempting to load AI config from:', configPath);
    if (fs.existsSync(configPath)) {
      const configData = fs.readFileSync(configPath, 'utf8');
      const aiConfig = JSON.parse(configData);
      console.log('AI configuration successfully loaded from file');
      
      if (aiConfig.openRouter && aiConfig.openRouter.key) {
        openRouterKey = aiConfig.openRouter.key;
        openRouterBaseUrl = aiConfig.openRouter.baseUrl || openRouterBaseUrl;
        openRouterModel = aiConfig.openRouter.model || openRouterModel;
      }
    } else {
      console.warn('AI config file not found:', configPath);
    }
  } catch (error) {
    console.error('Error loading AI config from file:', error);
  }
}

// Log API key status (safely without revealing the key)
if (openRouterKey) {
  console.log('OpenRouter API key is configured (starts with:', openRouterKey.substring(0, 5) + '...)');
} else {
  console.error('No OpenRouter API key found in environment variables or config file!');
}

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: openRouterKey,
  baseURL: openRouterBaseUrl,
  defaultHeaders: {
    'HTTP-Referer': 'https://okdates.web.app', // Required for OpenRouter
    'X-Title': 'OkDates App', // Required for OpenRouter
    'Authorization': `Bearer ${openRouterKey}` // Ensure Bearer token format
  }
});

// Log initialization for debugging
console.log(`OpenAI client initialized with baseURL: ${openRouterBaseUrl}`);
if (!openRouterKey) {
  console.error('ERROR: OpenRouter API key is missing!');
} else {
  console.log('Using OpenRouter API key:', openRouterKey.substring(0, 10) + '...');
}

/**
 * Parses dates using an LLM
 * @param rawInput The raw text input containing dates
 * @returns Array of parsed dates
 */
export async function parseDatesWithLLM(rawInput: string): Promise<{
  title: string;
  dates: {
    originalText: string;
    timestamp: {
      seconds: number;
      nanoseconds: number;
    };
    isConfirmed: boolean;
  }[];
}> {
  console.log('Parsing dates with LLM:', rawInput);
  
  try {
    // Prepare the prompt
    const messages = [
      {
        role: 'system',
        content: 'You are a helpful executive assistant that knows all about schedules and dates.'
      },
      {
        role: 'user',
        content: `Interpret the raw input from the user and determine which dates are relevant.
Your response MUST be in valid JSON format with this exact structure:
{
  "title": "Available Dates for User",
  "available_dates": ["YYYY-MM-DD", "YYYY-MM-DD", "YYYY-MM-DD"]
}

Important: Format all dates in ISO format (YYYY-MM-DD).
Be flexible with date interpretations. For example, "next Monday" should resolve to the actual date.
Handle ranges like "June 2-4" as individual dates (June 2, June 3, June 4).
If a year is not specified, assume the current year.

Here is the raw input: 
${rawInput}`
      }
    ];
    
    // Call the LLM API
    console.log('Calling OpenRouter API with model:', openRouterModel);
    console.log('Request payload:', {
      model: openRouterModel,
      messages,
      response_format: { 
        type: 'json_schema',
        json_schema: {
          name: 'date_parser',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              title: {
                type: 'string',
                description: 'Title for the available dates'
              },
              available_dates: {
                type: 'array',
                description: 'Array of dates in ISO format (YYYY-MM-DD)',
                items: { type: 'string', format: 'date' }
              }
            },
            required: ['title', 'available_dates'],
            additionalProperties: false
          }
        }
      },
      temperature: 0.2
    });
    
    const response = await openai.chat.completions.create({
      model: openRouterModel,
      messages: messages as any,
      response_format: { 
        type: 'json_schema',
        json_schema: {
          name: 'date_parser',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              title: {
                type: 'string',
                description: 'Title for the available dates'
              },
              available_dates: {
                type: 'array',
                description: 'Array of dates in ISO format (YYYY-MM-DD)',
                items: { type: 'string', format: 'date' }
              }
            },
            required: ['title', 'available_dates'],
            additionalProperties: false
          }
        }
      },
      temperature: 0.2, // Lower temperature for more consistent results
      max_tokens: 1000,
    });
    
    console.log('LLM response received');
    
    // Parse the JSON response
    const content = response.choices[0]?.message?.content || '';
    console.log('Raw content:', content);
    
    try {
      const parsedContent = JSON.parse(content);
      console.log('Parsed content:', parsedContent);
      
      // Transform the dates into the expected format
      const dates = parsedContent.available_dates?.map((dateStr: string) => {
        const date = new Date(dateStr);
        return {
          originalText: dateStr,
          timestamp: {
            seconds: Math.floor(date.getTime() / 1000),
            nanoseconds: 0
          },
          isConfirmed: false
        };
      }) || [];
      
      return {
        title: parsedContent.title || 'Available Dates',
        dates: dates.filter((date: any) => !isNaN(date.timestamp.seconds))
      };
    } catch (parseError) {
      console.error('Error parsing LLM response:', parseError);
      throw new Error('Invalid response format from LLM');
    }
  } catch (error) {
    console.error('Error calling LLM service:', error);
    throw error;
  }
}