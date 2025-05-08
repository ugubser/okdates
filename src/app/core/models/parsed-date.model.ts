export interface ParsedDate {
  originalText: string;
  timestamp: any; // Using any for timestamp to avoid Firebase dependency issues
  isConfirmed: boolean;
}