// Initialize Firebase Admin
import * as admin from 'firebase-admin';
import * as cors from 'cors';

// Initialize Firebase Admin
admin.initializeApp();

// CORS configuration with allowed origins
export const corsConfig = cors({
  origin: [
    'http://localhost:4200',
    'http://localhost:5003',
    'https://okdates.tribecans.com',
    'https://okdate.vanguardsignals.com'
  ],
  methods: ['GET', 'POST', 'OPTIONS'],
  credentials: true
});

// Import function modules
import * as eventFunctions from './events';
import * as participantFunctions from './participants';
import * as parsingFunctions from './parsing';

// Export all functions
export const events = eventFunctions;
export const participants = participantFunctions;
export const parsing = parsingFunctions;