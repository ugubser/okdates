import { DateParsingService } from './date-parsing.service';
import { FirestoreService } from './firestore.service';

describe('DateParsingService', () => {
  let service: DateParsingService;
  let mockFirestoreService: jest.Mocked<Pick<FirestoreService, 'callFunction'>>;

  beforeEach(() => {
    mockFirestoreService = {
      callFunction: jest.fn(),
    };
    service = new DateParsingService(mockFirestoreService as any);
  });

  it('calls the correct function name (parsing-parseDates)', async () => {
    mockFirestoreService.callFunction.mockResolvedValueOnce({
      data: { success: true, data: { parsedDates: [] } },
    });
    await service.parseLlm('June 15', false, 'UTC');
    expect(mockFirestoreService.callFunction).toHaveBeenCalledWith(
      'parsing-parseDates',
      expect.objectContaining({ rawDateInput: 'June 15', isMeeting: false, timezone: 'UTC' })
    );
  });

  it('passes isMeeting and timezone args correctly', async () => {
    mockFirestoreService.callFunction.mockResolvedValueOnce({
      data: { success: true, data: { parsedDates: [] } },
    });
    await service.parseLlm('Monday 9-12', true, 'Europe/Zurich');
    expect(mockFirestoreService.callFunction).toHaveBeenCalledWith(
      'parsing-parseDates',
      expect.objectContaining({ rawDateInput: 'Monday 9-12', isMeeting: true, timezone: 'Europe/Zurich' })
    );
  });

  it('returns parsedDates on success', async () => {
    const mockDates = [{ originalText: '6/15', timestamp: { seconds: 123, nanoseconds: 0 }, isConfirmed: false }];
    mockFirestoreService.callFunction.mockResolvedValueOnce({
      data: { success: true, data: { parsedDates: mockDates } },
    });
    const result = await service.parseLlm('6/15');
    expect(result).toEqual(mockDates);
  });

  it('throws on { success: false } response', async () => {
    mockFirestoreService.callFunction.mockResolvedValueOnce({
      data: { success: false, error: 'Parse error' },
    });
    await expect(service.parseLlm('bad input')).rejects.toThrow('Parse error');
  });

  it('throws on network error', async () => {
    mockFirestoreService.callFunction.mockRejectedValueOnce(new Error('Network error'));
    await expect(service.parseLlm('6/15')).rejects.toThrow('Network error');
  });

  it('uses browser timezone when timezone is null', async () => {
    mockFirestoreService.callFunction.mockResolvedValueOnce({
      data: { success: true, data: { parsedDates: [] } },
    });
    await service.parseLlm('6/15', false, null);
    const call = mockFirestoreService.callFunction.mock.calls[0];
    // When null is passed, it should fall back to Intl timezone
    expect(call[1].timezone).toBeTruthy();
    expect(typeof call[1].timezone).toBe('string');
  });
});
