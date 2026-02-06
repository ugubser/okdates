import { Injectable } from '@angular/core';
import { LocalStorageService } from './local-storage.service';

/**
 * Service for storing and retrieving participant IDs in localStorage.
 * Allows participants to identify their own entries for editing or deleting.
 */
@Injectable({
  providedIn: 'root'
})
export class ParticipantStorageService extends LocalStorageService {
  protected readonly storageKeyPrefix = 'okdates_participant_';

  storeParticipantId(eventId: string, participantId: string): void {
    this.store(eventId, participantId);
  }

  getParticipantId(eventId: string): string | null {
    return this.retrieve(eventId);
  }

  isParticipantOwner(eventId: string, participantId: string): boolean {
    return this.getParticipantId(eventId) === participantId;
  }

  removeParticipantId(eventId: string): void {
    this.remove(eventId);
  }

  getParticipatedEventIds(): string[] {
    return this.getAllIds();
  }
}
