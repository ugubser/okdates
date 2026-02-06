import { ParticipantService } from './participant.service';
import { FirestoreService } from './firestore.service';

describe('ParticipantService', () => {
  let service: ParticipantService;
  let mockFirestoreService: jest.Mocked<Pick<FirestoreService, 'addDocument' | 'getCollection' | 'getDocument' | 'setDocument' | 'deleteDocument'>>;

  beforeEach(() => {
    mockFirestoreService = {
      addDocument: jest.fn(),
      getCollection: jest.fn(),
      getDocument: jest.fn(),
      setDocument: jest.fn(),
      deleteDocument: jest.fn(),
    };
    service = new ParticipantService(mockFirestoreService as any);
  });

  describe('addParticipantDirect', () => {
    it('calls addDocument with correct path', async () => {
      mockFirestoreService.addDocument.mockResolvedValueOnce('p1');
      await service.addParticipantDirect('evt-1', 'Alice', '6/15', []);
      expect(mockFirestoreService.addDocument).toHaveBeenCalledWith(
        'events/evt-1/participants',
        expect.objectContaining({
          eventId: 'evt-1',
          name: 'Alice',
          rawDateInput: '6/15',
          parsedDates: [],
        })
      );
    });

    it('returns participantId and participant object', async () => {
      mockFirestoreService.addDocument.mockResolvedValueOnce('p1');
      const result = await service.addParticipantDirect('evt-1', 'Alice', '6/15', []);
      expect(result.participantId).toBe('p1');
      expect(result.participant.id).toBe('p1');
      expect(result.participant.name).toBe('Alice');
      expect(result.participant.eventId).toBe('evt-1');
    });

    it('includes submittedAt timestamp', async () => {
      mockFirestoreService.addDocument.mockResolvedValueOnce('p1');
      const result = await service.addParticipantDirect('evt-1', 'Alice', '6/15', []);
      expect(result.participant.submittedAt).toBeDefined();
      expect(result.participant.submittedAt.seconds).toBeGreaterThan(0);
    });
  });

  describe('getParticipantsDirect', () => {
    it('calls getCollection with correct path', async () => {
      mockFirestoreService.getCollection.mockResolvedValueOnce([]);
      await service.getParticipantsDirect('evt-1');
      expect(mockFirestoreService.getCollection).toHaveBeenCalledWith('events/evt-1/participants');
    });

    it('returns participants array', async () => {
      const mockParticipants = [
        { id: 'p1', name: 'Alice', eventId: 'evt-1', rawDateInput: '', parsedDates: [], submittedAt: {} },
        { id: 'p2', name: 'Bob', eventId: 'evt-1', rawDateInput: '', parsedDates: [], submittedAt: {} },
      ];
      mockFirestoreService.getCollection.mockResolvedValueOnce(mockParticipants);
      const result = await service.getParticipantsDirect('evt-1');
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Alice');
    });
  });

  describe('getParticipantDirect', () => {
    it('calls getDocument with correct path and ID', async () => {
      mockFirestoreService.getDocument.mockResolvedValueOnce(null);
      await service.getParticipantDirect('evt-1', 'p1');
      expect(mockFirestoreService.getDocument).toHaveBeenCalledWith('events/evt-1/participants', 'p1');
    });

    it('returns participant when found', async () => {
      const mockParticipant = { id: 'p1', name: 'Alice' };
      mockFirestoreService.getDocument.mockResolvedValueOnce(mockParticipant);
      const result = await service.getParticipantDirect('evt-1', 'p1');
      expect(result).toEqual(mockParticipant);
    });

    it('returns null when not found', async () => {
      mockFirestoreService.getDocument.mockResolvedValueOnce(null);
      const result = await service.getParticipantDirect('evt-1', 'nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('updateParticipantDirect', () => {
    it('calls setDocument with correct args', async () => {
      mockFirestoreService.setDocument.mockResolvedValueOnce(undefined);
      await service.updateParticipantDirect('evt-1', 'p1', { name: 'Alice Updated' });
      expect(mockFirestoreService.setDocument).toHaveBeenCalledWith(
        'events/evt-1/participants',
        'p1',
        { name: 'Alice Updated' }
      );
    });
  });

  describe('deleteParticipantDirect', () => {
    it('calls deleteDocument with correct args', async () => {
      mockFirestoreService.deleteDocument.mockResolvedValueOnce(undefined);
      await service.deleteParticipantDirect('evt-1', 'p1');
      expect(mockFirestoreService.deleteDocument).toHaveBeenCalledWith(
        'events/evt-1/participants',
        'p1'
      );
    });
  });
});
