import { OpenAI } from 'openai';
import * as fs from 'fs';
import * as path from 'path';

// Load AI config from file
let aiConfig: any;
try {
  const configPath = path.resolve(__dirname, '../../ai.config.json');
  const configData = fs.readFileSync(configPath, 'utf8');
  aiConfig = JSON.parse(configData);
  console.log('AI configuration loaded from:', configPath);
} catch (error) {
  console.error('Error loading AI config:', error);
  // Fallback configuration - we'll use environment variables instead
  aiConfig = {
    openRouter: {
      key: process.env.OPENROUTER_API_KEY || '',
      baseUrl: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
      model: process.env.OPENROUTER_MODEL || 'meta-llama/llama-4-maverick:free'
    }
  };
}

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: aiConfig.openRouter.key,
  baseURL: aiConfig.openRouter.baseUrl,
  defaultHeaders: {
    'HTTP-Referer': 'https://okdates.app', // Replace with your actual domain
    'X-Title': 'OkDates App'
  }
});

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
    const response = await openai.chat.completions.create({
      model: aiConfig.openRouter.model,
      messages: messages as any,
      response_format: { type: 'json_object' },
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