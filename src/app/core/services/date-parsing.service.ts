import { Injectable } from '@angular/core';
import { FirestoreService } from './firestore.service';
import { ParsedDate } from '../models/parsed-date.model';

@Injectable({
  providedIn: 'root'
})
export class DateParsingService {
  
  constructor(private firestoreService: FirestoreService) { }
  
  /**
   * Parses raw text input into structured date objects
   * Uses the Firebase Function
   */
  async parseDates(rawDateInput: string): Promise<ParsedDate[]> {
    try {
      const response = await this.firestoreService.callFunction('parsing-parseDates', {
        rawDateInput
      });
      
      if (response.data.success) {
        return response.data.data.parsedDates;
      } else {
        throw new Error(response.data.error || 'Failed to parse dates');
      }
    } catch (error) {
      console.error('Error parsing dates:', error);
      throw error;
    }
  }
  
  /**
   * Parse dates using LLM via Cloud Function
   * This is the primary method that should be used for production
   */
  async parseLlm(rawInput: string): Promise<ParsedDate[]> {
    try {
      console.log('Parsing dates with LLM Cloud Function...');
      
      // Call the Firebase Function
      const response = await this.firestoreService.callFunction('parsing-parseDates', {
        rawDateInput: rawInput
      });
      
      console.log('Cloud Function response:', response);
      
      if (response.data.success) {
        // The parsed dates are already in the correct format
        return response.data.data.parsedDates;
      } else {
        throw new Error(response.data.error || 'Failed to parse dates with LLM');
      }
    } catch (error) {
      console.error('Error parsing dates with Cloud Function:', error);
      // Fall back to client-side parsing if Cloud Function fails
      console.log('Falling back to client-side parsing...');
      return this.parseClientSide(rawInput);
    }
  }

  /**
   * Basic client-side date parsing as a fallback method
   * This is used when LLM parsing fails or is not available
   */
  parseClientSide(rawInput: string): ParsedDate[] {
    const dates: ParsedDate[] = [];
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
          timestamp: { seconds: Math.floor(date.getTime() / 1000), nanoseconds: 0 },
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
}