import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { corsConfig } from '../config/cors';

/**
 * Creates a new event with a unique identifier
 */
export const createEvent = functions.region('europe-west1').https.onCall(async (data, context) => {
  // CORS headers are automatically handled for us in HTTP Callable functions
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
export const getEvent = functions.region('europe-west1').https.onCall(async (data, context) => {
  // CORS headers are automatically handled for us in HTTP Callable functions
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

// HTTP endpoint with explicit CORS handling
export const getEventHttp = functions.region('europe-west1').https.onRequest(async (req, res) => {
  // Apply CORS middleware
  return corsConfig(req, res, async () => {
    try {
      const eventId = req.query.eventId as string;
      
      if (!eventId) {
        return res.status(400).json({
          success: false,
          error: 'Event ID is required'
        });
      }
      
      const eventDoc = await admin.firestore().collection('events').doc(eventId).get();
      
      if (!eventDoc.exists) {
        return res.status(404).json({
          success: false,
          error: 'Event not found'
        });
      }
      
      return res.status(200).json({
        success: true,
        data: {
          id: eventDoc.id,
          ...eventDoc.data()
        }
      });
    } catch (error) {
      console.error('Error getting event:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to get event'
      });
    }
  });
});