import { Injectable } from '@angular/core';
import { Firestore, collection, doc, getDoc, setDoc, addDoc, getDocs, Timestamp, deleteDoc } from '@angular/fire/firestore';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class FirestoreService {
  constructor(
    private firestore: Firestore,
    private functions: Functions
  ) {
    console.log('Initializing Firestore service with Angular Fire...');
    
    // Don't use dynamic import, access the environment directly
    // This avoids potential injection context issues
    if (environment.useEmulators) {
      // Add a listener to check Firestore connection
      // This helps debug connection issues with the emulator
      setTimeout(() => {
        this.checkFirestoreConnection();
      }, 0);
    } else {
      console.log('Skipping emulator connection check in production mode');
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
      //console.log(`Successfully connected to Firestore. Found ${snapshot.size} events`);
    } catch (error) {
      console.error('Failed to connect to Firestore:', error);
    }
  }

  // Document methods
  async getDocument(collectionPath: string, docId: string): Promise<any> {
    try {
      //console.log(`FirestoreService: Getting document ${collectionPath}/${docId}`);
      const docRef = doc(this.firestore, collectionPath, docId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        //console.log(`Document found at ${collectionPath}/${docId}:`, data);
        return {
          id: docSnap.id,
          ...data
        };
      } else {
        //console.log(`No document found at ${collectionPath}/${docId}`);
        return null;
      }
    } catch (error) {
      //console.error(`Error getting document ${collectionPath}/${docId}:`, error);
      return null;
    }
  }

  async setDocument(collectionPath: string, docId: string, data: any): Promise<void> {
    try {
      //console.log(`FirestoreService: Setting document ${collectionPath}/${docId}`, data);
      const docRef = doc(this.firestore, collectionPath, docId);
      await setDoc(docRef, data, { merge: true });
      //console.log(`Document updated at ${collectionPath}/${docId}`);
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
      //console.log('Collection reference created');
      
      //console.log('Adding document to Firestore...');
      const docRef = await addDoc(colRef, data);
      //console.log(`Document successfully added with ID: ${docRef.id}`);
      
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

  async deleteDocument(collectionPath: string, docId: string): Promise<void> {
    try {
      //console.log(`FirestoreService: Deleting document ${collectionPath}/${docId}`);
      const docRef = doc(this.firestore, collectionPath, docId);
      await deleteDoc(docRef);
      //console.log(`Document successfully deleted at ${collectionPath}/${docId}`);
    } catch (error) {
      console.error(`Error deleting document ${collectionPath}/${docId}:`, error);
      throw error;
    }
  }

  async getCollection(collectionPath: string): Promise<any[]> {
    try {
      //console.log(`FirestoreService: Getting collection '${collectionPath}'`);
      const colRef = collection(this.firestore, collectionPath);
      const querySnapshot = await getDocs(colRef);
      
      const results: any[] = [];
      querySnapshot.forEach((doc) => {
        results.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      //console.log(`Found ${results.length} documents in collection ${collectionPath}`);
      return results;
    } catch (error) {
      console.error(`Error getting collection ${collectionPath}:`, error);
      return [];
    }
  }

  // Firebase Functions methods
  async callFunction(name: string, data: any): Promise<any> {
    try {
      //console.log(`FirestoreService: Calling function '${name}' with data:`, data);
      const functionRef = httpsCallable(this.functions, name);
      const result = await functionRef(data);
      //console.log(`Function '${name}' returned:`, result);
      return result;
    } catch (error) {
      console.error(`Error calling function ${name}:`, error);
      throw error;
    }
  }
  
  // Helper method to create a Firestore timestamp
  createTimestamp(): Timestamp {
    //console.log('Creating Firestore timestamp');
    return Timestamp.now();
  }
  
}