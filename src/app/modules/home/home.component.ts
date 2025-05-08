import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { Firestore, doc, setDoc, Timestamp } from '@angular/fire/firestore';
import { EventService } from '../../core/services/event.service';
import { FirestoreService } from '../../core/services/firestore.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, MatButtonModule],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit {
  constructor(
    private router: Router,
    private eventService: EventService,
    private firestoreService: FirestoreService,
    private firestore: Firestore
  ) {}

  ngOnInit(): void {
    // Debug: List all events on initialization
    this.listEvents();
    
    // Debug: More detailed data listing
    this.firestoreService.listAllData();
    
    // Test Firestore permissions
    this.eventService.testFirestorePermissions();
    
    // Test direct Firestore access
    this.testDirectFirestore();
  }
  
  /**
   * Test direct Firestore access without using our services
   */
  private async testDirectFirestore(): Promise<void> {
    try {
      console.log('--- TESTING DIRECT FIRESTORE ACCESS ---');
      const documentId = 'direct-test-' + Date.now();
      const docRef = doc(this.firestore, 'direct-tests', documentId);
      
      const testData = {
        title: 'Direct Test',
        description: 'Created directly with @angular/fire',
        createdAt: Timestamp.now(),
        isActive: true
      };
      
      console.log(`Saving direct test document to 'direct-tests/${documentId}'...`);
      await setDoc(docRef, testData);
      console.log('Direct Firestore document created successfully!');
    } catch (error) {
      console.error('Error in direct Firestore test:', error);
    }
  }

  createNewEvent(): void {
    console.log('Creating new event - navigating to create page');
    this.router.navigate(['/event/create']);
  }
  
  /**
   * Create an event directly without navigation
   */
  async createEventDirectly(): Promise<void> {
    try {
      console.log('Creating event directly...');
      
      // 1. Create with direct Firestore access
      const documentId = 'direct-create-' + Date.now();
      const docRef = doc(this.firestore, 'events', documentId);
      
      const eventData = {
        title: 'Test Event ' + new Date().toLocaleTimeString(),
        description: 'Created directly from home page',
        createdAt: Timestamp.now(),
        isActive: true
      };
      
      console.log(`Creating event at 'events/${documentId}'...`);
      await setDoc(docRef, eventData);
      console.log('Event created successfully! ID:', documentId);
      
      alert('Event created with ID: ' + documentId);
    } catch (error) {
      console.error('Error creating event directly:', error);
      alert('Error creating event. See console for details.');
    }
  }

  /**
   * Debug function to list all events in the console
   */
  private async listEvents(): Promise<void> {
    try {
      const events = await this.firestoreService.getCollection('events');
      console.log('Current events in the database:', events);
    } catch (error) {
      console.error('Error listing events:', error);
    }
  }
}