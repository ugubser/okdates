// Mock firebase-admin before any imports
jest.mock('firebase-admin', () => {
  const setMock = jest.fn().mockResolvedValue(undefined);
  const getMock = jest.fn();
  const orderByMock = jest.fn().mockReturnValue({ get: getMock });
  const participantDocMock = jest.fn().mockReturnValue({ id: 'participant-id-1', set: setMock });
  const participantsCollectionMock = jest.fn().mockReturnValue({
    doc: participantDocMock,
    orderBy: orderByMock,
  });

  // Event-level doc mock for existence check
  const eventGetMock = jest.fn();
  const eventDocMock = jest.fn().mockImplementation((eventId: string) => ({
    get: eventGetMock,
    collection: participantsCollectionMock,
  }));
  const collectionMock = jest.fn().mockReturnValue({ doc: eventDocMock });
  const serverTimestampMock = jest.fn().mockReturnValue({ _seconds: 0, _nanoseconds: 0 });

  return {
    initializeApp: jest.fn(),
    firestore: Object.assign(jest.fn().mockReturnValue({ collection: collectionMock }), {
      FieldValue: { serverTimestamp: serverTimestampMock },
    }),
    __mocks: {
      collectionMock, eventDocMock, eventGetMock,
      participantsCollectionMock, participantDocMock,
      setMock, getMock, orderByMock, serverTimestampMock,
    },
  };
});

import * as admin from 'firebase-admin';
import * as firebaseFunctionsTest from 'firebase-functions-test';

const testEnv = firebaseFunctionsTest();
const mocks = (admin as any).__mocks;

import { addParticipant, getParticipants } from './index';

describe('addParticipant', () => {
  const wrapped = testEnv.wrap(addParticipant);

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.FUNCTIONS_EMULATOR;
    // Default: event exists
    mocks.eventGetMock.mockResolvedValue({ exists: true });
  });

  it('rejects when App Check is missing', async () => {
    const result = await wrapped(
      { eventId: 'e1', name: 'Alice', rawDateInput: '6/15' },
      { app: undefined }
    );
    expect(result).toEqual({ success: false, error: 'Unauthorized' });
  });

  it('bypasses App Check in emulator', async () => {
    process.env.FUNCTIONS_EMULATOR = 'true';
    const result = await wrapped(
      { eventId: 'e1', name: 'Alice', rawDateInput: '6/15' },
      { app: undefined }
    );
    expect(result.success).toBe(true);
  });

  it('rejects missing required fields', async () => {
    process.env.FUNCTIONS_EMULATOR = 'true';
    const result = await wrapped({ eventId: 'e1', name: '' }, { app: undefined });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Missing required fields');
  });

  it('rejects name longer than 100 characters', async () => {
    process.env.FUNCTIONS_EMULATOR = 'true';
    const result = await wrapped(
      { eventId: 'e1', name: 'a'.repeat(101), rawDateInput: '6/15' },
      { app: undefined }
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('100 characters');
  });

  it('rejects rawDateInput longer than 2000 characters', async () => {
    process.env.FUNCTIONS_EMULATOR = 'true';
    const result = await wrapped(
      { eventId: 'e1', name: 'Alice', rawDateInput: 'a'.repeat(2001) },
      { app: undefined }
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('2000 characters');
  });

  it('checks event existence', async () => {
    process.env.FUNCTIONS_EMULATOR = 'true';
    mocks.eventGetMock.mockResolvedValueOnce({ exists: false });
    const result = await wrapped(
      { eventId: 'nonexistent', name: 'Alice', rawDateInput: '6/15' },
      { app: undefined }
    );
    expect(result.success).toBe(false);
    expect(result.error).toBe('Event not found');
  });

  it('creates participant successfully', async () => {
    process.env.FUNCTIONS_EMULATOR = 'true';
    const result = await wrapped(
      { eventId: 'e1', name: 'Alice', rawDateInput: '6/15', parsedDates: [{ date: '6/15' }] },
      { app: undefined }
    );
    expect(result.success).toBe(true);
    expect(result.participantId).toBe('participant-id-1');
    expect(result.data.name).toBe('Alice');
    expect(mocks.setMock).toHaveBeenCalledTimes(1);
  });
});

describe('getParticipants', () => {
  const wrapped = testEnv.wrap(getParticipants);

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.FUNCTIONS_EMULATOR;
  });

  it('rejects when App Check is missing', async () => {
    const result = await wrapped({ eventId: 'e1' }, { app: undefined });
    expect(result).toEqual({ success: false, error: 'Unauthorized' });
  });

  it('returns error when eventId is missing', async () => {
    process.env.FUNCTIONS_EMULATOR = 'true';
    const result = await wrapped({}, { app: undefined });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Event ID is required');
  });

  it('returns participants list', async () => {
    process.env.FUNCTIONS_EMULATOR = 'true';
    mocks.getMock.mockResolvedValueOnce({
      docs: [
        { id: 'p1', data: () => ({ name: 'Alice' }) },
        { id: 'p2', data: () => ({ name: 'Bob' }) },
      ],
    });
    const result = await wrapped({ eventId: 'e1' }, { app: undefined });
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(2);
    expect(result.data[0].id).toBe('p1');
    expect(result.data[0].name).toBe('Alice');
    expect(result.data[1].name).toBe('Bob');
  });
});
