// Mock firebase-admin before any imports
jest.mock('firebase-admin', () => {
  const setMock = jest.fn().mockResolvedValue(undefined);
  const getMock = jest.fn();
  const docMock = jest.fn().mockReturnValue({ id: 'test-event-id', set: setMock, get: getMock });
  const collectionMock = jest.fn().mockReturnValue({ doc: docMock });
  const serverTimestampMock = jest.fn().mockReturnValue({ _seconds: 0, _nanoseconds: 0 });

  return {
    initializeApp: jest.fn(),
    firestore: Object.assign(jest.fn().mockReturnValue({ collection: collectionMock }), {
      FieldValue: { serverTimestamp: serverTimestampMock },
    }),
    __mocks: { collectionMock, docMock, setMock, getMock, serverTimestampMock },
  };
});

// Mock the cors config
jest.mock('../config/cors', () => ({
  corsConfig: jest.fn(),
}));

import * as admin from 'firebase-admin';
import * as firebaseFunctionsTest from 'firebase-functions-test';

const testEnv = firebaseFunctionsTest();
const mocks = (admin as any).__mocks;

// Import after mocks are set up
import { createEvent, getEvent } from './index';

describe('createEvent', () => {
  const wrapped = testEnv.wrap(createEvent);

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.FUNCTIONS_EMULATOR;
  });

  it('rejects when App Check is missing (non-emulator)', async () => {
    const result = await wrapped({ title: 'Test', description: '' }, { app: undefined });
    expect(result).toEqual({ success: false, error: 'Unauthorized' });
  });

  it('bypasses App Check in emulator mode', async () => {
    process.env.FUNCTIONS_EMULATOR = 'true';
    const result = await wrapped({ title: 'Test', description: '' }, { app: undefined });
    expect(result.success).toBe(true);
  });

  it('creates event with valid data and returns eventId', async () => {
    process.env.FUNCTIONS_EMULATOR = 'true';
    const result = await wrapped({ title: 'My Event', description: 'Some desc' }, { app: undefined });
    expect(result.success).toBe(true);
    expect(result.eventId).toBe('test-event-id');
    expect(result.data.title).toBe('My Event');
    expect(result.data.description).toBe('Some desc');
    expect(result.data.isActive).toBe(true);
    expect(mocks.setMock).toHaveBeenCalledTimes(1);
  });

  it('rejects title longer than 200 characters', async () => {
    process.env.FUNCTIONS_EMULATOR = 'true';
    const longTitle = 'a'.repeat(201);
    const result = await wrapped({ title: longTitle, description: '' }, { app: undefined });
    expect(result.success).toBe(false);
    expect(result.error).toContain('200 characters');
  });

  it('rejects description longer than 2000 characters', async () => {
    process.env.FUNCTIONS_EMULATOR = 'true';
    const longDesc = 'a'.repeat(2001);
    const result = await wrapped({ title: 'Test', description: longDesc }, { app: undefined });
    expect(result.success).toBe(false);
    expect(result.error).toContain('2000 characters');
  });

  it('allows null title and description', async () => {
    process.env.FUNCTIONS_EMULATOR = 'true';
    const result = await wrapped({ title: null, description: null }, { app: undefined });
    expect(result.success).toBe(true);
    expect(result.data.title).toBeNull();
    expect(result.data.description).toBeNull();
  });
});

describe('getEvent', () => {
  const wrapped = testEnv.wrap(getEvent);

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.FUNCTIONS_EMULATOR;
  });

  it('rejects when App Check is missing', async () => {
    const result = await wrapped({ eventId: 'abc' }, { app: undefined });
    expect(result).toEqual({ success: false, error: 'Unauthorized' });
  });

  it('returns error when eventId is missing', async () => {
    process.env.FUNCTIONS_EMULATOR = 'true';
    const result = await wrapped({}, { app: undefined });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Event ID is required');
  });

  it('returns event data when found', async () => {
    process.env.FUNCTIONS_EMULATOR = 'true';
    mocks.getMock.mockResolvedValueOnce({
      exists: true,
      id: 'event-123',
      data: () => ({ title: 'Found Event', isActive: true }),
    });
    const result = await wrapped({ eventId: 'event-123' }, { app: undefined });
    expect(result.success).toBe(true);
    expect(result.data.title).toBe('Found Event');
    expect(result.data.id).toBe('event-123');
  });

  it('returns "Event not found" for non-existent event', async () => {
    process.env.FUNCTIONS_EMULATOR = 'true';
    mocks.getMock.mockResolvedValueOnce({ exists: false });
    const result = await wrapped({ eventId: 'nonexistent' }, { app: undefined });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Event not found');
  });
});
