import { EventService } from './event.service';
import { FirestoreService } from './firestore.service';

// Mock window.crypto for Node/Jest environment.
const mockGetRandomValues = jest.fn((arr: Uint8Array) => {
  for (let i = 0; i < arr.length; i++) arr[i] = i + 1;
  return arr;
});

// Deterministic SHA-256 stand-in: different input → different (stable) output.
function fnvDigest(bytes: Uint8Array, seed = 0x811c9dc5): Uint8Array {
  const hash = new Uint8Array(32);
  let h = seed;
  for (let i = 0; i < bytes.length; i++) {
    h ^= bytes[i];
    h = Math.imul(h, 0x01000193);
  }
  for (let i = 0; i < 32; i++) {
    h ^= (h >>> 13);
    h = Math.imul(h, 0x5bd1e995);
    hash[i] = h & 0xff;
    h = (h >>> 8) | (h << 24);
  }
  return hash;
}

const mockDigest = jest.fn(async (_algo: string, data: BufferSource) => {
  return fnvDigest(new Uint8Array(data as ArrayBuffer)).buffer;
});

// PBKDF2 stand-in: deterministic from (password bytes + salt), so hashing then
// verifying the same password with the stored salt produces a match.
const mockImportKey = jest.fn(async (_fmt: string, keyData: BufferSource) => ({
  __pw: new Uint8Array(keyData as ArrayBuffer)
}));
const mockDeriveBits = jest.fn(async (algo: any, key: any, length: number) => {
  const pw = key.__pw as Uint8Array;
  const salt = new Uint8Array(algo.salt);
  const combined = new Uint8Array(pw.length + salt.length);
  combined.set(pw, 0);
  combined.set(salt, pw.length);
  return fnvDigest(combined, 0x12345678).slice(0, length / 8).buffer;
});

Object.defineProperty(globalThis, 'crypto', {
  value: {
    getRandomValues: mockGetRandomValues,
    subtle: { digest: mockDigest, importKey: mockImportKey, deriveBits: mockDeriveBits },
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
    it('returns pbkdf2$iter$salt$hash format', async () => {
      const result = await service.hashPassword('mypassword');
      const parts = result.split('$');
      expect(parts[0]).toBe('pbkdf2');
      expect(parts[1]).toBe('100000');
      expect(parts[2].length).toBe(32); // 16-byte salt as hex
      expect(parts[3].length).toBe(64); // 32-byte derived key as hex
    });

    it('returns empty string for empty password', async () => {
      const result = await service.hashPassword('');
      expect(result).toBe('');
    });
  });

  describe('verifyPasswordHash', () => {
    it('validates correct password (pbkdf2)', async () => {
      const hash = await service.hashPassword('secret');
      expect(await service.verifyPasswordHash('secret', hash)).toBe(true);
    });

    it('rejects wrong password (pbkdf2)', async () => {
      const hash = await service.hashPassword('secret');
      expect(await service.verifyPasswordHash('wrong', hash)).toBe(false);
    });

    it('still verifies legacy salt$hash (SHA-256) format', async () => {
      // salt$hash where hash = sha256(salt + password)
      const salt = 'abcd';
      const digest = fnvDigest(new TextEncoder().encode(salt + 'secret'));
      const hex = Array.from(digest).map(b => b.toString(16).padStart(2, '0')).join('');
      expect(await service.verifyPasswordHash('secret', `${salt}$${hex}`)).toBe(true);
      expect(await service.verifyPasswordHash('nope', `${salt}$${hex}`)).toBe(false);
    });

    it('returns false for empty password / stored value', async () => {
      expect(await service.verifyPasswordHash('', 'pbkdf2$1$aa$bb')).toBe(false);
      expect(await service.verifyPasswordHash('secret', '')).toBe(false);
    });
  });

  describe('createEventDirect', () => {
    it('stores adminKeyHash (never plaintext) and returns the plaintext adminKey', async () => {
      mockFirestoreService.addDocument.mockResolvedValueOnce('new-event-id');
      const result = await service.createEventDirect('My Event', 'Description', null, false);

      const stored = mockFirestoreService.addDocument.mock.calls[0][1];
      expect(stored.adminKeyHash).toBeDefined();
      expect(stored.adminKey).toBeUndefined(); // plaintext must not be persisted
      expect(result.eventId).toBe('new-event-id');
      expect(typeof result.adminKey).toBe('string');
      expect(result.adminKey.length).toBe(16);
      expect(result.event.adminKeyHash).toBe(stored.adminKeyHash);
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
    it('returns true for the correct key against a hashed doc', async () => {
      mockFirestoreService.addDocument.mockResolvedValueOnce('evt-1');
      const created = await service.createEventDirect('Test');

      mockFirestoreService.getDocument.mockResolvedValueOnce({ id: 'evt-1', adminKeyHash: created.event.adminKeyHash });
      expect(await service.verifyAdminKey('evt-1', created.adminKey)).toBe(true);

      mockFirestoreService.getDocument.mockResolvedValueOnce({ id: 'evt-1', adminKeyHash: created.event.adminKeyHash });
      expect(await service.verifyAdminKey('evt-1', 'wrong-key')).toBe(false);
    });

    it('supports legacy un-migrated docs with plaintext adminKey', async () => {
      mockFirestoreService.getDocument.mockResolvedValueOnce({ id: 'evt-1', adminKey: 'secret-key' });
      expect(await service.verifyAdminKey('evt-1', 'secret-key')).toBe(true);
    });

    it('returns false when event not found', async () => {
      mockFirestoreService.getDocument.mockResolvedValueOnce(null);
      expect(await service.verifyAdminKey('missing', 'any-key')).toBe(false);
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
