import { Injectable } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { FirestoreService } from './firestore.service';
import { Participant } from '../models/participant.model';

@Injectable({
  providedIn: 'root'
})
export class ParticipantService {

  constructor(
    private firestoreService: FirestoreService,
    private auth: Auth
  ) { }

  /**
   * Adds a new participant to an event
   */
  async addParticipantDirect(
    eventId: string,
    name: string,
    rawDateInput: string,
    parsedDates: any[],
    timezone: string = Intl.DateTimeFormat().resolvedOptions().timeZone
  ): Promise<{ participantId: string, participant: Participant }> {
    const participantData: Omit<Participant, 'id'> = {
      eventId,
      name,
      rawDateInput,
      parsedDates,
      timezone,
      // Integer-second server-relative timestamp (was fractional client seconds).
      submittedAt: this.firestoreService.createTimestamp()
    };

    // Record the author's anonymous UID for self-edit / anti-spoof in rules.
    const ownerUid = this.auth.currentUser?.uid;
    if (ownerUid) {
      (participantData as any).ownerUid = ownerUid;
    }

    const participantId = await this.firestoreService.addDocument(
      `events/${eventId}/participants`,
      participantData
    );
    
    return {
      participantId,
      participant: {
        id: participantId,
        ...participantData
      }
    };
  }
  
  /**
   * Gets all participants for an event directly from Firestore
   */
  async getParticipantsDirect(eventId: string): Promise<Participant[]> {
    return this.firestoreService.getCollection(`events/${eventId}/participants`);
  }
  
  /**
   * Gets a specific participant by ID
   */
  async getParticipantDirect(eventId: string, participantId: string): Promise<Participant | null> {
    return this.firestoreService.getDocument(`events/${eventId}/participants`, participantId);
  }
  
  /**
   * Updates a participant's information
   */
  async updateParticipantDirect(
    eventId: string, 
    participantId: string, 
    data: Partial<Participant>
  ): Promise<void> {
    await this.firestoreService.setDocument(
      `events/${eventId}/participants`, 
      participantId, 
      data
    );
  }
  
  /**
   * Deletes a participant from an event
   */
  async deleteParticipantDirect(eventId: string, participantId: string): Promise<void> {
    await this.firestoreService.deleteDocument(
      `events/${eventId}/participants`, 
      participantId
    );
  }
  
  /**
   * Updates a participant's information with new availability data
   */
  async updateParticipantAvailabilityDirect(
    eventId: string,
    participantId: string,
    rawDateInput: string,
    parsedDates: any[]
  ): Promise<void> {
    // Update submittedAt to reflect the change time
    const updateData = {
      rawDateInput,
      parsedDates,
      submittedAt: this.firestoreService.createTimestamp()
    };
    
    await this.updateParticipantDirect(eventId, participantId, updateData);
  }
}