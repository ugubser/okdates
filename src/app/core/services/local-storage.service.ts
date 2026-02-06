/**
 * Generic localStorage service for storing key-value pairs scoped by a prefix.
 * Subclasses provide a specific prefix (e.g., 'okdates_admin_', 'okdates_participant_').
 */
export abstract class LocalStorageService {
  protected abstract readonly storageKeyPrefix: string;

  protected store(id: string, value: string): void {
    try {
      localStorage.setItem(this.getStorageKey(id), value);
    } catch (error) {
      console.error(`Error storing ${this.storageKeyPrefix} data:`, error);
    }
  }

  protected retrieve(id: string): string | null {
    try {
      return localStorage.getItem(this.getStorageKey(id));
    } catch (error) {
      console.error(`Error retrieving ${this.storageKeyPrefix} data:`, error);
      return null;
    }
  }

  protected remove(id: string): void {
    try {
      localStorage.removeItem(this.getStorageKey(id));
    } catch (error) {
      console.error(`Error removing ${this.storageKeyPrefix} data:`, error);
    }
  }

  protected getAllIds(): string[] {
    try {
      const ids: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.storageKeyPrefix)) {
          ids.push(key.substring(this.storageKeyPrefix.length));
        }
      }
      return ids;
    } catch (error) {
      console.error(`Error getting ${this.storageKeyPrefix} IDs:`, error);
      return [];
    }
  }

  private getStorageKey(id: string): string {
    return `${this.storageKeyPrefix}${id}`;
  }
}
