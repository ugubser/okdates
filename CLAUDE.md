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

The application requires an OpenRouter API key for LLM-based date parsing functionality:

1. Create a file `keys/openrouter.key` in the project root with your OpenRouter API key, or 
2. Run `./start-emulator.sh` which will prompt for the API key if not found and save it to the appropriate file.

The key is stored securely and never committed to the repository. The repository contains template files without actual API keys:
- `functions/ai.config.template.json`
- `src/assets/ai.config.template.json`
- `functions/.runtimeconfig.template.json`

When deploying to production, set the API key in Firebase Functions config:
```bash
firebase functions:config:set openrouter.api_key="YOUR_API_KEY" openrouter.model="meta-llama/llama-4-maverick"
```

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
   - Supports both server-side (LLM) and client-side (basic) date parsing for fallback

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
- Features client-side fallback parsing when API is unavailable

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