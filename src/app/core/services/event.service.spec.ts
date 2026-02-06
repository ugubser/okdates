import { EventService } from './event.service';
import { FirestoreService } from './firestore.service';

// Mock window.crypto for Node/Jest environment
const mockGetRandomValues = jest.fn((arr: Uint8Array) => {
  for (let i = 0; i < arr.length; i++) arr[i] = i + 1;
  return arr;
});
const mockDigest = jest.fn(async (_algo: string, data: BufferSource) => {
  // Simple deterministic hash: FNV-1a-like per-byte mixing to produce different output for different inputs
  const input = new Uint8Array(data as ArrayBuffer);
  const hash = new Uint8Array(32);
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input[i];
    h = Math.imul(h, 0x01000193);
  }
  for (let i = 0; i < 32; i++) {
    h ^= (h >>> 13);
    h = Math.imul(h, 0x5bd1e995);
    hash[i] = h & 0xff;
    h = h >>> 8 | (h << 24);
  }
  return hash.buffer;
});

Object.defineProperty(globalThis, 'crypto', {
  value: {
    getRandomValues: mockGetRandomValues,
    subtle: { digest: mockDigest },
  },
  writable: true,
});

describe('EventService', () => {
  let service: EventService;
  let mockFirestoreService: jest.Mocked<Pick<FirestoreService, 'getDocument' | 'addDocument' | 'setDocument' | 'createTimestamp'>>;

  beforeEach(() => {
    mockFirestoreService = {
      getDocument: jest.fn(),
      addDocument: jest.fn(),
      setDocument: jest.fn(),
      createTimestamp: jest.fn().mockReturnValue({ seconds: 1000, nanoseconds: 0 }),
    };
    service = new EventService(mockFirestoreService as any);
    jest.clearAllMocks();
  });

  describe('hashPassword', () => {
    it('returns salt$hash format', async () => {
      const result = await service.hashPassword('mypassword');
      expect(result).toContain('$');
      const parts = result.split('$');
      expect(parts).toHaveLength(2);
      expect(parts[0].length).toBe(32); // 16 bytes as hex
      expect(parts[1].length).toBe(64); // SHA-256 as hex
    });

    it('returns empty string for empty password', async () => {
      const result = await service.hashPassword('');
      expect(result).toBe('');
    });
  });

  describe('verifyPasswordHash', () => {
    it('validates correct password', async () => {
      const hash = await service.hashPassword('secret');
      const result = await service.verifyPasswordHash('secret', hash);
      expect(result).toBe(true);
    });

    it('rejects wrong password', async () => {
      const hash = await service.hashPassword('secret');
      const result = await service.verifyPasswordHash('wrong', hash);
      expect(result).toBe(false);
    });

    it('returns false for empty password', async () => {
      const result = await service.verifyPasswordHash('', 'salt$hash');
      expect(result).toBe(false);
    });

    it('returns false for empty stored value', async () => {
      const result = await service.verifyPasswordHash('secret', '');
      expect(result).toBe(false);
    });
  });

  describe('createEventDirect', () => {
    it('calls addDocument and returns eventId', async () => {
      mockFirestoreService.addDocument.mockResolvedValueOnce('new-event-id');
      const result = await service.createEventDirect('My Event', 'Description', null, false);
      expect(mockFirestoreService.addDocument).toHaveBeenCalledWith(
        'events',
        expect.objectContaining({
          title: 'My Event',
          description: 'Description',
          isActive: true,
          isMeeting: false,
        })
      );
      expect(result.eventId).toBe('new-event-id');
      expect(result.event.id).toBe('new-event-id');
    });

    it('generates an adminKey', async () => {
      mockFirestoreService.addDocument.mockResolvedValueOnce('evt-1');
      const result = await service.createEventDirect('Test');
      expect(result.event.adminKey).toBeDefined();
      expect(typeof result.event.adminKey).toBe('string');
      expect(result.event.adminKey!.length).toBe(16);
    });

    it('includes location when provided', async () => {
      mockFirestoreService.addDocument.mockResolvedValueOnce('evt-1');
      await service.createEventDirect('Test', null, 'Room 5');
      expect(mockFirestoreService.addDocument).toHaveBeenCalledWith(
        'events',
        expect.objectContaining({ location: 'Room 5' })
      );
    });
  });

  describe('verifyAdminKey', () => {
    it('returns true for correct admin key', async () => {
      mockFirestoreService.getDocument.mockResolvedValueOnce({
        id: 'evt-1',
        adminKey: 'secret-key',
        title: 'Test',
        description: null,
        isActive: true,
        createdAt: { seconds: 0, nanoseconds: 0 },
      });
      const result = await service.verifyAdminKey('evt-1', 'secret-key');
      expect(result).toBe(true);
    });

    it('returns false for wrong admin key', async () => {
      mockFirestoreService.getDocument.mockResolvedValueOnce({
        id: 'evt-1',
        adminKey: 'secret-key',
        title: 'Test',
        description: null,
        isActive: true,
        createdAt: { seconds: 0, nanoseconds: 0 },
      });
      const result = await service.verifyAdminKey('evt-1', 'wrong-key');
      expect(result).toBe(false);
    });

    it('returns false when event not found', async () => {
      mockFirestoreService.getDocument.mockResolvedValueOnce(null);
      const result = await service.verifyAdminKey('missing', 'any-key');
      expect(result).toBe(false);
    });
  });

  describe('getEventDirect', () => {
    it('delegates to firestoreService.getDocument', async () => {
      const mockEvent = { id: 'evt-1', title: 'Test' };
      mockFirestoreService.getDocument.mockResolvedValueOnce(mockEvent);
      const result = await service.getEventDirect('evt-1');
      expect(mockFirestoreService.getDocument).toHaveBeenCalledWith('events', 'evt-1');
      expect(result).toEqual(mockEvent);
    });

    it('returns null when event does not exist', async () => {
      mockFirestoreService.getDocument.mockResolvedValueOnce(null);
      const result = await service.getEventDirect('nonexistent');
      expect(result).toBeNull();
    });
  });
});
