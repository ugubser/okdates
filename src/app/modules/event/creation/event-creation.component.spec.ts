import { FormBuilder } from '@angular/forms';
import { EventCreationComponent } from './event-creation.component';

describe('EventCreationComponent edits', () => {
  it('explicitly clears optional fields so Firestore merge removes old values', async () => {
    const stored: any = { title: 'Dinner', location: 'Old room', startTime: '09:00', endTime: '10:00' };
    const events = { updateEvent: jest.fn(async (_id, data) => { Object.assign(stored, data); }) };
    const component = new EventCreationComponent(new FormBuilder(), events as any, {} as any,
      { getAdminKey: () => 'key' } as any, { snapshot: { paramMap: { get: () => 'evt' } } } as any,
      { url: '/event/evt/edit', navigate: jest.fn() } as any);
    component.eventForm.patchValue({ title: 'Dinner', location: '', startTime: null, endTime: null });
    await component.saveEvent();
    expect(stored).toMatchObject({ title: 'Dinner', location: null, startTime: null, endTime: null });
    component.ngOnDestroy();
  });
});
