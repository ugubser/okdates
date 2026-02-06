import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

/**
 * Adds a new participant to an event
 */
export const addParticipant = functions.region('europe-west1').https.onCall(async (data, context) => {
  // CORS headers are automatically handled for us in HTTP Callable functions
  try {
    const { eventId, name, rawDateInput, parsedDates, timezone = 'UTC' } = data;

    if (!eventId || !name || !rawDateInput) {
      return { success: false, error: 'Missing required fields' };
    }
    if (typeof eventId !== 'string' || eventId.length > 128) {
      return { success: false, error: 'Invalid event ID' };
    }
    if (typeof name !== 'string' || name.length > 100) {
      return { success: false, error: 'Name must be 100 characters or less' };
    }
    if (typeof rawDateInput !== 'string' || rawDateInput.length > 2000) {
      return { success: false, error: 'Date input must be 2000 characters or less' };
    }
    if (timezone && (typeof timezone !== 'string' || timezone.length > 100)) {
      return { success: false, error: 'Invalid timezone' };
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
      timezone,
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
export const getParticipants = functions.region('europe-west1').https.onCall(async (data, context) => {
  // CORS headers are automatically handled for us in HTTP Callable functions
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