import { Injectable } from '@angular/core';

/**
 * Service for storing and retrieving admin information in localStorage
 * This allows administrators to access their events without saving the admin link
 */
@Injectable({
  providedIn: 'root'
})
export class AdminStorageService {
  private readonly STORAGE_KEY_PREFIX = 'okdates_admin_';
  
  constructor() {}
  
  /**
   * Store the admin key for a given event
   */
  storeAdminKey(eventId: string, adminKey: string): void {
    try {
      // Store the admin key in localStorage
      localStorage.setItem(this.getStorageKey(eventId), adminKey);
      console.log(`Stored admin key for event ${eventId}`);
    } catch (error) {
      console.error('Error storing admin key:', error);
    }
  }
  
  /**
   * Get the admin key for a given event, if stored
   */
  getAdminKey(eventId: string): string | null {
    try {
      return localStorage.getItem(this.getStorageKey(eventId));
    } catch (error) {
      console.error('Error retrieving admin key:', error);
      return null;
    }
  }
  
  /**
   * Check if the user is an admin for the given event
   */
  isEventAdmin(eventId: string, adminKey?: string): boolean {
    const storedKey = this.getAdminKey(eventId);
    // If an adminKey is provided, check against that, otherwise just check if we have a stored key
    return adminKey ? storedKey === adminKey : !!storedKey;
  }
  
  /**
   * Remove the admin key for a given event
   */
  removeAdminKey(eventId: string): void {
    try {
      localStorage.removeItem(this.getStorageKey(eventId));
    } catch (error) {
      console.error('Error removing admin key:', error);
    }
  }
  
  /**
   * Get all event IDs for which this user is an admin
   */
  getAdminEventIds(): string[] {
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
      console.error('Error getting admin event IDs:', error);
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