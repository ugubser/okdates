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
  }

  getAdminEventIds(): string[] {
    return this.getAllIds();
  }
}
