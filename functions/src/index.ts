import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin
admin.initializeApp();

// Import function modules
import * as eventFunctions from './events';
import * as participantFunctions from './participants';
import * as parsingFunctions from './parsing';

// Export all functions
export const events = eventFunctions;
export const participants = participantFunctions;
export const parsing = parsingFunctions;