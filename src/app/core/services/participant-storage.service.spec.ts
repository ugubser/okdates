import { ParticipantStorageService } from './participant-storage.service';

class TestableParticipantStorageService extends ParticipantStorageService {}

describe('ParticipantStorageService', () => {
  let service: TestableParticipantStorageService;

  beforeEach(() => {
    localStorage.clear();
    service = new TestableParticipantStorageService();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('stores and retrieves a participant ID', () => {
    service.storeParticipantId('event1', 'participant-abc');
    expect(service.getParticipantId('event1')).toBe('participant-abc');
  });

  it('returns null for non-existent participant', () => {
    expect(service.getParticipantId('nonexistent')).toBeNull();
  });

  it('removes a participant ID', () => {
    service.storeParticipantId('event1', 'participant-abc');
    service.removeParticipantId('event1');
    expect(service.getParticipantId('event1')).toBeNull();
  });

  it('isParticipantOwner returns true for matching ID', () => {
    service.storeParticipantId('event1', 'participant-abc');
    expect(service.isParticipantOwner('event1', 'participant-abc')).toBe(true);
  });

  it('isParticipantOwner returns false for non-matching ID', () => {
    service.storeParticipantId('event1', 'participant-abc');
    expect(service.isParticipantOwner('event1', 'participant-xyz')).toBe(false);
  });

  it('isParticipantOwner returns false when nothing stored', () => {
    expect(service.isParticipantOwner('event1', 'participant-abc')).toBe(false);
  });

  it('getParticipatedEventIds returns all stored event IDs', () => {
    service.storeParticipantId('event1', 'p1');
    service.storeParticipantId('event2', 'p2');
    const ids = service.getParticipatedEventIds();
    expect(ids.sort()).toEqual(['event1', 'event2']);
  });

  it('getParticipatedEventIds returns empty array when none stored', () => {
    expect(service.getParticipatedEventIds()).toEqual([]);
  });

  it('uses okdates_participant_ prefix in localStorage', () => {
    service.storeParticipantId('event1', 'p1');
    expect(localStorage.getItem('okdates_participant_event1')).toBe('p1');
  });
});
