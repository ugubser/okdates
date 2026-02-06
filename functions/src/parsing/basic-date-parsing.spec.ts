import { basicDateParsing, getMonthIndex, getDayOfWeekIndex } from './index';

// Helper to extract month/day/year from a timestamp seconds value
function dateFromSeconds(seconds: number): Date {
  return new Date(seconds * 1000);
}

describe('getMonthIndex', () => {
  it('returns correct index for full month names', () => {
    expect(getMonthIndex('january')).toBe(0);
    expect(getMonthIndex('february')).toBe(1);
    expect(getMonthIndex('march')).toBe(2);
    expect(getMonthIndex('april')).toBe(3);
    expect(getMonthIndex('may')).toBe(4);
    expect(getMonthIndex('june')).toBe(5);
    expect(getMonthIndex('july')).toBe(6);
    expect(getMonthIndex('august')).toBe(7);
    expect(getMonthIndex('september')).toBe(8);
    expect(getMonthIndex('october')).toBe(9);
    expect(getMonthIndex('november')).toBe(10);
    expect(getMonthIndex('december')).toBe(11);
  });

  it('returns correct index for abbreviated month names', () => {
    expect(getMonthIndex('jan')).toBe(0);
    expect(getMonthIndex('feb')).toBe(1);
    expect(getMonthIndex('mar')).toBe(2);
    expect(getMonthIndex('apr')).toBe(3);
    expect(getMonthIndex('jun')).toBe(5);
    expect(getMonthIndex('jul')).toBe(6);
    expect(getMonthIndex('aug')).toBe(7);
    expect(getMonthIndex('sep')).toBe(8);
    expect(getMonthIndex('oct')).toBe(9);
    expect(getMonthIndex('nov')).toBe(10);
    expect(getMonthIndex('dec')).toBe(11);
  });

  it('is case insensitive', () => {
    expect(getMonthIndex('January')).toBe(0);
    expect(getMonthIndex('JUNE')).toBe(5);
    expect(getMonthIndex('Dec')).toBe(11);
  });

  it('returns -1 for invalid input', () => {
    expect(getMonthIndex('xyz')).toBe(-1);
    expect(getMonthIndex('notamonth')).toBe(-1);
  });

  it('returns 0 for empty string (startsWith edge case)', () => {
    // Empty string: 'january'.startsWith('') is true, so it matches index 0
    expect(getMonthIndex('')).toBe(0);
  });
});

describe('getDayOfWeekIndex', () => {
  it('returns correct index for full day names', () => {
    expect(getDayOfWeekIndex('sunday')).toBe(0);
    expect(getDayOfWeekIndex('monday')).toBe(1);
    expect(getDayOfWeekIndex('tuesday')).toBe(2);
    expect(getDayOfWeekIndex('wednesday')).toBe(3);
    expect(getDayOfWeekIndex('thursday')).toBe(4);
    expect(getDayOfWeekIndex('friday')).toBe(5);
    expect(getDayOfWeekIndex('saturday')).toBe(6);
  });

  it('returns correct index for abbreviated day names', () => {
    expect(getDayOfWeekIndex('sun')).toBe(0);
    expect(getDayOfWeekIndex('mon')).toBe(1);
    expect(getDayOfWeekIndex('tue')).toBe(2);
    expect(getDayOfWeekIndex('wed')).toBe(3);
    expect(getDayOfWeekIndex('thu')).toBe(4);
    expect(getDayOfWeekIndex('fri')).toBe(5);
    expect(getDayOfWeekIndex('sat')).toBe(6);
  });

  it('is case insensitive', () => {
    expect(getDayOfWeekIndex('Monday')).toBe(1);
    expect(getDayOfWeekIndex('FRIDAY')).toBe(5);
    expect(getDayOfWeekIndex('Wed')).toBe(3);
  });

  it('returns -1 for invalid input', () => {
    expect(getDayOfWeekIndex('xyz')).toBe(-1);
    expect(getDayOfWeekIndex('notaday')).toBe(-1);
  });

  it('returns 0 for empty string (startsWith edge case)', () => {
    // Empty string: 'sunday'.startsWith('') is true, so it matches index 0
    expect(getDayOfWeekIndex('')).toBe(0);
  });
});

describe('basicDateParsing — regular mode', () => {
  const currentYear = new Date().getFullYear();

  it('parses MM/DD format', () => {
    const result = basicDateParsing('6/15');
    expect(result).toHaveLength(1);
    const d = dateFromSeconds(result[0].timestamp.seconds);
    expect(d.getMonth()).toBe(5); // June = 5
    expect(d.getDate()).toBe(15);
    expect(d.getFullYear()).toBe(currentYear);
  });

  it('parses MM-DD format', () => {
    const result = basicDateParsing('12-25');
    expect(result).toHaveLength(1);
    const d = dateFromSeconds(result[0].timestamp.seconds);
    expect(d.getMonth()).toBe(11);
    expect(d.getDate()).toBe(25);
  });

  it('parses MM/DD/YYYY format', () => {
    const result = basicDateParsing('3/14/2025');
    expect(result).toHaveLength(1);
    const d = dateFromSeconds(result[0].timestamp.seconds);
    expect(d.getMonth()).toBe(2);
    expect(d.getDate()).toBe(14);
    expect(d.getFullYear()).toBe(2025);
  });

  it('parses 2-digit year', () => {
    const result = basicDateParsing('1/1/26');
    expect(result).toHaveLength(1);
    const d = dateFromSeconds(result[0].timestamp.seconds);
    expect(d.getFullYear()).toBe(2026);
  });

  it('parses full month name with day (June 15)', () => {
    const result = basicDateParsing('June 15');
    expect(result).toHaveLength(1);
    const d = dateFromSeconds(result[0].timestamp.seconds);
    expect(d.getMonth()).toBe(5);
    expect(d.getDate()).toBe(15);
    expect(d.getFullYear()).toBe(currentYear);
  });

  it('parses abbreviated month name with day (Jun 15)', () => {
    const result = basicDateParsing('Jun 15');
    expect(result).toHaveLength(1);
    const d = dateFromSeconds(result[0].timestamp.seconds);
    expect(d.getMonth()).toBe(5);
    expect(d.getDate()).toBe(15);
  });

  it('parses month name with day and year (December 25 2025)', () => {
    // Note: comma-separated input is split first, so "December 25, 2025" would split on comma.
    // Use space-only format to keep year attached.
    const result = basicDateParsing('December 25 2025');
    expect(result).toHaveLength(1);
    const d = dateFromSeconds(result[0].timestamp.seconds);
    expect(d.getMonth()).toBe(11);
    expect(d.getDate()).toBe(25);
    expect(d.getFullYear()).toBe(2025);
  });

  it('splits on comma separator', () => {
    const result = basicDateParsing('6/15, 6/16, 6/17');
    expect(result).toHaveLength(3);
  });

  it('splits on newline separator', () => {
    const result = basicDateParsing('6/15\n6/16\n6/17');
    expect(result).toHaveLength(3);
  });

  it('splits on semicolon separator', () => {
    const result = basicDateParsing('6/15;6/16;6/17');
    expect(result).toHaveLength(3);
  });

  it('returns empty array for unparseable input', () => {
    const result = basicDateParsing('hello world');
    expect(result).toHaveLength(0);
  });

  it('preserves originalText', () => {
    const result = basicDateParsing('6/15');
    expect(result[0].originalText).toBe('6/15');
  });

  it('preserves timezone', () => {
    const result = basicDateParsing('6/15', false, 'America/New_York');
    expect(result[0].timezone).toBe('America/New_York');
  });

  it('sets isConfirmed to false', () => {
    const result = basicDateParsing('6/15');
    expect(result[0].isConfirmed).toBe(false);
  });

  it('has timestamp with seconds and nanoseconds', () => {
    const result = basicDateParsing('6/15');
    expect(result[0].timestamp).toHaveProperty('seconds');
    expect(result[0].timestamp).toHaveProperty('nanoseconds');
    expect(result[0].timestamp.nanoseconds).toBe(0);
  });
});

describe('basicDateParsing — meeting mode', () => {
  it('parses MM/DD from HH:MM to HH:MM', () => {
    const result = basicDateParsing('6/15 from 9:00 to 12:00', true);
    expect(result).toHaveLength(1);
    expect(result[0].startTimestamp).toBeDefined();
    expect(result[0].endTimestamp).toBeDefined();

    const start = dateFromSeconds(result[0].startTimestamp.seconds);
    const end = dateFromSeconds(result[0].endTimestamp.seconds);
    expect(start.getMonth()).toBe(5);
    expect(start.getDate()).toBe(15);
    expect(start.getHours()).toBe(9);
    expect(start.getMinutes()).toBe(0);
    expect(end.getHours()).toBe(12);
    expect(end.getMinutes()).toBe(0);
  });

  it('parses MM/DD/YYYY from HH:MM to HH:MM', () => {
    const result = basicDateParsing('3/14/2025 from 14:00 to 16:30', true);
    expect(result).toHaveLength(1);
    const start = dateFromSeconds(result[0].startTimestamp.seconds);
    const end = dateFromSeconds(result[0].endTimestamp.seconds);
    expect(start.getFullYear()).toBe(2025);
    expect(start.getMonth()).toBe(2);
    expect(start.getDate()).toBe(14);
    expect(start.getHours()).toBe(14);
    expect(end.getHours()).toBe(16);
    expect(end.getMinutes()).toBe(30);
  });

  it('parses day-of-week with time range (Monday from 9:00 to 12:00)', () => {
    const result = basicDateParsing('Monday from 9:00 to 12:00', true);
    expect(result).toHaveLength(1);
    expect(result[0].startTimestamp).toBeDefined();
    expect(result[0].endTimestamp).toBeDefined();

    const start = dateFromSeconds(result[0].startTimestamp.seconds);
    const end = dateFromSeconds(result[0].endTimestamp.seconds);
    expect(start.getDay()).toBe(1); // Monday
    expect(start.getHours()).toBe(9);
    expect(end.getHours()).toBe(12);
  });

  it('parses abbreviated day-of-week (Mon from 9:00 to 12:00)', () => {
    const result = basicDateParsing('Mon from 9:00 to 12:00', true);
    expect(result).toHaveLength(1);
    const start = dateFromSeconds(result[0].startTimestamp.seconds);
    expect(start.getDay()).toBe(1); // Monday
  });

  it('handles overnight wrap (22:00 to 2:00)', () => {
    const result = basicDateParsing('6/15 from 22:00 to 2:00', true);
    expect(result).toHaveLength(1);
    const start = dateFromSeconds(result[0].startTimestamp.seconds);
    const end = dateFromSeconds(result[0].endTimestamp.seconds);
    // End should be after start (next day)
    expect(end.getTime()).toBeGreaterThan(start.getTime());
    expect(start.getHours()).toBe(22);
    expect(end.getHours()).toBe(2);
    expect(end.getDate()).toBe(start.getDate() + 1);
  });

  it('returns needsLlmParsing for unparseable meeting input', () => {
    const result = basicDateParsing('sometime next week maybe', true);
    expect(result).toHaveLength(1);
    expect(result[0].needsLlmParsing).toBe(true);
  });

  it('preserves timezone in meeting mode', () => {
    const result = basicDateParsing('6/15 from 9:00 to 12:00', true, 'Europe/Zurich');
    expect(result[0].timezone).toBe('Europe/Zurich');
  });

  it('has startTimestamp/endTimestamp with seconds and nanoseconds', () => {
    const result = basicDateParsing('6/15 from 9:00 to 12:00', true);
    expect(result[0].startTimestamp.nanoseconds).toBe(0);
    expect(result[0].endTimestamp.nanoseconds).toBe(0);
  });
});
