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
      const date = new Date(2025, 5, 15); // June 15 2025
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
      const date = new Date(2025, 5, 15);
      const result = service.generateICalendarFile(event, date, 'June 15, 2025');
      expect(result).toContain('test-event-id@okdates.web.app');
    });

    it('uses CRLF line endings per RFC 5545', () => {
      const event = makeEvent();
      const date = new Date(2025, 5, 15);
      const result = service.generateICalendarFile(event, date, 'June 15, 2025');
      expect(result).toContain('\r\n');
    });
  });

  describe('SUMMARY and LOCATION', () => {
    it('includes SUMMARY from event title', () => {
      const event = makeEvent({ title: 'Team Meeting' });
      const date = new Date(2025, 5, 15);
      const result = service.generateICalendarFile(event, date, 'June 15');
      expect(result).toContain('SUMMARY:Team Meeting');
    });

    it('uses "Untitled Event" when title is null', () => {
      const event = makeEvent({ title: null });
      const date = new Date(2025, 5, 15);
      const result = service.generateICalendarFile(event, date, 'June 15');
      expect(result).toContain('SUMMARY:Untitled Event');
    });

    it('includes LOCATION when present', () => {
      const event = makeEvent({ location: 'Room 101' });
      const date = new Date(2025, 5, 15);
      const result = service.generateICalendarFile(event, date, 'June 15');
      expect(result).toContain('LOCATION:Room 101');
    });

    it('omits LOCATION when not present', () => {
      const event = makeEvent({ location: null });
      const date = new Date(2025, 5, 15);
      const result = service.generateICalendarFile(event, date, 'June 15');
      expect(result).not.toContain('LOCATION:');
    });
  });

  describe('text escaping', () => {
    it('escapes semicolons', () => {
      const event = makeEvent({ title: 'A;B' });
      const date = new Date(2025, 5, 15);
      const result = service.generateICalendarFile(event, date, 'June 15');
      expect(result).toContain('SUMMARY:A\\;B');
    });

    it('escapes commas', () => {
      const event = makeEvent({ title: 'A,B' });
      const date = new Date(2025, 5, 15);
      const result = service.generateICalendarFile(event, date, 'June 15');
      expect(result).toContain('SUMMARY:A\\,B');
    });

    it('escapes backslashes', () => {
      const event = makeEvent({ title: 'A\\B' });
      const date = new Date(2025, 5, 15);
      const result = service.generateICalendarFile(event, date, 'June 15');
      expect(result).toContain('SUMMARY:A\\\\B');
    });

    it('escapes newlines', () => {
      const event = makeEvent({ description: 'Line1\nLine2' });
      const date = new Date(2025, 5, 15);
      const result = service.generateICalendarFile(event, date, 'June 15');
      expect(result).toContain('DESCRIPTION:Line1\\nLine2');
    });
  });

  describe('all-day event (no start/end time)', () => {
    it('generates DTSTART and DTEND for full day in UTC', () => {
      const event = makeEvent();
      const date = new Date(2025, 5, 15); // June 15, 2025
      const result = service.generateICalendarFile(event, date, 'June 15');
      // All-day: starts at 00:00:00, ends at 23:59:59
      expect(result).toMatch(/DTSTART:\d{8}T\d{6}Z/);
      expect(result).toMatch(/DTEND:\d{8}T\d{6}Z/);
    });
  });

  describe('timed event (startTime/endTime)', () => {
    it('uses event startTime and endTime', () => {
      const event = makeEvent({ startTime: '09:00', endTime: '17:00' });
      const date = new Date(2025, 5, 15);
      const result = service.generateICalendarFile(event, date, 'June 15');
      expect(result).toMatch(/DTSTART:\d{8}T\d{6}Z/);
      expect(result).toMatch(/DTEND:\d{8}T\d{6}Z/);
    });
  });

  describe('meeting slots (slotStart/slotEnd)', () => {
    it('uses slotStart and slotEnd for meeting mode', () => {
      const event = makeEvent({ isMeeting: true });
      const date = new Date(2025, 5, 15);
      const slotStart = new Date(2025, 5, 15, 9, 0);
      const slotEnd = new Date(2025, 5, 15, 12, 0);
      const result = service.generateICalendarFile(event, date, 'June 15', slotStart, slotEnd);
      expect(result).toMatch(/DTSTART:\d{8}T\d{6}Z/);
      expect(result).toMatch(/DTEND:\d{8}T\d{6}Z/);
    });
  });

  describe('timezone handling', () => {
    it('includes VTIMEZONE block when timezone is provided', () => {
      const event = makeEvent();
      const date = new Date(2025, 5, 15);
      const result = service.generateICalendarFile(event, date, 'June 15', undefined, undefined, 'Europe/Zurich');
      expect(result).toContain('BEGIN:VTIMEZONE');
      expect(result).toContain('TZID:Europe/Zurich');
      expect(result).toContain('END:VTIMEZONE');
    });

    it('uses DTSTART;TZID= format when timezone is provided', () => {
      const event = makeEvent();
      const date = new Date(2025, 5, 15);
      const result = service.generateICalendarFile(event, date, 'June 15', undefined, undefined, 'Europe/Zurich');
      expect(result).toContain('DTSTART;TZID=Europe/Zurich:');
    });

    it('uses UTC format (Z suffix) when no timezone', () => {
      const event = makeEvent();
      const date = new Date(2025, 5, 15);
      const result = service.generateICalendarFile(event, date, 'June 15');
      expect(result).not.toContain('VTIMEZONE');
      expect(result).toMatch(/DTSTART:\d{8}T\d{6}Z/);
    });
  });

  describe('meeting info in description', () => {
    it('adds meeting duration to description', () => {
      const event = makeEvent({ isMeeting: true, meetingDuration: 60 });
      const date = new Date(2025, 5, 15);
      const slotStart = new Date(2025, 5, 15, 9, 0);
      const slotEnd = new Date(2025, 5, 15, 10, 0);
      const result = service.generateICalendarFile(event, date, 'June 15', slotStart, slotEnd);
      expect(result).toContain('Meeting Duration: 60 minutes');
    });
  });
});
