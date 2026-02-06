import { Injectable } from '@angular/core';
import { FirestoreService } from './firestore.service';
import { ParsedDate } from '../models/parsed-date.model';

@Injectable({
  providedIn: 'root'
})
export class DateParsingService {

  constructor(private firestoreService: FirestoreService) { }

  /**
   * Parse dates using LLM via Cloud Function.
   * The backend has its own basicDateParsing fallback if the LLM is unavailable.
   * @param rawInput The raw text input from user
   * @param isMeeting Whether this is for a meeting with time ranges
   * @param timezone The user's timezone (only relevant for meetings)
   */
  async parseLlm(rawInput: string, isMeeting: boolean = false, timezone?: string | null): Promise<ParsedDate[]> {
    const response = await this.firestoreService.callFunction('parsing-parseDates', {
      rawDateInput: rawInput,
      isMeeting,
      timezone: timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
    });

    if (response.data.success) {
      return response.data.data.parsedDates;
    } else {
      throw new Error(response.data.error || 'Failed to parse dates');
    }
  }
}