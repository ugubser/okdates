# Change: Restore iCalendar Download for Administrators

## Why
The application previously had functionality to download .ics (iCalendar) files for individual dates/time slots. The backend service (`ical.service.ts`) and component method (`downloadICalForDate()`) still exist, but the UI buttons were removed in subsequent changes. Administrators need the ability to export calendar events to add confirmed dates to their calendars and share with participants.

## What Changes
- Add download buttons in the availability timeline for administrators
- Restrict .ics download functionality to admin users only
- Support both regular events (date-based) and meetings (time-slot based)
- Place download buttons next to each date/time slot in the availability view

## Impact
- **Affected specs**: `calendar-export`
- **Affected code**:
  - `src/app/modules/event/view/event-view.component.html` - Add download button UI
  - `src/app/shared/availability-timeline/availability-timeline.component.ts` - May need to pass admin flag and emit download events
  - `src/app/shared/availability-timeline/availability-timeline.component.html` - Add download buttons if timeline component handles rendering
- **No breaking changes** - This is a pure UI addition using existing backend functionality
