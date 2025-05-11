// Initialize Firebase Admin
import * as admin from 'firebase-admin';

// Initialize Firebase Admin
admin.initializeApp();

// Import AppCheck to ensure it's initialized
import './config/appcheck';

// Import functions
import { createEvent, getEvent, getEventHttp } from './events';
import { addParticipant, getParticipants } from './participants';
import { parseDates } from './parsing';

// Export functions with the same structure as before
export const events = {
  createEvent,
  getEvent,
  getEventHttp
};

export const participants = {
  addParticipant,
  getParticipants
};

export const parsing = {
  parseDates
};