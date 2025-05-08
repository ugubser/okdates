import * as functions from 'firebase-functions';
import { parseDatesWithLLM } from './llm-parser';

/**
 * Parses raw text input into structured date objects using LLM
 */
export const parseDates = functions.region('europe-west1').https.onCall(async (data, context) => {
  // CORS headers are automatically handled for us in HTTP Callable functions
  try {
    const { rawDateInput } = data;
    
    if (!rawDateInput) {
      return {
        success: false,
        error: 'Raw date input is required'
      };
    }
    
    try {
      // Try to use LLM parsing
      console.log('Attempting to parse dates with LLM...');
      const llmResult = await parseDatesWithLLM(rawDateInput);
      console.log('LLM parsing successful:', llmResult);
      
      return {
        success: true,
        data: {
          rawDateInput,
          parsedDates: llmResult.dates,
          title: llmResult.title
        }
      };
    } catch (llmError) {
      console.error('LLM parsing failed, falling back to basic parsing:', llmError);
      // Fall back to basic parsing if LLM fails
      const parsedDates = basicDateParsing(rawDateInput);
      
      return {
        success: true,
        data: {
          rawDateInput,
          parsedDates,
          title: 'Available Dates (Basic Parsing)'
        }
      };
    }
  } catch (error) {
    console.error('Error parsing dates:', error);
    return {
      success: false,
      error: 'Failed to parse dates'
    };
  }
});

/**
 * Basic date parsing function
 * This is a placeholder for the LLM integration that will come later
 */
function basicDateParsing(rawInput: string): any[] {
  const dates = [];
  const currentYear = new Date().getFullYear();
  
  // Split by common separators
  const parts = rawInput.split(/[,;\n]+/).map(part => part.trim()).filter(Boolean);
  
  for (const part of parts) {
    // Try to match MM/DD or MM-DD format
    const slashMatch = part.match(/(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/);
    if (slashMatch) {
      const [_, month, day, yearPart] = slashMatch;
      const year = yearPart ? 
        (yearPart.length === 2 ? 2000 + parseInt(yearPart) : parseInt(yearPart)) : 
        currentYear;
      
      // Create date (month is 0-indexed in JS Date)
      const date = new Date(year, parseInt(month) - 1, parseInt(day));
      dates.push({
        originalText: part,
        timestamp: {
          seconds: Math.floor(date.getTime() / 1000),
          nanoseconds: 0
        },
        isConfirmed: false
      });
      continue;
    }
    
    // Try to match month name and day
    const monthMatch = part.match(/([a-z]+)\s+(\d{1,2})(?:[,\s]+(\d{2,4}))?/i);
    if (monthMatch) {
      const [_, monthName, day, yearPart] = monthMatch;
      const monthIndex = getMonthIndex(monthName);
      if (monthIndex >= 0) {
        const year = yearPart ? parseInt(yearPart) : currentYear;
        const date = new Date(year, monthIndex, parseInt(day));
        dates.push({
          originalText: part,
          timestamp: {
            seconds: Math.floor(date.getTime() / 1000),
            nanoseconds: 0
          },
          isConfirmed: false
        });
      }
    }
  }
  
  return dates;
}

/**
 * Helper function to get month index from name
 */
function getMonthIndex(monthName: string): number {
  const months = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december'
  ];
  
  const shortMonths = [
    'jan', 'feb', 'mar', 'apr', 'may', 'jun',
    'jul', 'aug', 'sep', 'oct', 'nov', 'dec'
  ];
  
  monthName = monthName.toLowerCase();
  
  // Check full month name
  const fullIndex = months.findIndex(m => m === monthName);
  if (fullIndex >= 0) return fullIndex;
  
  // Check short month name
  const shortIndex = shortMonths.findIndex(m => m === monthName);
  if (shortIndex >= 0) return shortIndex;
  
  // Check if month starts with given text
  for (let i = 0; i < months.length; i++) {
    if (months[i].startsWith(monthName) || shortMonths[i].startsWith(monthName)) {
      return i;
    }
  }
  
  return -1;
}