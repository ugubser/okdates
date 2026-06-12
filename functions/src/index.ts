// Initialize Firebase Admin
import * as admin from 'firebase-admin';

// Initialize Firebase Admin
admin.initializeApp();

// Import AppCheck to ensure it's initialized
import './config/appcheck';

// Import functions
import { parseDates } from './parsing';

// The only function the app uses is date parsing. Event/participant CRUD happens
// via direct Firestore access from the client (guarded by firestore.rules), so
// the previous events-*/participants-* callables were dead code and were removed.
export const parsing = {
  parseDates
};
