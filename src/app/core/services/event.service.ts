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
  async createEvent(title?: string, description?: string, location?: string): Promise<{ eventId: string, event: Event }> {
    try {
      const response = await this.firestoreService.callFunction('events-createEvent', {
        title,
        description,
        location
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
   * Generates a random string to use as admin key
   */
  private generateAdminKey(length: number = 16): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    const randomValues = new Uint8Array(length);
    window.crypto.getRandomValues(randomValues);
    for (let i = 0; i < length; i++) {
      result += chars.charAt(randomValues[i] % chars.length);
    }
    return result;
  }

  /**
   * Creates an event directly in Firestore with a unique ID
   */
  async createEventDirect(title: string | null = null, description: string | null = null, location: string | null = null): Promise<{ eventId: string, event: Event }> {
    console.log('EventService: Creating event directly in Firestore');

    // Create timestamp
    const timestamp = this.firestoreService.createTimestamp();
    console.log('Created timestamp:', timestamp);

    // Generate admin key for secure editing
    const adminKey = this.generateAdminKey();

    // Convert to plain JS object for better Firestore compatibility
    const eventData: any = {
      createdAt: timestamp,
      title: title || null,
      description: description || null,
      isActive: true,
      adminKey: adminKey
      // Not including time fields by default for backward compatibility
    };

    // Only add location if provided
    if (location) {
      eventData.location = location;
    }
    
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
    await this.firestoreService.setDocument(this.eventsPath, eventId, data);
  }
  
  /**
   * Verifies if the provided admin key matches the one stored for the event
   */
  async verifyAdminKey(eventId: string, adminKey: string): Promise<boolean> {
    try {
      const event = await this.getEventDirect(eventId);
      if (!event || !event.adminKey) {
        return false;
      }
      return event.adminKey === adminKey;
    } catch (error) {
      console.error('Error verifying admin key:', error);
      return false;
    }
  }
}