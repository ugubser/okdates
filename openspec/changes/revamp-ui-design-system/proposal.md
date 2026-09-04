# Change: Revamp the UI with a token-driven design system for both templates

## Why
The current UI is an unthemed Angular Material default with two thin colour overrides. Neither
template has a point of view: OkDates looks like a stock Material demo, and the Vanguard skin only
recolours it. All functionality stays; only the presentation changes.

## What Changes
- New design-token layer per template (`_okdates.scss`, `_vanguard.scss`) covering colour, type,
  radius, control typography and semantic availability colours.
- Global component classes (`.btn`, `.field`, `.segmented`, `.check`, `.panel`, `.link-box`,
  `.spinner`) replace Material form fields, buttons, toggles, checkboxes and selection lists.
  Material is kept only for the dialog, tooltip and the availability table.
- Every page template is rewritten around the new system: app shell, home, event creation/edit,
  event view, participant form, iCal generator, availability timeline and the admin password dialog.
- OkDates template: chalk/ink palette with a marigold "highlighter" accent, Bricolage Grotesque type.
- Vanguard template: tokens taken from vanguardsignals.com (near-black ground, cyan signal accent,
  brother-1816 + IBM Plex Mono, zero radius, mono uppercase buttons with wipe-fill hover).
- No functional change: routes, forms, validation, admin flows, parsing and iCal output are untouched.

## Impact
- Affected specs: ui-design-system (new)
- Affected code: `src/styles.scss`, `src/styles/themes/*`, `src/index.html`, `src/app/app.component.*`,
  all `src/app/modules/**` templates and styles, `src/app/shared/availability-timeline/*`,
  `participant-form.component.ts` (selection list replaced by a boolean array).
