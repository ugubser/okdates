import { Injectable } from '@angular/core';
import { FirestoreService } from './firestore.service';
import { Event } from '../models/event.model';

@Injectable({
  providedIn: 'root'
})
export class EventService {
  private eventsPath = 'events';
  
  constructor(private firestoreService: FirestoreService) { }
  
  /**
   * Creates a new event
   */
  async createEvent(title?: string, description?: string): Promise<{ eventId: string, event: Event }> {
    try {
      const response = await this.firestoreService.callFunction('events-createEvent', {
        title,
        description
      });
      
      if (response.data.success) {
        return {
          eventId: response.data.eventId,
          event: response.data.data
        };
      } else {
        throw new Error(response.data.error || 'Failed to create event');
      }
    } catch (error) {
      console.error('Error creating event:', error);
      throw error;
    }
  }
  
  /**
   * Gets an event by ID
   */
  async getEvent(eventId: string): Promise<Event> {
    try {
      const response = await this.firestoreService.callFunction('events-getEvent', {
        eventId
      });
      
      if (response.data.success) {
        return response.data.data;
      } else {
        throw new Error(response.data.error || 'Failed to get event');
      }
    } catch (error) {
      console.error('Error getting event:', error);
      throw error;
    }
  }
  
  /**
   * Alternative implementation using direct Firestore access
   */
  async getEventDirect(eventId: string): Promise<Event | null> {
    return this.firestoreService.getDocument(`${this.eventsPath}`, eventId);
  }
  
  /**
   * Creates an event directly in Firestore with a unique ID
   */
  async createEventDirect(title: string | null = null, description: string | null = null): Promise<{ eventId: string, event: Event }> {
    console.log('EventService: Creating event directly in Firestore');
    
    // Create timestamp
    const timestamp = this.firestoreService.createTimestamp();
    console.log('Created timestamp:', timestamp);
    
    const eventData: Omit<Event, 'id'> = {
      createdAt: timestamp,
      title: title || null,
      description: description || null,
      isActive: true
    };
    
    console.log('Event data to save:', eventData);
    
    // Generate a unique event ID
    console.log('Adding document to Firestore...');
    const eventId = await this.firestoreService.addDocument(this.eventsPath, eventData);
    console.log('Document added with ID:', eventId);
    
    const event: Event = {
      id: eventId,
      ...eventData
    };
    
    console.log('Event created successfully:', event);
    
    return {
      eventId,
      event
    };
  }
  
  /**
   * Updates an event in Firestore
   */
  async updateEvent(eventId: string, data: Partial<Event>): Promise<void> {
    console.log(`EventService: Updating event ${eventId} with data:`, data);
    try {
      await this.firestoreService.setDocument(this.eventsPath, eventId, data);
      console.log(`Event ${eventId} successfully updated`);
    } catch (error) {
      console.error(`Error updating event ${eventId}:`, error);
      
      // Try with direct document reference as a fallback
      console.log(`Trying alternate update method for event ${eventId}...`);
      await this.firestoreService.setDocument('events', eventId, data);
    }
  }
  
  /**
   * Debug method to test Firestore permissions
   */
  async testFirestorePermissions(): Promise<void> {
    try {
      console.log('Testing Firestore permissions...');
      
      // 1. Create a test event
      const { eventId } = await this.createEventDirect('Test Event', 'Testing permissions');
      console.log(`Created test event with ID: ${eventId}`);
      
      // 2. Try to update it
      console.log('Attempting to update the test event...');
      await this.updateEvent(eventId, { title: 'Updated Test Event' });
      console.log('Update successful!');
      
      // 3. Verify it was updated
      const updatedEvent = await this.getEventDirect(eventId);
      console.log('Updated event:', updatedEvent);
      
      console.log('Firestore permissions test completed successfully');
    } catch (error) {
      console.error('Firestore permissions test failed:', error);
    }
  }
}