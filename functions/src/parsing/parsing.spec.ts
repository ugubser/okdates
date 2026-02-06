// Mock firebase-admin before any imports
jest.mock('firebase-admin', () => ({
  initializeApp: jest.fn(),
  firestore: Object.assign(jest.fn(), {
    FieldValue: { serverTimestamp: jest.fn() },
  }),
}));

// Mock llm-parser
jest.mock('./llm-parser', () => ({
  parseDatesWithLLM: jest.fn(),
}));

import * as firebaseFunctionsTest from 'firebase-functions-test';
import { parseDatesWithLLM } from './llm-parser';

const testEnv = firebaseFunctionsTest();
const mockParseDatesWithLLM = parseDatesWithLLM as jest.MockedFunction<typeof parseDatesWithLLM>;

import { parseDates } from './index';

describe('parseDates', () => {
  const wrapped = testEnv.wrap(parseDates);

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.FUNCTIONS_EMULATOR;
  });

  it('rejects when App Check is missing', async () => {
    const result = await wrapped({ rawDateInput: '6/15' }, { app: undefined });
    expect(result).toEqual({ success: false, error: 'Unauthorized' });
  });

  it('bypasses App Check in emulator', async () => {
    process.env.FUNCTIONS_EMULATOR = 'true';
    mockParseDatesWithLLM.mockResolvedValueOnce({ title: 'Dates', dates: [] });
    const result = await wrapped({ rawDateInput: '6/15' }, { app: undefined });
    expect(result.success).toBe(true);
  });

  it('returns error when rawDateInput is missing', async () => {
    process.env.FUNCTIONS_EMULATOR = 'true';
    const result = await wrapped({}, { app: undefined });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Raw date input is required');
  });

  it('rejects rawDateInput longer than 2000 characters', async () => {
    process.env.FUNCTIONS_EMULATOR = 'true';
    const result = await wrapped({ rawDateInput: 'a'.repeat(2001) }, { app: undefined });
    expect(result.success).toBe(false);
    expect(result.error).toContain('2000 characters');
  });

  it('rejects invalid timezone', async () => {
    process.env.FUNCTIONS_EMULATOR = 'true';
    const result = await wrapped(
      { rawDateInput: '6/15', timezone: 'a'.repeat(101) },
      { app: undefined }
    );
    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid timezone');
  });

  it('returns LLM result on success', async () => {
    process.env.FUNCTIONS_EMULATOR = 'true';
    const mockDates = [
      { originalText: '2025-06-15', timestamp: { seconds: 1750000000, nanoseconds: 0 }, isConfirmed: false },
    ];
    mockParseDatesWithLLM.mockResolvedValueOnce({ title: 'Available Dates', dates: mockDates });

    const result = await wrapped(
      { rawDateInput: 'June 15', isMeeting: false, timezone: 'UTC' },
      { app: undefined }
    );

    expect(result.success).toBe(true);
    expect(result.data.parsedDates).toEqual(mockDates);
    expect(result.data.title).toBe('Available Dates');
    expect(result.data.isMeeting).toBe(false);
    expect(result.data.timezone).toBe('UTC');
    expect(mockParseDatesWithLLM).toHaveBeenCalledWith('June 15', false, 'UTC');
  });

  it('falls back to basicDateParsing when LLM fails', async () => {
    process.env.FUNCTIONS_EMULATOR = 'true';
    mockParseDatesWithLLM.mockRejectedValueOnce(new Error('LLM unavailable'));

    const result = await wrapped(
      { rawDateInput: '6/15', isMeeting: false, timezone: 'UTC' },
      { app: undefined }
    );

    expect(result.success).toBe(true);
    expect(result.data.parsedDates).toHaveLength(1);
    expect(result.data.title).toBe('Available Dates (Basic Parsing)');
  });

  it('falls back to basicDateParsing for meeting mode when LLM fails', async () => {
    process.env.FUNCTIONS_EMULATOR = 'true';
    mockParseDatesWithLLM.mockRejectedValueOnce(new Error('LLM unavailable'));

    const result = await wrapped(
      { rawDateInput: '6/15 from 9:00 to 12:00', isMeeting: true, timezone: 'Europe/Zurich' },
      { app: undefined }
    );

    expect(result.success).toBe(true);
    expect(result.data.parsedDates).toHaveLength(1);
    expect(result.data.title).toBe('Available Times (Basic Parsing)');
    expect(result.data.isMeeting).toBe(true);
    expect(result.data.timezone).toBe('Europe/Zurich');
  });
});
