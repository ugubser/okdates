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
   * Number of PBKDF2 iterations for password hashing. Stored in the hash string
   * so the value can be raised over time without breaking older hashes.
   */
  private static readonly PBKDF2_ITERATIONS = 100000;

  /**
   * Hash a password with PBKDF2-SHA256 and a random salt for secure storage.
   * Returns a string in the format "pbkdf2$<iterations>$<saltHex>$<hashHex>".
   */
  async hashPassword(password: string): Promise<string> {
    if (!password) return '';

    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const iterations = EventService.PBKDF2_ITERATIONS;
    const hashHex = await this.pbkdf2(password, salt, iterations);
    const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
    return `pbkdf2$${iterations}$${saltHex}$${hashHex}`;
  }

  /**
   * Verify a password against a stored hash.
   * Supports the current pbkdf2$… format, the legacy salt$hash (SHA-256) format,
   * and the legacy reversed-base64 format (read-only; these are migrated away
   * server-side by scripts/migrate-admin-keys.ts).
   */
  async verifyPasswordHash(password: string, storedValue: string): Promise<boolean> {
    if (!password || !storedValue) return false;

    if (storedValue.startsWith('pbkdf2$')) {
      const [, iterStr, saltHex, storedHash] = storedValue.split('$');
      const salt = this.hexToBytes(saltHex);
      const hash = await this.pbkdf2(password, salt, parseInt(iterStr, 10));
      return hash === storedHash;
    }

    if (storedValue.includes('$')) {
      // Legacy format: salt$hash (single-round SHA-256)
      const [salt, storedHash] = storedValue.split('$');
      const hash = await this.sha256(salt + password);
      return hash === storedHash;
    }

    // Legacy format: reversed base64 (reversible — server migration removes these)
    try {
      const base64 = storedValue.split('').reverse().join('');
      return atob(base64) === password;
    } catch {
      return false;
    }
  }

  private async pbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<string> {
    const keyMaterial = await window.crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      'PBKDF2',
      false,
      ['deriveBits']
    );
    const bits = await window.crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
      keyMaterial,
      256
    );
    return Array.from(new Uint8Array(bits))
      .map(b => b.toString(16).padStart(2, '0')).join('');
  }

  private hexToBytes(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
    }
    return bytes;
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
  ): Promise<{ eventId: string, event: Event, adminKey: string }> {
    const timestamp = this.firestoreService.createTimestamp();
    const adminKey = this.generateAdminKey();
    const adminKeyHash = await this.sha256(adminKey);

    const eventData: any = {
      createdAt: timestamp,
      title: title || null,
      description: description || null,
      isActive: true,
      adminKeyHash: adminKeyHash,
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

    // The plaintext adminKey is returned to the caller (for the share link /
    // localStorage) but is never persisted in the document.
    return {
      eventId,
      event,
      adminKey
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
      if (!adminKey) return false;
      const event = await this.getEventDirect(eventId);
      if (!event) return false;

      if (event.adminKeyHash) {
        const hash = await this.sha256(adminKey);
        return hash === event.adminKeyHash;
      }

      // Legacy fallback for un-migrated docs that still hold the plaintext key.
      if (event.adminKey) {
        return event.adminKey === adminKey;
      }

      return false;
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

      // Note: legacy password hashes are upgraded server-side by
      // scripts/migrate-admin-keys.ts, not lazily here — the firestore.rules
      // immutability rule forbids clients from rewriting adminPassword.
      return await this.verifyPasswordHash(password, event.adminPassword);
    } catch (error) {
      console.error('Error verifying admin password:', error);
      return false;
    }
  }
}