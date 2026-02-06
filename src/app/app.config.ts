import { ApplicationConfig, provideZoneChangeDetection, APP_INITIALIZER } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { getFirestore, provideFirestore, connectFirestoreEmulator } from '@angular/fire/firestore';
import { getFunctions, provideFunctions, connectFunctionsEmulator } from '@angular/fire/functions';
import { initializeAppCheck, provideAppCheck, ReCaptchaV3Provider } from '@angular/fire/app-check';
import { getAuth, provideAuth, connectAuthEmulator, signInAnonymously, Auth } from '@angular/fire/auth';
import { inject } from '@angular/core';

import { routes } from './app.routes';
import { environment } from '../environments/environment';

// Capture initial URL immediately before any initialization happens
const initialRequestUrl = window.location.pathname + window.location.search;

// App Initialization Factory - centralized initialization process
function appInitializerFactory() {
  return () => {
    const router = inject(Router);
    const auth = inject(Auth);

    // Return a promise that completes when auth is ready
    return new Promise<void>((resolve) => {
      // 1. First handle authentication
      signInAnonymously(auth)
        .then(() => {
          // 2. Wait a moment for all Firebase services to initialize
          setTimeout(() => {
            // 3. Redirect to initial URL if not on home page
            if (initialRequestUrl !== '/' && initialRequestUrl !== '/index.html') {
              router.navigateByUrl(initialRequestUrl).then(() => {
                resolve();
              });
            } else {
              resolve();
            }
          }, 300); // Allow time for Firebase services to initialize
        })
        .catch((error) => {
          console.error('Anonymous authentication failed:', error);
          resolve(); // Still resolve to not block app startup
        });
    });
  };
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideAnimations(),
    provideHttpClient(withFetch()),

    // Add App Initializer to manage startup sequence
    {
      provide: APP_INITIALIZER,
      useFactory: appInitializerFactory,
      multi: true
    },

    // Firebase
    provideFirebaseApp(() => initializeApp(environment.firebase)),

    // Auth setup
    provideAuth(() => {
      // Clear any persisted auth emulator settings
      if (environment.production) {
        try {
          window.localStorage.removeItem('firebase:host:auth');
          window.localStorage.removeItem('auth:emulator');
        } catch (e) {
          // Ignore cleanup errors
        }
      }

      const auth = getAuth();

      if (environment.useEmulators) {
        connectAuthEmulator(auth, 'http://localhost:9099');
      }

      return auth;
    }),

    // Firebase AppCheck with improved error handling
    provideAppCheck(() => {
      // Clear AppCheck storage if there was a previous error
      try {
        const hasAppCheckError = localStorage.getItem('appcheck_init_error');
        if (hasAppCheckError) {
          indexedDB.deleteDatabase('firebase-app-check-database');
          localStorage.removeItem('appcheck_init_error');
        }
      } catch (e) {
        // Ignore cleanup errors
      }

      let appCheck;

      try {
        appCheck = initializeAppCheck(undefined, {
          provider: new ReCaptchaV3Provider(environment.recaptcha?.siteKey || ''),
          isTokenAutoRefreshEnabled: true
        });
      } catch (error) {
        console.error('AppCheck initialization failed:', error);
        try {
          localStorage.setItem('appcheck_init_error', 'true');
        } catch (e) {
          // Ignore
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
          window.localStorage.removeItem('firebase:host:firestore');
          window.localStorage.removeItem('firestore:emulator');
          window.localStorage.removeItem('firebase:useEmulator');
          indexedDB.deleteDatabase('firestore/settings');
        } catch (e) {
          // Ignore cleanup errors
        }
      }

      const firestore = getFirestore();
      if (environment.useEmulators) {
        connectFirestoreEmulator(firestore, 'localhost', 8081);
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
        } catch (e) {
          // Ignore cleanup errors
        }
      }

      // Initialize functions with europe-west1 region
      const functions = getFunctions(undefined, 'europe-west1');

      if (environment.useEmulators) {
        connectFunctionsEmulator(functions, 'localhost', 5001);
      }
      return functions;
    })
  ]
};
