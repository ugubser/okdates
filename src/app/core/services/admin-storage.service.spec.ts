import { AdminStorageService } from './admin-storage.service';

// Direct instantiation — no Angular DI needed
class TestableAdminStorageService extends AdminStorageService {}

describe('AdminStorageService', () => {
  let service: TestableAdminStorageService;

  beforeEach(() => {
    localStorage.clear();
    service = new TestableAdminStorageService();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('stores and retrieves an admin key', () => {
    service.storeAdminKey('event1', 'key123');
    expect(service.getAdminKey('event1')).toBe('key123');
  });

  it('returns null for non-existent key', () => {
    expect(service.getAdminKey('nonexistent')).toBeNull();
  });

  it('removes an admin key', () => {
    service.storeAdminKey('event1', 'key123');
    service.removeAdminKey('event1');
    expect(service.getAdminKey('event1')).toBeNull();
  });

  it('isEventAdmin returns true when key matches', () => {
    service.storeAdminKey('event1', 'key123');
    expect(service.isEventAdmin('event1', 'key123')).toBe(true);
  });

  it('isEventAdmin returns false when key does not match', () => {
    service.storeAdminKey('event1', 'key123');
    expect(service.isEventAdmin('event1', 'wrongkey')).toBe(false);
  });

  it('isEventAdmin returns true when no key provided but stored key exists', () => {
    service.storeAdminKey('event1', 'key123');
    expect(service.isEventAdmin('event1')).toBe(true);
  });

  it('isEventAdmin returns false when no stored key and no key provided', () => {
    expect(service.isEventAdmin('event1')).toBe(false);
  });

  it('getAdminEventIds returns all stored event IDs', () => {
    service.storeAdminKey('event1', 'key1');
    service.storeAdminKey('event2', 'key2');
    service.storeAdminKey('event3', 'key3');
    const ids = service.getAdminEventIds();
    expect(ids.sort()).toEqual(['event1', 'event2', 'event3']);
  });

  it('getAdminEventIds returns empty array when none stored', () => {
    expect(service.getAdminEventIds()).toEqual([]);
  });

  it('uses okdates_admin_ prefix in localStorage', () => {
    service.storeAdminKey('event1', 'key123');
    expect(localStorage.getItem('okdates_admin_event1')).toBe('key123');
  });
});
