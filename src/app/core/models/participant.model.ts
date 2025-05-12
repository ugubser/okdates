export interface Participant {
  id?: string;
  eventId: string;
  name: string;
  rawDateInput: string;
  parsedDates: any[]; // Using any[] for timestamps to avoid Firebase dependency issues
  submittedAt: any; // Using any for timestamp to avoid Firebase dependency issues
  timezone?: string; // Participant's timezone
}