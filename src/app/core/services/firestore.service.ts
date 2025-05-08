import { Injectable } from '@angular/core';
import { Firestore, collection, doc, getDoc, setDoc, addDoc, getDocs, Timestamp, DocumentData } from '@angular/fire/firestore';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { firstValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class FirestoreService {
  constructor(
    private firestore: Firestore,
    private functions: Functions
  ) {
    console.log('Initializing Firestore service with Angular Fire...');
    console.log('Firebase config:', JSON.stringify(this.firestore.app.options, null, 2));
    
    // Add a listener to check Firestore connection
    // This helps debug connection issues with the emulator
    this.checkFirestoreConnection();
    
    // After a short delay, try again to make sure connection is established
    setTimeout(() => {
      console.log('Rechecking Firestore connection after delay...');
      this.checkFirestoreConnection();
      this.addTestDocument();
    }, 2000);
  }
  
  // Test method to add a document directly
  private async addTestDocument() {
    try {
      console.log('Creating test document in Firestore...');
      const testData = {
        test: true,
        timestamp: new Date().toISOString(),
        message: 'This is a test document'
      };
      
      const docRef = doc(this.firestore, 'test-collection/test-doc-' + Date.now());
      await setDoc(docRef, testData);
      console.log('Test document created successfully at', docRef.path);
      
      // Verify it was created
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        console.log('Test document verified - read successful:', docSnap.data());
      } else {
        console.error('Test document not found - read failed!');
      }
    } catch (error) {
      console.error('Error creating test document:', error);
    }
  }
  
  /**
   * Check that we can connect to Firestore
   */
  private async checkFirestoreConnection() {
    try {
      // Try to read events collection to verify connection
      const colRef = collection(this.firestore, 'events');
      const snapshot = await getDocs(colRef);
      console.log(`Successfully connected to Firestore. Found ${snapshot.size} events`);
      
      // List all documents in the events collection
      console.log('--- LISTING ALL EVENTS ---');
      snapshot.forEach(doc => {
        console.log(`Event ID: ${doc.id}, Data:`, doc.data());
      });
      console.log('------------------------');
    } catch (error) {
      console.error('Failed to connect to Firestore:', error);
    }
  }

  // Document methods
  async getDocument(collectionPath: string, docId: string): Promise<any> {
    try {
      console.log(`FirestoreService: Getting document ${collectionPath}/${docId}`);
      const docRef = doc(this.firestore, collectionPath, docId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        console.log(`Document found at ${collectionPath}/${docId}:`, data);
        return {
          id: docSnap.id,
          ...data
        };
      } else {
        console.log(`No document found at ${collectionPath}/${docId}`);
        return null;
      }
    } catch (error) {
      console.error(`Error getting document ${collectionPath}/${docId}:`, error);
      return null;
    }
  }

  async setDocument(collectionPath: string, docId: string, data: any): Promise<void> {
    try {
      console.log(`FirestoreService: Setting document ${collectionPath}/${docId}`, data);
      const docRef = doc(this.firestore, collectionPath, docId);
      await setDoc(docRef, data, { merge: true });
      console.log(`Document updated at ${collectionPath}/${docId}`);
    } catch (error) {
      console.error(`Error setting document ${collectionPath}/${docId}:`, error);
      throw error;
    }
  }

  async addDocument(collectionPath: string, data: any): Promise<string> {
    try {
      console.log(`FirestoreService: Adding document to collection '${collectionPath}'`);
      console.log('Document data:', JSON.stringify(data, (key, value) => {
        // Handle Timestamp objects for logging
        if (value && typeof value === 'object' && value.toDate) {
          return `Timestamp(${value.toDate().toISOString()})`;
        }
        return value;
      }, 2));
      
      const colRef = collection(this.firestore, collectionPath);
      console.log('Collection reference created');
      
      console.log('Adding document to Firestore...');
      const docRef = await addDoc(colRef, data);
      console.log(`Document successfully added with ID: ${docRef.id}`);
      
      return docRef.id;
    } catch (error) {
      console.error(`Error adding document to ${collectionPath}:`, error);
      // Log stack trace for better debugging
      if (error instanceof Error) {
        console.error(error.stack);
      }
      throw error;
    }
  }

  async getCollection(collectionPath: string): Promise<any[]> {
    try {
      console.log(`FirestoreService: Getting collection '${collectionPath}'`);
      const colRef = collection(this.firestore, collectionPath);
      const querySnapshot = await getDocs(colRef);
      
      const results: any[] = [];
      querySnapshot.forEach((doc) => {
        results.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      console.log(`Found ${results.length} documents in collection ${collectionPath}`);
      return results;
    } catch (error) {
      console.error(`Error getting collection ${collectionPath}:`, error);
      return [];
    }
  }

  // Firebase Functions methods
  async callFunction(name: string, data: any): Promise<any> {
    try {
      console.log(`FirestoreService: Calling function '${name}' with data:`, data);
      const functionRef = httpsCallable(this.functions, name);
      const result = await functionRef(data);
      console.log(`Function '${name}' returned:`, result);
      return result;
    } catch (error) {
      console.error(`Error calling function ${name}:`, error);
      throw error;
    }
  }
  
  // Helper method to create a Firestore timestamp
  createTimestamp(): Timestamp {
    console.log('Creating Firestore timestamp');
    return Timestamp.now();
  }
  
  // Debug method to list all events and their participants
  async listAllData(): Promise<void> {
    try {
      console.log('--- FULL FIRESTORE DATA LISTING ---');
      
      // Get all events
      const events = await this.getCollection('events');
      console.log(`Found ${events.length} events:`);
      
      // For each event, get its participants
      for (const event of events) {
        console.log(`Event: ${event.id}`);
        console.log('  Title:', event.title);
        console.log('  Description:', event.description);
        console.log('  Created:', event.createdAt ? new Date(event.createdAt.seconds * 1000) : 'N/A');
        
        const participants = await this.getCollection(`events/${event.id}/participants`);
        console.log(`  Participants (${participants.length}):`);
        
        for (const participant of participants) {
          console.log(`    - ${participant.name}: ${participant.rawDateInput}`);
        }
      }
      
      console.log('--- END DATA LISTING ---');
    } catch (error) {
      console.error('Error listing all data:', error);
    }
  }
}