import { ICalendarService } from './ical.service';
import { Event } from '../models/event.model';

describe('ICalendarService', () => {
  let service: ICalendarService;

  beforeEach(() => {
    service = new ICalendarService();
  });

  function makeEvent(overrides: Partial<Event> = {}): Event {
    return {
      id: 'test-event-id',
      createdAt: { seconds: 0, nanoseconds: 0 } as any,
      title: 'Test Event',
      description: 'A test event',
      isActive: true,
      ...overrides,
    };
  }

  describe('basic iCal structure', () => {
    it('contains required iCal headers', () => {
      const event = makeEvent();
      const date = new Date(Date.UTC(2025, 5, 15)); // June 15 2025
      const result = service.generateICalendarFile(event, date, 'June 15, 2025');

      expect(result).toContain('BEGIN:VCALENDAR');
      expect(result).toContain('VERSION:2.0');
      expect(result).toContain('PRODID:OkDates');
      expect(result).toContain('CALSCALE:GREGORIAN');
      expect(result).toContain('METHOD:PUBLISH');
      expect(result).toContain('BEGIN:VEVENT');
      expect(result).toContain('END:VEVENT');
      expect(result).toContain('END:VCALENDAR');
    });

    it('has UID containing event ID', () => {
      const event = makeEvent();
      const date = new Date(Date.UTC(2025, 5, 15));
      const result = service.generateICalendarFile(event, date, 'June 15, 2025');
      expect(result).toContain('test-event-id@okdates.web.app');
    });

    it('uses CRLF line endings per RFC 5545', () => {
      const event = makeEvent();
      const date = new Date(Date.UTC(2025, 5, 15));
      const result = service.generateICalendarFile(event, date, 'June 15, 2025');
      expect(result).toContain('\r\n');
    });
  });

  describe('SUMMARY and LOCATION', () => {
    it('includes SUMMARY from event title', () => {
      const event = makeEvent({ title: 'Team Meeting' });
      const date = new Date(Date.UTC(2025, 5, 15));
      const result = service.generateICalendarFile(event, date, 'June 15');
      expect(result).toContain('SUMMARY:Team Meeting');
    });

    it('uses "Untitled Event" when title is null', () => {
      const event = makeEvent({ title: null });
      const date = new Date(Date.UTC(2025, 5, 15));
      const result = service.generateICalendarFile(event, date, 'June 15');
      expect(result).toContain('SUMMARY:Untitled Event');
    });

    it('includes LOCATION when present', () => {
      const event = makeEvent({ location: 'Room 101' });
      const date = new Date(Date.UTC(2025, 5, 15));
      const result = service.generateICalendarFile(event, date, 'June 15');
      expect(result).toContain('LOCATION:Room 101');
    });

    it('omits LOCATION when not present', () => {
      const event = makeEvent({ location: null });
      const date = new Date(Date.UTC(2025, 5, 15));
      const result = service.generateICalendarFile(event, date, 'June 15');
      expect(result).not.toContain('LOCATION:');
    });
  });

  describe('text escaping', () => {
    it('escapes semicolons', () => {
      const event = makeEvent({ title: 'A;B' });
      const date = new Date(Date.UTC(2025, 5, 15));
      const result = service.generateICalendarFile(event, date, 'June 15');
      expect(result).toContain('SUMMARY:A\\;B');
    });

    it('escapes commas', () => {
      const event = makeEvent({ title: 'A,B' });
      const date = new Date(Date.UTC(2025, 5, 15));
      const result = service.generateICalendarFile(event, date, 'June 15');
      expect(result).toContain('SUMMARY:A\\,B');
    });

    it('escapes backslashes', () => {
      const event = makeEvent({ title: 'A\\B' });
      const date = new Date(Date.UTC(2025, 5, 15));
      const result = service.generateICalendarFile(event, date, 'June 15');
      expect(result).toContain('SUMMARY:A\\\\B');
    });

    it('escapes newlines', () => {
      const event = makeEvent({ description: 'Line1\nLine2' });
      const date = new Date(Date.UTC(2025, 5, 15));
      const result = service.generateICalendarFile(event, date, 'June 15');
      expect(result).toContain('DESCRIPTION:Line1\\nLine2');
    });
  });

  describe('all-day event (no start/end time)', () => {
    it('generates DATE values with an exclusive next-day end', () => {
      const event = makeEvent();
      const date = new Date(Date.UTC(2025, 5, 15)); // June 15, 2025
      const result = service.generateICalendarFile(event, date, 'June 15');
      expect(result).toContain('DTSTART;VALUE=DATE:20250615');
      expect(result).toContain('DTEND;VALUE=DATE:20250616');
    });
  });

  describe('timed event (startTime/endTime)', () => {
    it('uses event startTime and endTime', () => {
      const event = makeEvent({ startTime: '09:00', endTime: '17:00' });
      const date = new Date(Date.UTC(2025, 5, 15));
      const result = service.generateICalendarFile(event, date, 'June 15');
      expect(result).toMatch(/DTSTART:\d{8}T\d{6}Z/);
      expect(result).toMatch(/DTEND:\d{8}T\d{6}Z/);
    });
  });

  describe('meeting slots (slotStart/slotEnd)', () => {
    it('uses slotStart and slotEnd for meeting mode', () => {
      const event = makeEvent({ isMeeting: true });
      const date = new Date(Date.UTC(2025, 5, 15));
      const slotStart = new Date(2025, 5, 15, 9, 0);
      const slotEnd = new Date(2025, 5, 15, 12, 0);
      const result = service.generateICalendarFile(event, date, 'June 15', slotStart, slotEnd);
      expect(result).toMatch(/DTSTART:\d{8}T\d{6}Z/);
      expect(result).toMatch(/DTEND:\d{8}T\d{6}Z/);
    });
  });

  describe('timezone handling', () => {
    it('does not attach a timezone to an all-day date', () => {
      const event = makeEvent();
      const date = new Date(Date.UTC(2025, 5, 15));
      const result = service.generateICalendarFile(event, date, 'June 15', undefined, undefined, 'Europe/Zurich');
      expect(result).not.toContain('VTIMEZONE');
      expect(result).toContain('DTSTART;VALUE=DATE:20250615');
    });

    it('converts a timed event from the given timezone to UTC', () => {
      const event = makeEvent();
      const date = new Date(Date.UTC(2025, 5, 15));
      const result = service.generateICalendarFile({ ...event, startTime: '09:00', endTime: '10:00' }, date, 'June 15', undefined, undefined, 'Europe/Zurich');
      expect(result).toContain('DTSTART:20250615T070000Z');
      expect(result).toContain('DTEND:20250615T080000Z');
    });

    it('uses UTC format (Z suffix) for timed events without an explicit timezone', () => {
      const event = makeEvent({ startTime: '09:00', endTime: '10:00' });
      const date = new Date(Date.UTC(2025, 5, 15));
      const result = service.generateICalendarFile(event, date, 'June 15');
      expect(result).not.toContain('VTIMEZONE');
      expect(result).toMatch(/DTSTART:\d{8}T\d{6}Z/);
    });
  });

  describe('meeting info in description', () => {
    it('adds meeting duration to description', () => {
      const event = makeEvent({ isMeeting: true, meetingDuration: 60 });
      const date = new Date(Date.UTC(2025, 5, 15));
      const slotStart = new Date(2025, 5, 15, 9, 0);
      const slotEnd = new Date(2025, 5, 15, 10, 0);
      const result = service.generateICalendarFile(event, date, 'June 15', slotStart, slotEnd);
      expect(result).toContain('DESCRIPTION:A test event\\nMeeting Duration: 60 minutes');
      expect(result.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/);
    });
  });

  describe('generateMultiEventCalendar', () => {
    it('applies summer offsets when converting wall-clock times to UTC', () => {
      const result = service.generateMultiEventCalendar([{
        summary: 'Summer meeting', allDay: false, timezone: 'Europe/Zurich', uid: 'summer@x',
        start: new Date(Date.UTC(2026, 8, 12, 9)), end: new Date(Date.UTC(2026, 8, 12, 10))
      }]);
      expect(result).toContain('DTSTART:20260912T070000Z');
      expect(result).toContain('DTEND:20260912T080000Z');
    });

    it('wraps all entries in a single VCALENDAR', () => {
      const result = service.generateMultiEventCalendar([
        { summary: 'Dinner', allDay: true, start: new Date(Date.UTC(2025, 6, 5)), uid: 'a@okdates.web.app' },
        { summary: 'Dinner', allDay: true, start: new Date(Date.UTC(2025, 6, 6)), uid: 'b@okdates.web.app' }
      ]);

      expect((result.match(/BEGIN:VCALENDAR/g) || []).length).toBe(1);
      expect((result.match(/END:VCALENDAR/g) || []).length).toBe(1);
      expect((result.match(/BEGIN:VEVENT/g) || []).length).toBe(2);
      expect((result.match(/END:VEVENT/g) || []).length).toBe(2);
      expect(result).toContain('UID:a@okdates.web.app');
      expect(result).toContain('UID:b@okdates.web.app');
    });

    it('uses CRLF line endings', () => {
      const result = service.generateMultiEventCalendar([
        { summary: 'X', allDay: true, start: new Date(Date.UTC(2025, 6, 5)), uid: 'a@x' }
      ]);
      expect(result).toContain('\r\n');
    });

    it('emits all-day entries as DATE values with an exclusive next-day DTEND', () => {
      const result = service.generateMultiEventCalendar([
        { summary: 'Dinner', allDay: true, start: new Date(Date.UTC(2025, 6, 5)), uid: 'a@x' }
      ]);
      expect(result).toContain('DTSTART;VALUE=DATE:20250705');
      expect(result).toContain('DTEND;VALUE=DATE:20250706');
    });

    it('rolls over month/year boundaries for the all-day DTEND', () => {
      const result = service.generateMultiEventCalendar([
        { summary: 'NYE', allDay: true, start: new Date(Date.UTC(2025, 11, 31)), uid: 'a@x' }
      ]);
      expect(result).toContain('DTSTART;VALUE=DATE:20251231');
      expect(result).toContain('DTEND;VALUE=DATE:20260101');
    });

    it('converts wall-clock intervals to UTC without malformed timezone blocks', () => {
      // Wall-clock 14:00-16:00 stored as UTC seconds
      const start = new Date(Date.UTC(2025, 2, 15, 14, 0, 0));
      const end = new Date(Date.UTC(2025, 2, 15, 16, 0, 0));
      const result = service.generateMultiEventCalendar([
        { summary: 'Meeting', allDay: false, start, end, timezone: 'Europe/Zurich', uid: 'a@x' }
      ]);
      expect(result).not.toContain('VTIMEZONE');
      expect(result).toContain('DTSTART:20250315T130000Z');
      expect(result).toContain('DTEND:20250315T150000Z');
    });

    it('exports multiple timed events without requiring timezone definitions', () => {
      const start = new Date(Date.UTC(2025, 2, 15, 14, 0, 0));
      const end = new Date(Date.UTC(2025, 2, 15, 16, 0, 0));
      const result = service.generateMultiEventCalendar([
        { summary: 'A', allDay: false, start, end, timezone: 'Europe/Zurich', uid: 'a@x' },
        { summary: 'B', allDay: false, start, end, timezone: 'Europe/Zurich', uid: 'b@x' }
      ]);
      expect(result).not.toContain('VTIMEZONE');
      expect((result.match(/DTSTART:20250315T130000Z/g) || []).length).toBe(2);
    });

    it('includes SUMMARY, DESCRIPTION and LOCATION when provided', () => {
      const result = service.generateMultiEventCalendar([
        { summary: 'Team Dinner', description: 'Bring cake', location: 'Luigi\'s', allDay: true, start: new Date(Date.UTC(2025, 6, 5)), uid: 'a@x' }
      ]);
      expect(result).toContain('SUMMARY:Team Dinner');
      expect(result).toContain('DESCRIPTION:Bring cake');
      expect(result).toContain('LOCATION:Luigi\'s');
    });

    it('omits DESCRIPTION and LOCATION when absent', () => {
      const result = service.generateMultiEventCalendar([
        { summary: 'Plain', allDay: true, start: new Date(Date.UTC(2025, 6, 5)), uid: 'a@x' }
      ]);
      expect(result).not.toContain('DESCRIPTION:');
      expect(result).not.toContain('LOCATION:');
    });

    it('escapes special characters in text fields', () => {
      const result = service.generateMultiEventCalendar([
        { summary: 'A;B,C', allDay: true, start: new Date(Date.UTC(2025, 6, 5)), uid: 'a@x' }
      ]);
      expect(result).toContain('SUMMARY:A\\;B\\,C');
    });

    it('falls back to "Untitled Event" for an empty summary', () => {
      const result = service.generateMultiEventCalendar([
        { summary: '', allDay: true, start: new Date(Date.UTC(2025, 6, 5)), uid: 'a@x' }
      ]);
      expect(result).toContain('SUMMARY:Untitled Event');
    });
  });
});
