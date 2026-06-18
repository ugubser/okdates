import { IcalGeneratorComponent } from './ical-generator.component';
import { DateParsingService } from '../../core/services/date-parsing.service';
import { ICalendarService, ICalEventInput } from '../../core/services/ical.service';
import { ParsedDate } from '../../core/models/parsed-date.model';

describe('IcalGeneratorComponent', () => {
  let component: IcalGeneratorComponent;
  let dateParsing: { parseWithTitle: jest.Mock };
  let ical: { generateMultiEventCalendar: jest.Mock; downloadICalFile: jest.Mock };

  beforeEach(() => {
    dateParsing = { parseWithTitle: jest.fn() };
    ical = {
      generateMultiEventCalendar: jest.fn().mockReturnValue('BEGIN:VCALENDAR'),
      downloadICalFile: jest.fn()
    };
    component = new IcalGeneratorComponent(
      dateParsing as unknown as DateParsingService,
      ical as unknown as ICalendarService
    );
    component.ngOnInit();
  });

  function lastEvents(): ICalEventInput[] {
    return ical.generateMultiEventCalendar.mock.calls[
      ical.generateMultiEventCalendar.mock.calls.length - 1
    ][0];
  }

  it('defaults to all-day mode and the local timezone', () => {
    expect(component.mode).toBe('dates');
    expect(component.isMeeting).toBe(false);
    expect(component.timezone).toBeTruthy();
  });

  it('always includes the user timezone in the dropdown without duplicates', () => {
    const values = component.timezones.map(t => t.value);
    expect(values.length).toBe(new Set(values).size);
    expect(values).toContain(component.timezone);
  });

  describe('parse()', () => {
    it('does nothing for blank input', async () => {
      component.rawInput = '   ';
      await component.parse();
      expect(dateParsing.parseWithTitle).not.toHaveBeenCalled();
      expect(component.showResults).toBe(false);
    });

    it('parses dates, checks all entries and pre-fills an empty title', async () => {
      const dates: ParsedDate[] = [
        { originalText: '2025-07-05', timestamp: { seconds: 1751673600, nanoseconds: 0 }, isConfirmed: false },
        { originalText: '2025-07-06', timestamp: { seconds: 1751760000, nanoseconds: 0 }, isConfirmed: false }
      ];
      dateParsing.parseWithTitle.mockResolvedValue({ title: 'Summer Trip', dates });

      component.rawInput = 'July 5, July 6';
      await component.parse();

      expect(dateParsing.parseWithTitle).toHaveBeenCalledWith('July 5, July 6', false, null);
      expect(component.parsedDates.length).toBe(2);
      expect(component.selected).toEqual([true, true]);
      expect(component.title).toBe('Summer Trip');
      expect(component.showResults).toBe(true);
    });

    it('does not overwrite a user-provided title', async () => {
      dateParsing.parseWithTitle.mockResolvedValue({ title: 'LLM Title', dates: [] });
      component.title = 'My Title';
      component.rawInput = 'July 5';
      await component.parse();
      expect(component.title).toBe('My Title');
    });

    it('passes the selected timezone when in times mode', async () => {
      dateParsing.parseWithTitle.mockResolvedValue({ title: 't', dates: [] });
      component.mode = 'times';
      component.timezone = 'Europe/Zurich';
      component.rawInput = 'Monday 9-10am';
      await component.parse();
      expect(dateParsing.parseWithTitle).toHaveBeenCalledWith('Monday 9-10am', true, 'Europe/Zurich');
    });

    it('surfaces parse errors', async () => {
      dateParsing.parseWithTitle.mockRejectedValue(new Error('boom'));
      component.rawInput = 'nonsense';
      await component.parse();
      expect(component.parseError).toBe('boom');
      expect(component.parsedDates).toEqual([]);
      expect(component.showResults).toBe(true);
    });
  });

  describe('download()', () => {
    it('builds all-day entries from checked dates only', () => {
      component.title = 'Trip';
      component.location = 'Beach';
      component.mode = 'dates';
      component.parsedDates = [
        { originalText: 'a', timestamp: { seconds: 1751673600, nanoseconds: 0 }, isConfirmed: false },
        { originalText: 'b', timestamp: { seconds: 1751760000, nanoseconds: 0 }, isConfirmed: false }
      ];
      component.selected = [true, false];

      component.download();

      const events = lastEvents();
      expect(events.length).toBe(1);
      expect(events[0].allDay).toBe(true);
      expect(events[0].summary).toBe('Trip');
      expect(events[0].location).toBe('Beach');
      expect(ical.downloadICalFile).toHaveBeenCalledWith('BEGIN:VCALENDAR', 'trip.ics');
    });

    it('builds timed entries with start/end/timezone in times mode', () => {
      component.title = 'Sync';
      component.mode = 'times';
      component.timezone = 'Europe/Zurich';
      component.parsedDates = [
        {
          originalText: 'x',
          startTimestamp: { seconds: 1742047200, nanoseconds: 0 },
          endTimestamp: { seconds: 1742054400, nanoseconds: 0 },
          isConfirmed: false
        }
      ];
      component.selected = [true];

      component.download();

      const events = lastEvents();
      expect(events.length).toBe(1);
      expect(events[0].allDay).toBe(false);
      expect(events[0].timezone).toBe('Europe/Zurich');
      expect(events[0].start instanceof Date).toBe(true);
      expect(events[0].end instanceof Date).toBe(true);
    });

    it('does nothing when no entries are selected', () => {
      component.parsedDates = [
        { originalText: 'a', timestamp: { seconds: 1751673600, nanoseconds: 0 }, isConfirmed: false }
      ];
      component.selected = [false];
      component.download();
      expect(ical.generateMultiEventCalendar).not.toHaveBeenCalled();
      expect(ical.downloadICalFile).not.toHaveBeenCalled();
    });

    it('falls back to "event.ics" when the title is blank', () => {
      component.title = '   ';
      component.parsedDates = [
        { originalText: 'a', timestamp: { seconds: 1751673600, nanoseconds: 0 }, isConfirmed: false }
      ];
      component.selected = [true];
      component.download();
      expect(ical.downloadICalFile).toHaveBeenCalledWith('BEGIN:VCALENDAR', 'event.ics');
    });
  });

  describe('onModeChange()', () => {
    it('clears prior results', () => {
      component.showResults = true;
      component.parsedDates = [{ originalText: 'a', timestamp: { seconds: 1, nanoseconds: 0 }, isConfirmed: false }];
      component.selected = [true];
      component.onModeChange();
      expect(component.showResults).toBe(false);
      expect(component.parsedDates).toEqual([]);
      expect(component.selected).toEqual([]);
    });
  });
});
