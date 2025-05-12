import { ApplicationConfig, provideZoneChangeDetection, isDevMode } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { getFirestore, provideFirestore, connectFirestoreEmulator } from '@angular/fire/firestore';
import { getFunctions, provideFunctions, connectFunctionsEmulator } from '@angular/fire/functions';
import { initializeAppCheck, provideAppCheck, ReCaptchaV3Provider } from '@angular/fire/app-check';
import { getAuth, provideAuth, connectAuthEmulator, signInAnonymously } from '@angular/fire/auth';
import { inject } from '@angular/core';

import { routes } from './app.routes';
import { environment } from '../environments/environment';

// Debug environment variables to see if production config is loaded correctly
console.log('----- ENVIRONMENT CONFIGURATION -----');
console.log('Production mode:', environment.production);
console.log('Use emulators:', environment.useEmulators);

if (!environment.production ) {
console.log('Firebase config:', environment.firebase);
}

console.log('------------------------------------');

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideAnimations(),
    provideHttpClient(withFetch()),

    // Firebase
    provideFirebaseApp(() => initializeApp(environment.firebase)),

    // Auth - moved up to be initialized right after Firebase App
    provideAuth(() => {
      // Clear any persisted auth emulator settings
      if (environment.production) {
        try {
          window.localStorage.removeItem('firebase:host:auth');
          window.localStorage.removeItem('auth:emulator');
          console.log('Cleared Auth emulator settings from browser storage');
        } catch (e) {
          console.warn('Failed to clear Auth emulator settings:', e);
        }
      }

      const auth = getAuth();

      if (environment.useEmulators) {
        console.log('Connecting to Auth emulator...');
        connectAuthEmulator(auth, 'http://localhost:9099');
      } else {
        console.log('Using production Auth instance - NO EMULATOR');
      }

      // Store the initial URL before authentication
      const initialUrl = window.location.pathname + window.location.search;
      const router = inject(Router);

      // Sign in anonymously
      signInAnonymously(auth)
        .then(() => {
          console.log('Anonymous authentication successful');

          // Only redirect if not on the home page
          if (initialUrl !== '/' && initialUrl !== '/index.html') {
            console.log(`Redirecting to initial URL: ${initialUrl}`);
            setTimeout(() => {
              router.navigateByUrl(initialUrl);
            }, 100); // Small delay to ensure app is ready
          }
        })
        .catch((error) => {
          console.error('Anonymous authentication failed:', error);
        });

      return auth;
    }),

    // Firebase AppCheck with improved error handling
    provideAppCheck(() => {
      console.log('Initializing Firebase AppCheck with reCAPTCHA v3...');

      // Clear AppCheck storage if there was a previous error
      try {
        const hasAppCheckError = localStorage.getItem('appcheck_init_error');
        if (hasAppCheckError) {
          console.log('Previous AppCheck error detected, clearing indexed DB...');
          // Try to delete the problematic IndexedDB database
          indexedDB.deleteDatabase('firebase-app-check-database');
          localStorage.removeItem('appcheck_init_error');
        }
      } catch (e) {
        console.warn('Error handling AppCheck storage cleanup:', e);
      }

      let appCheck;

      // Initialize AppCheck with error handling in a way that always returns a valid AppCheck object
      try {
        appCheck = initializeAppCheck(undefined, {
          provider: new ReCaptchaV3Provider(environment.recaptcha?.siteKey || ''),
          isTokenAutoRefreshEnabled: true
        });
        console.log('Firebase AppCheck initialized successfully');
      } catch (error) {
        console.error('AppCheck initialization failed:', error);
        // Mark that we had an error so we can try to fix it on next load
        try {
          localStorage.setItem('appcheck_init_error', 'true');
        } catch (e) {
          console.warn('Could not set error flag:', e);
        }

        // Create a basic implementation that won't break the app
        appCheck = initializeAppCheck(undefined, {
          provider: new ReCaptchaV3Provider(environment.recaptcha?.siteKey || ''),
          isTokenAutoRefreshEnabled: false
        });
      }

      return appCheck;
    }),

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