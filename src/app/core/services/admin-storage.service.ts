import { Injectable } from '@angular/core';
import { LocalStorageService } from './local-storage.service';

/**
 * Service for storing and retrieving admin keys in localStorage.
 * Allows administrators to access their events without saving the admin link.
 */
@Injectable({
  providedIn: 'root'
})
export class AdminStorageService extends LocalStorageService {
  protected readonly storageKeyPrefix = 'okdates_admin_';

  storeAdminKey(eventId: string, adminKey: string): void {
    this.store(eventId, adminKey);
  }

  getAdminKey(eventId: string): string | null {
    return this.retrieve(eventId);
  }

  isEventAdmin(eventId: string, adminKey?: string): boolean {
    const storedKey = this.getAdminKey(eventId);
    return adminKey ? storedKey === adminKey : !!storedKey;
  }

  removeAdminKey(eventId: string): void {
    this.remove(eventId);
    this.removePasswordVerified(eventId);
  }

  getAdminEventIds(): string[] {
    return this.getAllIds();
  }

  /**
   * Marks the current browser as having passed the admin-password check for an
   * event. Used when admin access is granted via password rather than the admin
   * key link (the plaintext key is never stored, so it cannot be recovered here).
   * Same same-origin trust level as a stored admin key.
   */
  private readonly passwordVerifiedPrefix = 'okdates_admin_pwverified_';

  storePasswordVerified(eventId: string): void {
    try {
      localStorage.setItem(`${this.passwordVerifiedPrefix}${eventId}`, '1');
    } catch (error) {
      console.error('Error storing admin password-verified flag:', error);
    }
  }

  isPasswordVerified(eventId: string): boolean {
    try {
      return localStorage.getItem(`${this.passwordVerifiedPrefix}${eventId}`) === '1';
    } catch {
      return false;
    }
  }

  removePasswordVerified(eventId: string): void {
    try {
      localStorage.removeItem(`${this.passwordVerifiedPrefix}${eventId}`);
    } catch (error) {
      console.error('Error removing admin password-verified flag:', error);
    }
  }
}
