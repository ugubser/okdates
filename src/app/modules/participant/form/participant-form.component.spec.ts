import { FormBuilder } from '@angular/forms';
import { ParticipantFormComponent } from './participant-form.component';
import { AvailabilityTimelineComponent } from '../../../shared/availability-timeline/availability-timeline.component';

describe('ParticipantFormComponent regressions', () => {
  let component: ParticipantFormComponent;
  let router: any;
  let events: any;
  let participants: any;
  let admin: any;
  let parsing: any;
  const range = (start: string, end: string) => ({
    startTimestamp: { seconds: Date.parse(start) / 1000, nanoseconds: 0 },
    endTimestamp: { seconds: Date.parse(end) / 1000, nanoseconds: 0 }, timezone: 'UTC'
  });

  beforeEach(() => {
    router = { navigate: jest.fn() };
    events = { getEventDirect: jest.fn().mockResolvedValue({ isMeeting: true, meetingDuration: 120 }), verifyAdminKey: jest.fn() };
    participants = {
      getParticipantsDirect: jest.fn().mockResolvedValue([]),
      getParticipantDirect: jest.fn().mockResolvedValue({ name: 'Alice', rawDateInput: 'Monday', timezone: 'UTC', parsedDates: [] })
    };
    admin = { getAdminKey: jest.fn(), isPasswordVerified: jest.fn().mockReturnValue(true) };
    parsing = { parseLlm: jest.fn() };
    component = new ParticipantFormComponent(new FormBuilder(), { snapshot: { paramMap: { get: () => 'evt' } } } as any,
      router, events, participants, parsing, { isParticipantOwner: () => false } as any, admin);
    component.event = { isMeeting: true, meetingDuration: 120 } as any;
    component.participantForm.patchValue({ name: 'Alice', availability: 'Monday', timezone: 'UTC' });
  });

  it('shows the service-unavailable message from the backend', async () => {
    const alert = jest.spyOn(window, 'alert').mockImplementation(() => {});
    parsing.parseLlm.mockRejectedValue(new Error('The date-parsing service is temporarily unavailable. Please try again.'));
    await component.parseDates();
    expect(alert).toHaveBeenCalledWith(expect.stringContaining('temporarily unavailable'));
    expect(component.showParsedDates).toBe(false);
    alert.mockRestore();
  });

  it('round-trips date-only grid selections and labels without a timezone shift', () => {
    component.event = { isMeeting: false } as any;
    const dates = (component as any).convertSlotKeysToParsedDates(['2026-09-12']);
    expect(dates[0].timestamp.seconds).toBe(Date.UTC(2026, 8, 12) / 1000);
    expect((component as any).convertParsedDatesToSlotKeys(dates)).toEqual(['2026-09-12']);
    expect(component.formatDate(dates[0].timestamp)).toBe('Sat, Sep 12, 2026');
  });

  it('lets a password-verified organizer edit another participant', async () => {
    component.isEditMode = true;
    component.participantId = 'alice';
    await component.loadEvent();
    expect(component.isAdmin).toBe(true);
    expect(router.navigate).not.toHaveBeenCalled();
    expect(component.participantForm.get('name')?.value).toBe('Alice');
  });

  it('still rejects someone with neither ownership nor organizer access', async () => {
    admin.isPasswordVerified.mockReturnValue(false);
    component.isEditMode = true;
    component.participantId = 'alice';
    await component.loadEvent();
    expect(router.navigate).toHaveBeenCalledWith(['/event', 'evt', 'view']);
  });

  async function restoreGrid(end = '2026-09-12T17:00:00Z') {
    const original = range('2026-09-12T09:00:00Z', end);
    component.isEditMode = true;
    component.preselectedRanges = [original];
    const grid = new AvailabilityTimelineComponent();
    grid.event = component.event!;
    grid.mode = 'select'; grid.viewerTimezone = 'UTC';
    grid.participants = [{ id: 'alice', name: 'Alice', parsedDates: [original] }] as any;
    grid.preselectedRanges = [original];
    grid.selectionRestored.subscribe(keys => component.preselectedSlotKeys = keys);
    grid.slotsSelected.subscribe(keys => component.onSlotsSelected(keys));
    grid.ngOnInit();
    await new Promise<void>(resolve => queueMicrotask(resolve));
    return original;
  }

  it('preselects the full window and preserves its end when saving through the grid', async () => {
    const original = await restoreGrid();
    expect(component.selectedSlotKeys).toEqual(['2026-09-12-09-00', '2026-09-12-11-00', '2026-09-12-13-00', '2026-09-12-15-00']);
    await component.proceedWithSelectedSlots();
    expect(component.parsedDates).toHaveLength(1);
    expect(component.parsedDates[0].endTimestamp).toEqual(original.endTimestamp);
  });

  it('preserves the tail of a window beyond the final complete slot', async () => {
    const original = await restoreGrid('2026-09-12T17:30:00Z');
    await component.proceedWithSelectedSlots();
    expect(component.parsedDates[0].endTimestamp).toEqual(original.endTimestamp);
  });

  it('does not restore a window across an explicitly deselected slot', async () => {
    await restoreGrid();
    component.selectedSlotKeys = component.selectedSlotKeys.filter(key => key !== '2026-09-12-11-00');
    await component.proceedWithSelectedSlots();
    expect(component.parsedDates).toHaveLength(3);
    expect(component.parsedDates.some(d => d.startTimestamp.seconds === Date.parse('2026-09-12T11:00:00Z') / 1000)).toBe(false);
  });

  it('keeps the selected duration when a slot crosses the spring DST change', () => {
    component.event!.meetingDuration = 60;
    component.participantForm.patchValue({ timezone: 'Europe/Zurich' });
    const dates = (component as any).convertSlotKeysToParsedDates(['2026-03-29-01-30']);
    expect(new Date(dates[0].endTimestamp.seconds * 1000).toISOString()).toBe('2026-03-29T03:30:00.000Z');
  });
});
