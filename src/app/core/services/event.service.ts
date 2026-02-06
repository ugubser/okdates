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
   * Gets an event by ID directly from Firestore
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
   * Hash a password with SHA-256 and a random salt for secure storage.
   * Returns a string in the format "salt$hash".
   */
  async hashPassword(password: string): Promise<string> {
    if (!password) return '';

    const salt = Array.from(window.crypto.getRandomValues(new Uint8Array(16)))
      .map(b => b.toString(16).padStart(2, '0')).join('');
    const hash = await this.sha256(salt + password);
    return `${salt}$${hash}`;
  }

  /**
   * Verify a password against a stored hash (salt$hash format).
   * Also supports legacy base64-reversed passwords for migration.
   */
  async verifyPasswordHash(password: string, storedValue: string): Promise<boolean> {
    if (!password || !storedValue) return false;

    if (storedValue.includes('$')) {
      // New format: salt$hash
      const [salt, storedHash] = storedValue.split('$');
      const hash = await this.sha256(salt + password);
      return hash === storedHash;
    }

    // Legacy format: reversed base64 — verify and caller should re-hash
    try {
      const base64 = storedValue.split('').reverse().join('');
      return atob(base64) === password;
    } catch {
      return false;
    }
  }

  private async sha256(message: string): Promise<string> {
    const data = new TextEncoder().encode(message);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Creates an event directly in Firestore with a unique ID
   */
  async createEventDirect(
    title: string | null = null,
    description: string | null = null,
    location: string | null = null,
    isMeeting: boolean = false,
    adminPassword: string | null = null
  ): Promise<{ eventId: string, event: Event }> {
    const timestamp = this.firestoreService.createTimestamp();
    const adminKey = this.generateAdminKey();

    const eventData: any = {
      createdAt: timestamp,
      title: title || null,
      description: description || null,
      isActive: true,
      adminKey: adminKey,
      isMeeting: isMeeting,
    };

    // Only add location if provided
    if (location) {
      eventData.location = location;
    }

    // Add hashed password if provided
    if (adminPassword) {
      eventData.adminPassword = await this.hashPassword(adminPassword);
    }

    const eventId = await this.firestoreService.addDocument(this.eventsPath, eventData);

    const event: Event = {
      id: eventId,
      ...eventData
    };

    return {
      eventId,
      event
    };
  }
  
  /**
   * Updates an event in Firestore
   */
  async updateEvent(eventId: string, data: Partial<Event>): Promise<void> {
    // If updating password, hash it first
    if (data.adminPassword) {
      data = {
        ...data,
        adminPassword: await this.hashPassword(data.adminPassword)
      };
    }

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
  
  /**
   * Verifies if the provided password matches the one stored for the event
   */
  async verifyAdminPassword(eventId: string, password: string): Promise<boolean> {
    try {
      const event = await this.getEventDirect(eventId);
      if (!event || !event.adminPassword) {
        return false;
      }

      const isValid = await this.verifyPasswordHash(password, event.adminPassword);

      // Migrate legacy passwords to new hash format on successful verification
      if (isValid && !event.adminPassword.includes('$')) {
        const newHash = await this.hashPassword(password);
        await this.firestoreService.setDocument(this.eventsPath, eventId, { adminPassword: newHash });
      }

      return isValid;
    } catch (error) {
      console.error('Error verifying admin password:', error);
      return false;
    }
  }
}