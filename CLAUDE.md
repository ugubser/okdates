<!-- OPENSPEC:START -->
# OpenSpec Instructions

These instructions are for AI assistants working in this project.

Always open `@/openspec/AGENTS.md` when the request:
- Mentions planning or proposals (words like proposal, spec, change, plan)
- Introduces new capabilities, breaking changes, architecture shifts, or big performance/security work
- Sounds ambiguous and you need the authoritative spec before coding

Use `@/openspec/AGENTS.md` to learn:
- How to create and apply change proposals
- Spec format and conventions
- Project structure and guidelines

Keep this managed block so 'openspec update' can refresh the instructions.

<!-- OPENSPEC:END -->

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

OkDates is an intelligent event scheduling tool built with Angular and Firebase that makes it easy to find dates that work for everyone in a group. It features AI-powered date parsing to handle natural language input for date availability.

## Key Commands

### Development

```bash
# Install dependencies (root and functions)
npm install
cd functions && npm install && cd ..

# Start development server with Firebase emulators
npm run dev

# Start Angular development server only
npm run serve

# Start Firebase emulators only
npm run emulator

# Build for development
npm run build

# Build for production
npm run build:prod

# Deploy to Firebase (production build + deploy)
npm run deploy

# Run tests
npm test
```

## API Keys and Configuration

The application requires an OpenRouter API key for LLM-based date parsing functionality.
The key is configured via `functions/.env`, which Firebase loads into `process.env` for
**both** the emulator and `firebase deploy` — one source of truth for local and prod.

Set it up one of two ways:

1. Copy `functions/.env.template` to `functions/.env` and fill in `OPENROUTER_API_KEY`, or
2. Run `./start-emulator.sh`, which prompts for the key (stored in `keys/openrouter.key`)
   and writes `functions/.env` for you.

`functions/.env` is gitignored and never committed; `functions/.env.template` is the
committed placeholder. The function's key loader (`functions/src/parsing/llm-parser.ts`)
reads `OPENROUTER_API_KEY` / `OPENROUTER_MODEL` / `OPENROUTER_BASE_URL` from the
environment, with `keys/openrouter.key` as a local file fallback.

Deploying to production picks up `functions/.env` automatically (`firebase deploy`).
For stronger secret handling, use Cloud Secret Manager via firebase-functions
`defineSecret('OPENROUTER_API_KEY')` instead of the .env value.

Note: the legacy `functions.config()` API and the `ai.config.json` / `.runtimeconfig.json`
files have been retired.

## Architecture

### Core Components

1. **Frontend (Angular)**
   - `/src/app/core`: Core models and services
     - `models/`: Data models (Event, Participant, ParsedDate)
     - `services/`: Services for Firebase interaction, date parsing, and participant management
   - `/src/app/modules`: Feature modules
     - `event/`: Event creation and viewing
     - `participant/`: Participant form for entering availability
     - `home/`: Landing page

2. **Backend (Firebase)**
   - `/functions/src/`: Cloud Functions
     - `events/`: Event management functions
     - `participants/`: Participant data functions
     - `parsing/`: Date parsing with LLM integration

3. **LLM Integration**
   - `/functions/src/parsing/llm-parser.ts`: Handles natural language date parsing using OpenRouter API
   - Server-side (LLM) parsing with backend basicDateParsing fallback

### Data Flow

1. User creates an event with title and description
2. System generates unique participant and admin links
3. Participants enter their name and availability in natural language
4. AI-powered date parser converts text into structured dates
5. Event view shows aggregated availability across all participants

## API Integration

The application uses OpenRouter API to access LLM capabilities for date parsing. The integration is in `functions/src/parsing/llm-parser.ts` and follows these key principles:

- Uses the OpenAI client library for API interaction
- Properly sets required headers for OpenRouter
- Implements a robust key loading sequence with fallbacks
- Backend has basicDateParsing fallback when LLM is unavailable

### OpenRouter Authentication

```typescript
const openai = new OpenAI({
  apiKey: openRouterKey, 
  baseURL: 'https://openrouter.ai/api/v1',
  defaultHeaders: {
    'HTTP-Referer': 'https://okdates.web.app',
    'X-Title': 'OkDates App'
  }
});
```

## Firebase Structure

- **Collections**:
  - `events`: Stores event metadata
  - `event-participants`: Stores participant availability data
  
- **Functions**:
  - HTTP Callable functions for frontend integration
  - CORS-enabled HTTP endpoints for external access
  - Functions run in the `europe-west1` region

## Known Technical Debt

The following architectural issues were identified during code review (Feb 2026):

1. ~~**Admin key exposed in URL path**~~ — **RESOLVED.** Admin keys now use URL fragments (`#admin=KEY`) which are never sent to servers or included in referrer headers. Old `/event/:id/admin/:key` URLs redirect to the view page.

2. ~~**No rate limiting on Cloud Functions**~~ — **RESOLVED.** All callable Cloud Functions (`createEvent`, `getEvent`, `addParticipant`, `getParticipants`, `parseDates`) now enforce Firebase App Check via `context.app` validation, with an emulator bypass for local development.

3. ~~**~150 lines duplicate date parsing (client vs backend)**~~ — **RESOLVED.** Client-side `parseClientSide()` and helpers removed from `date-parsing.service.ts`. The backend's `basicDateParsing()` fallback handles LLM failures; the frontend surfaces errors to the user.

4. **OnPush for event-view component** — Deferred. Would improve rendering performance but requires `ChangeDetectorRef.markForCheck()` after every async operation (data load, dialog close, admin verification). High risk of subtle rendering bugs. The safer approach is extracting admin panel and share section into OnPush child components.