import { ApplicationConfig, provideZoneChangeDetection, isDevMode } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';
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
    
    // Firebase
    provideFirebaseApp(() => initializeApp(environment.firebase)),
    
    // Firestore
    provideFirestore(() => {
      const firestore = getFirestore();
      if (environment.useEmulators) {
        console.log('Connecting to Firestore emulator...');
        connectFirestoreEmulator(firestore, 'localhost', 8081);
      }
      return firestore;
    }),
    
    // Functions
    provideFunctions(() => {
      const functions = getFunctions();
      if (environment.useEmulators) {
        console.log('Connecting to Functions emulator...');
        connectFunctionsEmulator(functions, 'localhost', 5001);
      }
      return functions;
    })
  ]
};