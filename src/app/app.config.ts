import { ApplicationConfig, provideZoneChangeDetection, isDevMode } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { getFirestore, provideFirestore, connectFirestoreEmulator } from '@angular/fire/firestore';
import { getFunctions, provideFunctions, connectFunctionsEmulator } from '@angular/fire/functions';

import { routes } from './app.routes';
import { environment } from '../environments/environment';

// Debug environment variables to see if production config is loaded correctly
console.log('----- ENVIRONMENT CONFIGURATION -----');
console.log('Production mode:', environment.production);
console.log('Use emulators:', environment.useEmulators);
console.log('Firebase config:', environment.firebase);
console.log('------------------------------------');

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }), 
    provideRouter(routes),
    provideAnimations(),
    provideHttpClient(withFetch()),
    
    // Firebase
    provideFirebaseApp(() => initializeApp(environment.firebase)),
    
    // Firestore
    provideFirestore(() => {
      // Clear any persisted emulator settings from local storage
      if (environment.production) {
        try {
          // Clear Firebase emulator settings from IndexedDB and localStorage
          window.localStorage.removeItem('firebase:host:firestore');
          window.localStorage.removeItem('firestore:emulator');
          window.localStorage.removeItem('firebase:useEmulator');
          // In some cases, IndexedDB is used to store settings
          indexedDB.deleteDatabase('firestore/settings');
          console.log('Cleared emulator settings from browser storage');
        } catch (e) {
          console.warn('Failed to clear emulator settings:', e);
        }
      }
      
      const firestore = getFirestore();
      if (environment.useEmulators) {
        console.log('Connecting to Firestore emulator at localhost:8081...');
        // Force connection to emulator regardless of previous connection
        connectFirestoreEmulator(firestore, 'localhost', 8081);
        console.log('Firestore emulator connection established');
      } else {
        console.log('Using production Firestore instance - NO EMULATOR');
      }
      return firestore;
    }),
    
    // Functions
    provideFunctions(() => {
      // Clear any persisted functions emulator settings
      if (environment.production) {
        try {
          window.localStorage.removeItem('firebase:host:functions');
          window.localStorage.removeItem('functions:emulator');
          console.log('Cleared Functions emulator settings from browser storage');
        } catch (e) {
          console.warn('Failed to clear Functions emulator settings:', e);
        }
      }
      
      // Initialize functions with europe-west1 region
      const functions = getFunctions(undefined, 'europe-west1');
      
      if (environment.useEmulators) {
        console.log('Connecting to Functions emulator...');
        connectFunctionsEmulator(functions, 'localhost', 5001);
      } else {
        console.log('Using production Functions instance in europe-west1 region - NO EMULATOR');
      }
      return functions;
    })
  ]
};