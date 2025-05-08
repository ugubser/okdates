import { ApplicationConfig, provideZoneChangeDetection, isDevMode } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { getFirestore, provideFirestore, connectFirestoreEmulator } from '@angular/fire/firestore';
import { getFunctions, provideFunctions, connectFunctionsEmulator } from '@angular/fire/functions';

import { routes } from './app.routes';
import { environment } from '../environments/environment';

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
      const firestore = getFirestore();
      if (environment.useEmulators) {
        console.log('Connecting to Firestore emulator at localhost:8081...');
        // Force connection to emulator regardless of previous connection
        connectFirestoreEmulator(firestore, 'localhost', 8081);
        console.log('Firestore emulator connection established');
      }
      return firestore;
    }),
    
    // Functions
    provideFunctions(() => {
      // Initialize functions with europe-west1 region
      const functions = getFunctions(undefined, 'europe-west1');
      
      if (environment.useEmulators) {
        console.log('Connecting to Functions emulator...');
        connectFunctionsEmulator(functions, 'localhost', 5001);
      }
      return functions;
    })
  ]
};