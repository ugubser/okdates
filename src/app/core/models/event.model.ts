import { Timestamp } from 'firebase/firestore';

export interface Event {
  id?: string;
  createdAt: Timestamp; // Using Firestore Timestamp
  title: string | null;
  description: string | null;
  location?: string | null; // Optional location for the event
  isActive: boolean;
  adminKeyHash?: string; // SHA-256 hash of the admin key; the plaintext key is never stored
  adminKey?: string; // DEPRECATED: legacy plaintext key, only present on un-migrated docs
  adminPassword?: string; // Optional password hash (pbkdf2$… or legacy salt$hash) for admin access
  startTime?: string | null; // Optional start time in HH:MM format
  endTime?: string | null; // Optional end time in HH:MM format
  isMeeting?: boolean; // Whether this is a meeting with specific times rather than just a date
  meetingDuration?: number; // Duration of the meeting in minutes
}