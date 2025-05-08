import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

/**
 * Adds a new participant to an event
 */
export const addParticipant = functions.https.onCall(async (data, context) => {
  try {
    const { eventId, name, rawDateInput, parsedDates } = data;
    
    if (!eventId || !name || !rawDateInput) {
      return {
        success: false,
        error: 'Missing required fields'
      };
    }
    
    // Verify event exists
    const eventDoc = await admin.firestore().collection('events').doc(eventId).get();
    if (!eventDoc.exists) {
      return {
        success: false,
        error: 'Event not found'
      };
    }
    
    // Create participant document
    const participantRef = admin.firestore()
      .collection('events')
      .doc(eventId)
      .collection('participants')
      .doc();
      
    const participantId = participantRef.id;
    
    const participantData = {
      name,
      rawDateInput,
      parsedDates: parsedDates || [],
      submittedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    await participantRef.set(participantData);
    
    return {
      success: true,
      participantId,
      data: {
        ...participantData,
        id: participantId
      }
    };
  } catch (error) {
    console.error('Error adding participant:', error);
    return {
      success: false,
      error: 'Failed to add participant'
    };
  }
});

/**
 * Gets all participants for an event
 */
export const getParticipants = functions.https.onCall(async (data, context) => {
  try {
    const { eventId } = data;
    
    if (!eventId) {
      return {
        success: false,
        error: 'Event ID is required'
      };
    }
    
    const participantsSnapshot = await admin.firestore()
      .collection('events')
      .doc(eventId)
      .collection('participants')
      .orderBy('submittedAt', 'desc')
      .get();
      
    const participants = participantsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    return {
      success: true,
      data: participants
    };
  } catch (error) {
    console.error('Error getting participants:', error);
    return {
      success: false,
      error: 'Failed to get participants'
    };
  }
});