import { Injectable } from '@angular/core';

/**
 * Service for storing and retrieving participant information in localStorage
 * This allows participants to identify their own entries for editing or deleting
 */
@Injectable({
  providedIn: 'root'
})
export class ParticipantStorageService {
  private readonly STORAGE_KEY_PREFIX = 'okdates_participant_';
  
  constructor() {}
  
  /**
   * Store the participant ID for a given event
   */
  storeParticipantId(eventId: string, participantId: string): void {
    try {
      // Store the participant ID in localStorage
      localStorage.setItem(this.getStorageKey(eventId), participantId);
      console.log(`Stored participant ID ${participantId} for event ${eventId}`);
    } catch (error) {
      console.error('Error storing participant ID:', error);
    }
  }
  
  /**
   * Get the participant ID for a given event, if stored
   */
  getParticipantId(eventId: string): string | null {
    try {
      return localStorage.getItem(this.getStorageKey(eventId));
    } catch (error) {
      console.error('Error retrieving participant ID:', error);
      return null;
    }
  }
  
  /**
   * Check if the user is the owner of a given participant ID
   */
  isParticipantOwner(eventId: string, participantId: string): boolean {
    const storedId = this.getParticipantId(eventId);
    return storedId === participantId;
  }
  
  /**
   * Remove the participant ID for a given event
   */
  removeParticipantId(eventId: string): void {
    try {
      localStorage.removeItem(this.getStorageKey(eventId));
    } catch (error) {
      console.error('Error removing participant ID:', error);
    }
  }
  
  /**
   * Get all event IDs for which this user has participated
   */
  getParticipatedEventIds(): string[] {
    try {
      const eventIds: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.STORAGE_KEY_PREFIX)) {
          const eventId = key.substring(this.STORAGE_KEY_PREFIX.length);
          eventIds.push(eventId);
        }
      }
      return eventIds;
    } catch (error) {
      console.error('Error getting participated event IDs:', error);
      return [];
    }
  }
  
  /**
   * Generate the storage key for a given event ID
   */
  private getStorageKey(eventId: string): string {
    return `${this.STORAGE_KEY_PREFIX}${eventId}`;
  }
}