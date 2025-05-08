import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

/**
 * Creates a new event with a unique identifier
 */
export const createEvent = functions.https.onCall(async (data, context) => {
  try {
    const { title, description } = data;
    
    // Create event document
    const eventRef = admin.firestore().collection('events').doc();
    const eventId = eventRef.id;
    
    const eventData = {
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      title: title || null,
      description: description || null,
      isActive: true
    };
    
    await eventRef.set(eventData);
    
    return {
      success: true,
      eventId,
      data: {
        ...eventData,
        id: eventId
      }
    };
  } catch (error) {
    console.error('Error creating event:', error);
    return {
      success: false,
      error: 'Failed to create event'
    };
  }
});

/**
 * Gets an event by ID
 */
export const getEvent = functions.https.onCall(async (data, context) => {
  try {
    const { eventId } = data;
    
    if (!eventId) {
      return {
        success: false,
        error: 'Event ID is required'
      };
    }
    
    const eventDoc = await admin.firestore().collection('events').doc(eventId).get();
    
    if (!eventDoc.exists) {
      return {
        success: false,
        error: 'Event not found'
      };
    }
    
    return {
      success: true,
      data: {
        id: eventDoc.id,
        ...eventDoc.data()
      }
    };
  } catch (error) {
    console.error('Error getting event:', error);
    return {
      success: false,
      error: 'Failed to get event'
    };
  }
});