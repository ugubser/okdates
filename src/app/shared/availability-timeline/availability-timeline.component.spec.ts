import { AvailabilityTimelineComponent } from './availability-timeline.component';

describe('AvailabilityTimelineComponent', () => {
  let component: AvailabilityTimelineComponent;
  beforeEach(() => {
    component = new AvailabilityTimelineComponent();
    component.event = { isMeeting: false } as any;
  });

  it('uses the same calendar day for the date key and label in every timezone', () => {
    component.participants = [{ id: 'alice', name: 'Alice', parsedDates: [
      { timestamp: { seconds: Date.UTC(2026, 8, 12) / 1000 } }
    ] }] as any;
    component.processAvailabilityData();
    expect(component.uniqueDates[0].dateString).toBe('2026-09-12');
    expect(component.uniqueDates[0].formattedDate).toBe('Sat, Sep 12');
    expect(component.getAvailableCountForDate('2026-09-12')).toBe(1);
  });

  function meeting(start: string, end: string, zone = 'UTC') {
    component.event = { isMeeting: true, meetingDuration: 60 } as any;
    component.viewerTimezone = 'UTC';
    component.participants = [{ id: 'alice', name: 'Alice', parsedDates: [{
      startTimestamp: { seconds: Date.parse(start) / 1000 },
      endTimestamp: { seconds: Date.parse(end) / 1000 }, timezone: zone
    }] }] as any;
  }

  it('shows valid slots on both sides of midnight', () => {
    meeting('2026-09-12T23:00:00Z', '2026-09-13T01:00:00Z');
    component.processAvailabilityData();
    expect(component.uniqueDates.map(d => d.dateString)).toEqual(['2026-09-12-23-00', '2026-09-13-00-00']);
    expect(component.commonAvailableSlots).toHaveLength(2);
  });

  it('includes intermediate days of multi-day availability', () => {
    meeting('2026-09-12T23:00:00Z', '2026-09-15T01:00:00Z');
    component.processAvailabilityData();
    expect(component.uniqueDates.map(d => d.dateString)).toContain('2026-09-14-00-00');
  });

  it('handles a midnight crossing caused by conversion to the viewer timezone', () => {
    meeting('2026-09-12T16:00:00Z', '2026-09-12T18:00:00Z', 'America/Los_Angeles');
    component.processAvailabilityData();
    expect(component.uniqueDates.map(d => d.dateString)).toEqual(['2026-09-12-23-00', '2026-09-13-00-00']);
  });

  it('keeps start-anchored common slots and marks insufficient windows partial', () => {
    meeting('2026-09-12T09:00:00Z', '2026-09-12T17:00:00Z');
    component.event.meetingDuration = 120;
    component.participants.push({ id: 'bob', name: 'Bob', parsedDates: [{
      startTimestamp: { seconds: Date.parse('2026-09-12T13:00:00Z') / 1000 },
      endTimestamp: { seconds: Date.parse('2026-09-12T14:00:00Z') / 1000 }, timezone: 'UTC'
    }] } as any);
    component.processAvailabilityData();
    expect(component.getParticipantSlotState(component.participants[1], '2026-09-12-13-00')).toBe('partial');
    expect(component.commonAvailableSlots).toHaveLength(0);
  });

  it('notifies the parent of existing date selections without requiring a click', async () => {
    component.preselectedSlots = ['2026-09-12'];
    const notify = jest.fn();
    component.slotsSelected.subscribe(notify);
    component.ngOnInit();
    await new Promise<void>(resolve => queueMicrotask(resolve));
    expect(notify).toHaveBeenCalledWith(['2026-09-12']);
  });
});
