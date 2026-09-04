## ADDED Requirements
### Requirement: Template-driven visual tokens
The system SHALL render every page from one set of templates whose colours, type, radii and control
typography come exclusively from CSS custom properties defined per template (`okdates-theme`,
`vanguard-theme`).

#### Scenario: Switching template changes only presentation
- **WHEN** the same route is opened with `?theme=okdates` and `?theme=vanguard`
- **THEN** the page structure, controls and behaviour are identical and only tokens differ

### Requirement: Availability matrix highlights the slot everyone can make
The availability matrix SHALL visually distinguish a date or time slot where every participant is
available using the template's accent colour, and SHALL show per-slot availability as available,
partial or unavailable states.

#### Scenario: Everyone is free on one date
- **WHEN** all participants include the same date
- **THEN** that column is painted with the accent and labelled as available for everyone

### Requirement: Accessible controls
All interactive controls SHALL show a visible keyboard focus ring and SHALL not rely on motion:
animations MUST be disabled when the user prefers reduced motion.

#### Scenario: Keyboard user tabs through a form
- **WHEN** a control receives keyboard focus
- **THEN** a visible focus outline is rendered in both templates
