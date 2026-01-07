# Project Context

## Purpose
OkDates is an intelligent event scheduling tool that makes it easy to find dates that work for everyone in a group. The application features AI-powered natural language date parsing, allowing participants to enter their availability in plain text (e.g., "next Tuesday and Thursday afternoon") which is then converted into structured date/time data.

**Core Goals:**
- Simplify group scheduling with minimal friction
- Provide intuitive natural language availability input
- Generate shareable participant and admin links for events
- Show aggregated availability across all participants

## Tech Stack
- **Frontend**: Angular (TypeScript)
- **Backend**: Firebase
  - Firestore (database)
  - Cloud Functions (Node.js, TypeScript)
  - Firebase Hosting
- **AI/LLM**: OpenRouter API (meta-llama/llama-4-maverick)
- **Region**: europe-west1 (Firebase Functions)

## Project Conventions

### Code Style
- TypeScript for all frontend and backend code
- Angular style guide for component structure
- Service-oriented architecture with clear separation of concerns
- Use of Angular modules for feature organization

### Architecture Patterns
**Frontend Structure:**
- `/src/app/core`: Core models and services
  - `models/`: Data models (Event, Participant, ParsedDate)
  - `services/`: Services for Firebase interaction, date parsing, participant management
- `/src/app/modules`: Feature modules
  - `event/`: Event creation and viewing
  - `participant/`: Participant form for entering availability
  - `home/`: Landing page

**Backend Structure:**
- `/functions/src/`: Cloud Functions organized by domain
  - `events/`: Event management functions
  - `participants/`: Participant data functions
  - `parsing/`: Date parsing with LLM integration
- HTTP Callable functions for frontend integration
- CORS-enabled HTTP endpoints for external access

**Data Flow:**
1. User creates event with title and description
2. System generates unique participant and admin links
3. Participants enter availability in natural language
4. AI-powered parser converts text to structured dates
5. Event view shows aggregated availability

### Testing Strategy
- Use `npm test` for running tests
- Focus on core parsing and data transformation logic
- Test both server-side (LLM) and client-side (fallback) parsing paths

### Git Workflow
- Main branch: `main`
- Commit messages should be concise and descriptive
- Include co-authorship attribution for AI-assisted commits

## Domain Context
**Event Scheduling Domain:**
- Events have unique participant links (for sharing) and admin links (for management)
- Participants provide availability as natural language text
- System aggregates availability across all participants
- Timeline-based availability selection is supported for visual date picking
- Admin features include password protection and sharing controls

**Date Parsing:**
- Primary method: LLM-based parsing via OpenRouter API
- Fallback method: Client-side basic parsing when API unavailable
- Supports relative dates ("next Tuesday"), absolute dates, and time ranges

## Important Constraints
- **API Keys**: OpenRouter API key required for LLM functionality
  - Stored in `keys/openrouter.key` (never committed)
  - Template files provided for configuration
  - Production deployment uses Firebase Functions config
- **Firebase Region**: All functions must deploy to `europe-west1`
- **Security**: API keys and sensitive configuration never committed to repository
- **Client-side Fallback**: Application must gracefully handle LLM API unavailability

## External Dependencies
**OpenRouter API:**
- Primary LLM provider for natural language date parsing
- Model: `meta-llama/llama-4-maverick`
- Authentication requires API key in HTTP headers
- Configuration:
  ```typescript
  baseURL: 'https://openrouter.ai/api/v1'
  headers: {
    'HTTP-Referer': 'https://okdates.web.app',
    'X-Title': 'OkDates App'
  }
  ```

**Firebase Services:**
- Firestore collections: `events`, `event-participants`
- Cloud Functions for backend logic
- Firebase Hosting for production deployment
