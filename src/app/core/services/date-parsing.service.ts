import { Injectable } from '@angular/core';
import { FirestoreService } from './firestore.service';
import { ParsedDate } from '../models/parsed-date.model';

@Injectable({
  providedIn: 'root'
})
export class DateParsingService {
  
  constructor(private firestoreService: FirestoreService) { }
  
  /**
   * Parse dates using LLM via Cloud Function
   * This is the primary method that should be used for production
   * @param rawInput The raw text input from user
   * @param isMeeting Whether this is for a meeting with time ranges
   * @param timezone The user's timezone (only relevant for meetings)
   */
  async parseLlm(rawInput: string, isMeeting: boolean = false, timezone?: string | null): Promise<ParsedDate[]> {
    try {
      const response = await this.firestoreService.callFunction('parsing-parseDates', {
        rawDateInput: rawInput,
        isMeeting,
        timezone: timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
      });

      if (response.data.success) {
        return response.data.data.parsedDates;
      } else {
        throw new Error(response.data.error || 'Failed to parse dates with LLM');
      }
    } catch (error) {
      // Fall back to client-side parsing if Cloud Function fails
      return this.parseClientSide(rawInput, isMeeting, timezone);
    }
  }

  /**
   * Basic client-side date parsing as a fallback method
   * This is used when LLM parsing fails or is not available
   * @param rawInput The raw text input from user
   * @param isMeeting Whether this is for a meeting with time ranges
   * @param timezone The user's timezone (only relevant for meetings)
   */
  parseClientSide(rawInput: string, isMeeting: boolean = false, timezone?: string | null): ParsedDate[] {
    const dates: ParsedDate[] = [];
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

          // Create start and end dates
          const startDate = new Date(year, parseInt(month) - 1, parseInt(day), parseInt(startHour), parseInt(startMin));
          const endDate = new Date(year, parseInt(month) - 1, parseInt(day), parseInt(endHour), parseInt(endMin));

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
            timezone: timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
            isConfirmed: false
          });
          continue;
        }

        // Match simple day of week with time range like "Monday from 9:00 to 12:00"
        const dowTimeRangeMatch = part.match(/(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\s+from\s+(\d{1,2})(?::(\d{2}))?\s*(?:to|[-])\s*(\d{1,2})(?::(\d{2}))?/i);
        if (dowTimeRangeMatch) {
          const [_, dowName, startHour, startMin = '0', endHour, endMin = '0'] = dowTimeRangeMatch;
          const dowIndex = this.getDayOfWeekIndex(dowName);

          if (dowIndex >= 0) {
            // Get the date for the next occurrence of this day of week
            const today = new Date();
            const targetDate = new Date();
            const daysToAdd = (dowIndex + 7 - today.getDay()) % 7;
            targetDate.setDate(today.getDate() + daysToAdd);

            // Create start and end dates
            const startDate = new Date(
              targetDate.getFullYear(),
              targetDate.getMonth(),
              targetDate.getDate(),
              parseInt(startHour),
              parseInt(startMin)
            );

            const endDate = new Date(
              targetDate.getFullYear(),
              targetDate.getMonth(),
              targetDate.getDate(),
              parseInt(endHour),
              parseInt(endMin)
            );

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
              timezone: timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
              isConfirmed: false
            });
            continue;
          }
        }

        // For other formats, let's add a basic placeholder entry
        dates.push({
          originalText: part,
          timestamp: {
            seconds: Math.floor(Date.now() / 1000),
            nanoseconds: 0
          },
          timezone: timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
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

          // Create date (month is 0-indexed in JS Date)
          const date = new Date(year, parseInt(month) - 1, parseInt(day));
          dates.push({
            originalText: part,
            timestamp: { seconds: Math.floor(date.getTime() / 1000), nanoseconds: 0 },
            timezone: timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
            isConfirmed: false
          });
          continue;
        }

        // Try to match month name and day
        const monthMatch = part.match(/([a-z]+)\s+(\d{1,2})(?:[,\s]+(\d{2,4}))?/i);
        if (monthMatch) {
          const [_, monthName, day, yearPart] = monthMatch;
          const monthIndex = this.getMonthIndex(monthName);
          if (monthIndex >= 0) {
            const year = yearPart ? parseInt(yearPart) : currentYear;
            const date = new Date(year, monthIndex, parseInt(day));
            dates.push({
              originalText: part,
              timestamp: { seconds: Math.floor(date.getTime() / 1000), nanoseconds: 0 },
              timezone: timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
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
  private getMonthIndex(monthName: string): number {
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
  private getDayOfWeekIndex(dowName: string): number {
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
}