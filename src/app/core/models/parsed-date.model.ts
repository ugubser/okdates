export interface ParsedDate {
  originalText: string;
  timestamp?: any; // Using any for timestamp to avoid Firebase dependency issues
  startTimestamp?: any; // Start time for meeting time ranges
  endTimestamp?: any; // End time for meeting time ranges
  timezone?: string; // Timezone information for this date
  isConfirmed: boolean;
  needsLlmParsing?: boolean; // Flag to indicate this needs LLM parsing
}