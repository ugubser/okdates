import * as functions from 'firebase-functions';
import { parseDatesWithLLM } from './llm-parser';

/**
 * Parses raw text input into structured date objects using LLM
 */
export const parseDates = functions.region('europe-west1').https.onCall(async (data, context) => {
  // Enforce App Check (skip in emulator)
  if (!context.app && !process.env.FUNCTIONS_EMULATOR) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const { rawDateInput, isMeeting = false, timezone = 'UTC' } = data;

    if (!rawDateInput) {
      return { success: false, error: 'Raw date input is required' };
    }
    if (typeof rawDateInput !== 'string' || rawDateInput.length > 2000) {
      return { success: false, error: 'Date input must be a string of 2000 characters or less' };
    }
    if (timezone && (typeof timezone !== 'string' || timezone.length > 100)) {
      return { success: false, error: 'Invalid timezone' };
    }

    console.log(`Using timezone: ${timezone}`);

    try {
      // Try to use LLM parsing
      console.log(`Attempting to parse ${isMeeting ? 'meeting times' : 'dates'} with LLM...`);
      const llmResult = await parseDatesWithLLM(rawDateInput, isMeeting, timezone);
      console.log('LLM parsing successful:', llmResult);

      return {
        success: true,
        data: {
          rawDateInput,
          parsedDates: llmResult.dates,
          title: llmResult.title,
          isMeeting,
          timezone
        }
      };
    } catch (llmError) {
      console.error('LLM parsing failed, falling back to basic parsing:', llmError);
      // Fall back to basic parsing if LLM fails
      const parsedDates = basicDateParsing(rawDateInput, isMeeting, timezone);

      return {
        success: true,
        data: {
          rawDateInput,
          parsedDates,
          title: isMeeting ? 'Available Times (Basic Parsing)' : 'Available Dates (Basic Parsing)',
          isMeeting,
          timezone
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
export function basicDateParsing(rawInput: string, isMeeting: boolean = false, timezone: string = 'UTC'): any[] {
  const dates = [];
  const currentYear = new Date().getFullYear();

  // Split by common separators
  const parts = rawInput.split(/[,;\n]+/).map(part => part.trim()).filter(Boolean);

  for (const part of parts) {
    if (isMeeting) {
      // For meetings, try to match date with time ranges

      // Match pattern like "MM/DD from HH:MM to HH:MM" or "MM/DD from HH:MM-HH:MM"
      const dateTimeRangeMatch = part.match(/(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\s+from\s+(\d{1,2})(?::(\d{2}))?\s*(?:to|[-])\s*(\d{1,2})(?::(\d{2}))?/i);
      if (dateTimeRangeMatch) {
        const [_, month, day, yearPart, startHour, startMin = '0', endHour, endMin = '0'] = dateTimeRangeMatch;
        const year = yearPart ?
          (yearPart.length === 2 ? 2000 + parseInt(yearPart) : parseInt(yearPart)) :
          currentYear;

        // Use Date.UTC so wall-clock time is stored as UTC seconds,
        // consistent with how the frontend timeline creates timestamps
        const startDate = new Date(Date.UTC(year, parseInt(month) - 1, parseInt(day), parseInt(startHour), parseInt(startMin)));
        const endDate = new Date(Date.UTC(year, parseInt(month) - 1, parseInt(day), parseInt(endHour), parseInt(endMin)));

        // If end time is earlier than start time, assume it's the next day
        if (endDate.getTime() < startDate.getTime()) {
          endDate.setDate(endDate.getDate() + 1);
        }

        dates.push({
          originalText: part,
          startTimestamp: {
            seconds: Math.floor(startDate.getTime() / 1000),
            nanoseconds: 0
          },
          endTimestamp: {
            seconds: Math.floor(endDate.getTime() / 1000),
            nanoseconds: 0
          },
          timezone: timezone,
          isConfirmed: false
        });
        continue;
      }

      // Match simple day of week with time range like "Monday from 9:00 to 12:00"
      const dowTimeRangeMatch = part.match(/(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\s+from\s+(\d{1,2})(?::(\d{2}))?\s*(?:to|[-])\s*(\d{1,2})(?::(\d{2}))?/i);
      if (dowTimeRangeMatch) {
        const [_, dowName, startHour, startMin = '0', endHour, endMin = '0'] = dowTimeRangeMatch;
        const dowIndex = getDayOfWeekIndex(dowName);

        if (dowIndex >= 0) {
          // Get the date for the next occurrence of this day of week
          const today = new Date();
          const targetDate = new Date();
          const daysToAdd = (dowIndex + 7 - today.getDay()) % 7;
          targetDate.setDate(today.getDate() + daysToAdd);

          // Use Date.UTC so wall-clock time is stored as UTC seconds,
          // consistent with how the frontend timeline creates timestamps
          const startDate = new Date(Date.UTC(
            targetDate.getFullYear(),
            targetDate.getMonth(),
            targetDate.getDate(),
            parseInt(startHour),
            parseInt(startMin)
          ));

          const endDate = new Date(Date.UTC(
            targetDate.getFullYear(),
            targetDate.getMonth(),
            targetDate.getDate(),
            parseInt(endHour),
            parseInt(endMin)
          ));

          // If end time is earlier than start time, assume it's the next day
          if (endDate.getTime() < startDate.getTime()) {
            endDate.setDate(endDate.getDate() + 1);
          }

          dates.push({
            originalText: part,
            startTimestamp: {
              seconds: Math.floor(startDate.getTime() / 1000),
              nanoseconds: 0
            },
            endTimestamp: {
              seconds: Math.floor(endDate.getTime() / 1000),
              nanoseconds: 0
            },
            timezone: timezone,
            isConfirmed: false
          });
          continue;
        }
      }

      // For other formats, let the LLM handle the more complex cases
      // Just add a basic entry for now
      dates.push({
        originalText: part,
        timestamp: {
          seconds: Math.floor(Date.now() / 1000),
          nanoseconds: 0
        },
        timezone: timezone,
        isConfirmed: false,
        needsLlmParsing: true
      });

    } else {
      // For regular events (not meetings), use the original date parsing logic

      // Try to match MM/DD or MM-DD format
      const slashMatch = part.match(/(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/);
      if (slashMatch) {
        const [_, month, day, yearPart] = slashMatch;
        const year = yearPart ?
          (yearPart.length === 2 ? 2000 + parseInt(yearPart) : parseInt(yearPart)) :
          currentYear;

        // Create date using original date components (month is 0-indexed in JS Date)
        const date = new Date(year, parseInt(month) - 1, parseInt(day));
        dates.push({
          originalText: part,
          timestamp: {
            seconds: Math.floor(date.getTime() / 1000),
            nanoseconds: 0
          },
          timezone: timezone,
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
            timezone: timezone,
            isConfirmed: false
          });
        }
      }
    }
  }

  return dates;
}

/**
 * Helper function to get month index from name
 */
export function getMonthIndex(monthName: string): number {
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

/**
 * Helper function to get day of week index from name
 * Returns 0 for Sunday, 1 for Monday, etc.
 */
export function getDayOfWeekIndex(dowName: string): number {
  const daysOfWeek = [
    'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'
  ];

  const shortDays = [
    'sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'
  ];

  dowName = dowName.toLowerCase();

  // Check full day name
  const fullIndex = daysOfWeek.findIndex(d => d === dowName);
  if (fullIndex >= 0) return fullIndex;

  // Check short day name
  const shortIndex = shortDays.findIndex(d => d === dowName);
  if (shortIndex >= 0) return shortIndex;

  // Check if day starts with given text
  for (let i = 0; i < daysOfWeek.length; i++) {
    if (daysOfWeek[i].startsWith(dowName) || shortDays[i].startsWith(dowName)) {
      return i;
    }
  }

  return -1;
}