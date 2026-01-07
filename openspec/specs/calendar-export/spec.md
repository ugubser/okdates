# calendar-export Specification

## Purpose
TBD - created by archiving change restore-ics-download-admin. Update Purpose after archive.
## Requirements
### Requirement: Administrator iCalendar Export
Administrators SHALL be able to download individual dates or time slots as iCalendar (.ics) files from the event availability view.

#### Scenario: Admin downloads regular event date
- **GIVEN** a user is viewing an event as an administrator
- **AND** the event has participant availability data for multiple dates
- **WHEN** the administrator clicks a download button next to a date
- **THEN** an iCalendar file is generated and downloaded
- **AND** the filename includes the event title and date (e.g., "my_event_2026-01-15.ics")
- **AND** the .ics file contains the event title, description, location, and date

#### Scenario: Admin downloads meeting time slot
- **GIVEN** a user is viewing a meeting (time-based event) as an administrator
- **AND** the meeting has time slot availability data
- **WHEN** the administrator clicks a download button next to a time slot
- **THEN** an iCalendar file is generated and downloaded
- **AND** the filename includes the event title, date, and time (e.g., "meeting_2026-01-15_0900.ics")
- **AND** the .ics file contains the event title, description, location, start time, end time, and timezone

#### Scenario: Non-admin user cannot see download buttons
- **GIVEN** a user is viewing an event without administrator privileges
- **WHEN** the availability timeline is displayed
- **THEN** no download buttons are visible in the date/time slot headers
- **AND** the user cannot download iCalendar files

### Requirement: Download Button Placement
Download buttons for iCalendar export SHALL be placed in the availability timeline headers for easy access.

#### Scenario: Download button in date header
- **GIVEN** an administrator is viewing the availability timeline
- **WHEN** the timeline is rendered
- **THEN** each date or time slot header contains a small download icon button
- **AND** the button has a tooltip indicating "Download .ics file"
- **AND** the button is styled to be unobtrusive but clearly clickable

### Requirement: iCalendar File Generation
Generated iCalendar files SHALL conform to RFC 5545 specifications and be compatible with standard calendar applications.

#### Scenario: Calendar application compatibility
- **GIVEN** an administrator has downloaded an iCalendar file
- **WHEN** the file is imported into Google Calendar, Apple Calendar, or Microsoft Outlook
- **THEN** the event is created successfully
- **AND** the event displays the correct title, description, location, date, and time
- **AND** timezone information is preserved correctly for meetings

