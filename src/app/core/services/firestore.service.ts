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
    if (environment.useEmulators) {
      setTimeout(() => {
        this.checkFirestoreConnection();
      }, 0);
    }
  }

  private async checkFirestoreConnection() {
    try {
      const colRef = collection(this.firestore, 'events');
      await getDocs(colRef);
    } catch (error) {
      console.error('Failed to connect to Firestore:', error);
    }
  }

  async getDocument(collectionPath: string, docId: string): Promise<any> {
    try {
      const docRef = doc(this.firestore, collectionPath, docId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return {
          id: docSnap.id,
          ...docSnap.data()
        };
      } else {
        return null;
      }
    } catch (error) {
      return null;
    }
  }

  async setDocument(collectionPath: string, docId: string, data: any): Promise<void> {
    try {
      const docRef = doc(this.firestore, collectionPath, docId);
      await setDoc(docRef, data, { merge: true });
    } catch (error) {
      console.error(`Error setting document ${collectionPath}/${docId}:`, error);
      throw error;
    }
  }

  async addDocument(collectionPath: string, data: any): Promise<string> {
    try {
      const colRef = collection(this.firestore, collectionPath);
      const docRef = await addDoc(colRef, data);
      return docRef.id;
    } catch (error) {
      console.error(`Error adding document to ${collectionPath}:`, error);
      throw error;
    }
  }

  async deleteDocument(collectionPath: string, docId: string): Promise<void> {
    try {
      const docRef = doc(this.firestore, collectionPath, docId);
      await deleteDoc(docRef);
    } catch (error) {
      console.error(`Error deleting document ${collectionPath}/${docId}:`, error);
      throw error;
    }
  }

  async getCollection(collectionPath: string): Promise<any[]> {
    try {
      const colRef = collection(this.firestore, collectionPath);
      const querySnapshot = await getDocs(colRef);

      const results: any[] = [];
      querySnapshot.forEach((doc) => {
        results.push({
          id: doc.id,
          ...doc.data()
        });
      });

      return results;
    } catch (error) {
      console.error(`Error getting collection ${collectionPath}:`, error);
      return [];
    }
  }

  async callFunction(name: string, data: any): Promise<any> {
    try {
      const functionRef = httpsCallable(this.functions, name);
      return await functionRef(data);
    } catch (error) {
      console.error(`Error calling function ${name}:`, error);
      throw error;
    }
  }

  createTimestamp(): Timestamp {
    return Timestamp.now();
  }
}
