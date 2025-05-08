import * as functions from 'firebase-functions';

/**
 * Parses raw text input into structured date objects
 * Note: In a complete implementation, this would integrate with an LLM API
 * For now, we'll implement a basic parser for common date formats
 */
export const parseDates = functions.https.onCall(async (data, context) => {
  try {
    const { rawDateInput } = data;
    
    if (!rawDateInput) {
      return {
        success: false,
        error: 'Raw date input is required'
      };
    }
    
    // Basic implementation for parsing common date formats
    // This would be replaced with LLM integration in Phase 4
    const parsedDates = basicDateParsing(rawDateInput);
    
    return {
      success: true,
      data: {
        rawDateInput,
        parsedDates
      }
    };
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
  const currentMonth = new Date().getMonth();
  
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