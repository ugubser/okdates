import { Timestamp } from 'firebase/firestore';

export interface Event {
  id?: string;
  createdAt: Timestamp; // Using Firestore Timestamp
  title: string | null;
  description: string | null;
  isActive: boolean;
}