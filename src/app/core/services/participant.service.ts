import { Injectable } from '@angular/core';
import { FirestoreService } from './firestore.service';
import { Participant } from '../models/participant.model';

@Injectable({
  providedIn: 'root'
})
export class ParticipantService {
  
  constructor(private firestoreService: FirestoreService) { }
  
  /**
   * Adds a new participant to an event
   */
  async addParticipant(
    eventId: string,
    name: string,
    rawDateInput: string,
    parsedDates: any[],
    timezone: string = Intl.DateTimeFormat().resolvedOptions().timeZone
  ): Promise<{ participantId: string, participant: Participant }> {
    try {
      const response = await this.firestoreService.callFunction('participants-addParticipant', {
        eventId,
        name,
        rawDateInput,
        parsedDates,
        timezone
      });
      
      if (response.data.success) {
        return {
          participantId: response.data.participantId,
          participant: response.data.data
        };
      } else {
        throw new Error(response.data.error || 'Failed to add participant');
      }
    } catch (error) {
      console.error('Error adding participant:', error);
      throw error;
    }
  }
  
  /**
   * Gets all participants for an event
   */
  async getParticipants(eventId: string): Promise<Participant[]> {
    try {
      const response = await this.firestoreService.callFunction('participants-getParticipants', {
        eventId
      });
      
      if (response.data.success) {
        return response.data.data;
      } else {
        throw new Error(response.data.error || 'Failed to get participants');
      }
    } catch (error) {
      console.error('Error getting participants:', error);
      throw error;
    }
  }
  
  /**
   * Alternative implementation using direct Firestore access
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
      submittedAt: { seconds: Date.now() / 1000, nanoseconds: 0 }
    };
    
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
      submittedAt: { seconds: Date.now() / 1000, nanoseconds: 0 }
    };
    
    await this.updateParticipantDirect(eventId, participantId, updateData);
  }
}