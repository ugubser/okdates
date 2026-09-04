## Context
Two templates share one Angular app. The template is chosen by hostname or `?theme=` and applied as
a class on `<html>`. Material components were used unthemed, so both skins fought MDC defaults.

## Goals / Non-Goals
- Goals: distinctive look per template; one set of templates; all behaviour preserved; keyboard focus
  visible; reduced motion respected; mobile layouts.
- Non-Goals: new features, copy that changes meaning, backend changes.

## Decisions
- Tokens over components. Every visual decision that differs between skins is a CSS custom property
  (`--bg`, `--ink`, `--accent`, `--radius-*`, `--btn-font`, `--btn-transform`...). Component SCSS only
  reads tokens. A small `:root.vanguard-theme` block adds the wipe-fill button hover, which cannot be
  expressed as a token.
- Native controls instead of Material form fields. Reactive forms bind to native inputs unchanged.
  The confirm step of the participant form uses a `selectedDates: boolean[]` array instead of
  `MatSelectionList`, which removes the `_elementRef` hack.
- Material stays for `MatDialog`, `MatTooltip` and `mat-table`. `mat.theme()` is included per root
  class (light for OkDates, dark for Vanguard) and system tokens are mapped to our tokens.
- OkDates palette: bg #F4F5F0, surface #FFFFFF, ink #16201B, marigold #F5C400 (highlighter, used for
  "everyone can" and selections only), pine #1F7A4D (available), amber #D9822B (partial),
  brick #C2412D (unavailable/danger). Type: Bricolage Grotesque (variable, optical size).
- Vanguard palette: bg #080a0b, surface #101416, raised #161b1e, ink #f1f4f2, muted #929da1,
  rules #333e43/#3e4a4f, signal #01f8f5, live #3dd68c, stopped #e0644f. Type: brother-1816 (Typekit,
  already loaded) + IBM Plex Mono for controls and links. Radius 0.
- The memorable element is the availability matrix: the column where everyone is free is painted
  with the accent like a highlighter stroke. Everything else stays quiet.

## Risks / Trade-offs
- Native `<select>` styling differs slightly across browsers → accepted; the trigger is styled and
  the panel is left native.
- brother-1816 depends on Typekit → fallback stack keeps layout stable.

## Migration Plan
Purely presentational; deploy as one change. Rollback is a revert.
