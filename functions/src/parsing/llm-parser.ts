import { OpenAI } from 'openai';
import * as fs from 'fs';
import * as path from 'path';
import * as functions from 'firebase-functions';

// Default values
let openRouterKey: string | undefined;
let openRouterBaseUrl = 'https://openrouter.ai/api/v1';
let openRouterModel = 'meta-llama/llama-4-maverick';

/**
 * Load API key from various sources in priority order:
 * 1. Firebase Functions config
 * 2. Environment variables
 * 3. External key file
 * 4. ai.config.json file
 */
function loadApiKey(): string | undefined {
  // Check for key in multiple locations in priority order
  let key = loadKeyFromFirebaseFunctionsConfig();
  if (key) return key;
  
  key = loadKeyFromEnvironmentVariables();
  if (key) return key;
  
  key = loadKeyFromExternalFile();
  if (key) return key;
  
  key = loadKeyFromConfigFile();
  if (key) return key;
  
  console.error('Could not find OpenRouter API key in any location!');
  return undefined;
}

// 1. Try to get config from Firebase Functions config
function loadKeyFromFirebaseFunctionsConfig(): string | undefined {
  try {
    const config = functions.config();
    if (config.openrouter && config.openrouter.api_key) {
      console.log('Found OpenRouter config in Firebase Functions config');
      openRouterModel = config.openrouter.model || openRouterModel;
      return config.openrouter.api_key;
    } else {
      console.log('No OpenRouter config found in Firebase Functions config');
    }
  } catch (error) {
    console.error('Error accessing Firebase Functions config:', error);
  }
  return undefined;
}

// 2. Check environment variables
function loadKeyFromEnvironmentVariables(): string | undefined {
  const key = process.env.OPENROUTER_API_KEY;
  if (key) {
    console.log('Using OpenRouter API key from environment variables');
    openRouterBaseUrl = process.env.OPENROUTER_BASE_URL || openRouterBaseUrl;
    openRouterModel = process.env.OPENROUTER_MODEL || openRouterModel;
    return key;
  }
  return undefined;
}

// 3. Try to load from dedicated key file
function loadKeyFromExternalFile(): string | undefined {
  try {
    // Look for key file in project root directory
    const keyPaths = [
      path.resolve(__dirname, '../../../keys/openrouter.key'),
      path.resolve(__dirname, '../../keys/openrouter.key'),
      path.resolve(__dirname, '../../../openrouter.key')
    ];
    
    for (const keyPath of keyPaths) {
      if (fs.existsSync(keyPath)) {
        console.log('Loading API key from key file:', keyPath);
        const key = fs.readFileSync(keyPath, 'utf8').trim();
        if (key && key !== 'YOUR_OPENROUTER_API_KEY_HERE') {
          return key;
        }
      }
    }
  } catch (error) {
    console.error('Error loading API key from key file:', error);
  }
  return undefined;
}

// 4. Try to load from config file
function loadKeyFromConfigFile(): string | undefined {
  try {
    const configPaths = [
      path.resolve(__dirname, '../../ai.config.json'),
      path.resolve(__dirname, '../../../ai.config.json')
    ];
    
    for (const configPath of configPaths) {
      if (fs.existsSync(configPath)) {
        console.log('Loading AI config from:', configPath);
        const configData = fs.readFileSync(configPath, 'utf8');
        const aiConfig = JSON.parse(configData);
        
        if (aiConfig.openRouter && aiConfig.openRouter.key) {
          openRouterBaseUrl = aiConfig.openRouter.baseUrl || openRouterBaseUrl;
          openRouterModel = aiConfig.openRouter.model || openRouterModel;
          return aiConfig.openRouter.key;
        }
      }
    }
    console.warn('No valid AI config file found with API key');
  } catch (error) {
    console.error('Error loading AI config from file:', error);
  }
  return undefined;
}

// Load the API key
openRouterKey = loadApiKey();

// Log API key status (safely without revealing the key)
if (openRouterKey) {
  console.log('OpenRouter API key is configured (starts with:', openRouterKey.substring(0, 5) + '...)');
} else {
  console.error('No OpenRouter API key found in environment variables or config file!');
}

// Initialize OpenAI client - OpenRouter API key
// IMPORTANT: For OpenRouter, set the apiKey directly and do NOT set Authorization in defaultHeaders
const openai = new OpenAI({
  apiKey: openRouterKey, // Let the OpenAI library handle authorization
  baseURL: openRouterBaseUrl,
  defaultHeaders: {
    'HTTP-Referer': 'https://okdates.web.app', // Required for OpenRouter
    'X-Title': 'OkDates App' // Required for OpenRouter
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
 * @param isMeeting Whether this is for a meeting (with time ranges) or just a date
 * @param timezone The user's timezone (only relevant for meetings)
 * @returns Array of parsed dates or time ranges
 */
export async function parseDatesWithLLM(rawInput: string, isMeeting: boolean = false, timezone: string = 'UTC'): Promise<{
  title: string;
  dates: Array<{
    originalText: string;
    timestamp?: {
      seconds: number;
      nanoseconds: number;
    };
    startTimestamp?: {
      seconds: number;
      nanoseconds: number;
    };
    endTimestamp?: {
      seconds: number;
      nanoseconds: number;
    };
    isConfirmed: boolean;
  }>;
}> {
  console.log(`Parsing ${isMeeting ? 'meeting times' : 'dates'} with LLM:`, rawInput);

  try {
    let messages;
    let jsonSchema;

    if (isMeeting) {
      // For meetings, we need time ranges in ISO 8601 format
      messages = [
        {
          role: 'system',
          content: 'You are a helpful executive assistant that knows all about schedules and dates.'
        },
        {
          role: 'user',
          content: `Interpret the raw input from the user and determine which dates and times are relevant.
Your response MUST be in valid JSON format with this exact structure and the array elements for "availability" should be formatted in ISO 8601 Time intervals:

{
  "title": "Available Times for User",
  "availability": ["YYYY-MM-DDThh:mm:ssZ/YYYY-MM-DDThh:mm:ssZ", "YYYY-MM-DDThh:mm:ssZ/YYYY-MM-DDThh:mm:ssZ"]
}

Important: Format all ranges in ISO 8601 format YYYY-MM-DDThh:mm:ssZ/YYYY-MM-DDThh:mm:ssZ.
Be flexible with date interpretations. For example, "next Monday" should resolve to the actual date.
Handle time ranges like "Monday from 15:00 to 17:00" as YYYY-MM-DDT15:00:00Z/YYYY-MM-DDT17:00:00Z.
If a year is not specified, assume the current year.
For the time ranges, interpret common time phrases:
- "mornings" = 9:00 AM to 12:00 PM
- "afternoons" = 1:00 PM to 5:00 PM
- "evenings" = 6:00 PM to 9:00 PM

IMPORTANT: The user's input is in timezone "${timezone}". Please interpret all time references in this timezone, then convert to UTC for the ISO output.

Today's date is: ${new Date().toISOString().split('T')[0]}.

Here is the raw input:
${rawInput}`
        }
      ];

      jsonSchema = {
        name: 'time_parser',
        strict: true,
        schema: {
          type: 'object',
          properties: {
            title: {
              type: 'string',
              description: 'Title for the available times'
            },
            availability: {
              type: 'array',
              description: 'Array of time ranges in ISO format (YYYY-MM-DDThh:mm:ssZ/YYYY-MM-DDThh:mm:ssZ)',
              items: { type: 'string' }
            }
          },
          required: ['title', 'availability'],
          additionalProperties: false
        }
      };
    } else {
      // For regular events, just use dates
      messages = [
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
If a year is not specified, assume the current year. Today's date is: ${new Date().toISOString().split('T')[0]}.

Here is the raw input:
${rawInput}`
        }
      ];

      jsonSchema = {
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
      };
    }

    // Call the LLM API
    console.log('Calling OpenRouter API with model:', openRouterModel);
    console.log('Request payload:', {
      model: openRouterModel,
      messages,
      response_format: {
        type: 'json_schema',
        json_schema: jsonSchema
      },
      temperature: 0.2
    });

    const response = await openai.chat.completions.create({
      model: openRouterModel,
      messages: messages as any,
      response_format: {
        type: 'json_schema',
        json_schema: jsonSchema
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

      if (isMeeting) {
        // For meetings, transform the time ranges into start/end timestamps
        const dates = parsedContent.availability?.map((timeRange: string) => {
          const [startStr, endStr] = timeRange.split('/');
          const startDate = new Date(startStr);
          const endDate = new Date(endStr);

          return {
            originalText: timeRange,
            startTimestamp: {
              seconds: Math.floor(startDate.getTime() / 1000),
              nanoseconds: 0
            },
            endTimestamp: {
              seconds: Math.floor(endDate.getTime() / 1000),
              nanoseconds: 0
            },
            isConfirmed: false
          };
        }) || [];

        return {
          title: parsedContent.title || 'Available Times',
          dates: dates.filter((date: any) =>
            !isNaN(date.startTimestamp?.seconds) &&
            !isNaN(date.endTimestamp?.seconds)
          )
        };
      } else {
        // For regular events, transform the dates into timestamps
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
          dates: dates.filter((date: any) => !isNaN(date.timestamp?.seconds))
        };
      }
    } catch (parseError) {
      console.error('Error parsing LLM response:', parseError);
      throw new Error('Invalid response format from LLM');
    }
  } catch (error) {
    console.error('Error calling LLM service:', error);
    throw error;
  }
}