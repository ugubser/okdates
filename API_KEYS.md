# API Key Management

This document describes how API keys are managed in the OkDates application to ensure security and prevent accidental commits to version control.

## OpenRouter API Keys

OkDates uses the OpenRouter API for LLM capabilities. The API key is never stored in the repository but is injected at runtime using the following methods.

### Setting Up API Keys

The key lives in `functions/.env`, which Firebase loads into `process.env` for both the
emulator and `firebase deploy`. Set it up either way:

1. **Copy the template:**

   ```bash
   cp functions/.env.template functions/.env
   # then edit functions/.env and set OPENROUTER_API_KEY=sk-or-v1-...
   ```

   `functions/.env` is gitignored; `functions/.env.template` is the committed placeholder.

2. **Alternative: use the start script:**

   Run `./start-emulator.sh`, which prompts for your key (stored in `keys/openrouter.key`)
   and writes `functions/.env` automatically.

### Key Loading Sequence

The function's key loader (`functions/src/parsing/llm-parser.ts`) looks in this order:

1. Environment variables — `OPENROUTER_API_KEY` (`OPENROUTER_MODEL`, `OPENROUTER_BASE_URL`),
   populated from `functions/.env`.
2. Key file — `keys/openrouter.key` (local convenience fallback).

The legacy `functions.config()` API and the `ai.config.json` / `.runtimeconfig.json`
sources have been retired.

### Configuration Template

- `functions/.env.template` — committed placeholder for `functions/.env`.

### Development Workflow

1. Clone the repository
2. Run `./start-emulator.sh` (or `cp functions/.env.template functions/.env`)
3. When prompted, enter your OpenRouter API key
4. The script writes `functions/.env` with your key

### Deployment

`firebase deploy` picks up `functions/.env` automatically — no extra config step:

```bash
firebase deploy --only functions
```

For stronger production secret handling, use Cloud Secret Manager via firebase-functions
`defineSecret('OPENROUTER_API_KEY')` instead of the plaintext `.env` value.

### Security Notes

- Never commit API keys to the repository
- `functions/.env` is gitignored; only `functions/.env.template` is committed
- Consider Cloud Secret Manager for production
- Consider rotating API keys periodically for enhanced security

### OpenRouter Authentication Notes

Use the OpenAI client with OpenRouter by setting the API key directly:

```typescript
// CORRECT: Let the OpenAI client handle the auth header
const openai = new OpenAI({
  apiKey: openRouterKey, // OpenAI library adds Authorization header
  baseURL: 'https://openrouter.ai/api/v1',
  defaultHeaders: {
    'HTTP-Referer': 'https://example.com', // Required
    'X-Title': 'My App' // Required
  }
});
```

### Troubleshooting

If you experience authentication issues with OpenRouter:

1. **Check your API key**
   - Make sure the API key is in the expected format (`sk-or-v1-...`)
   - Verify the key is valid and not expired
   - Try generating a new key if authentication fails

2. **Authentication Errors**
   - If you see "Invalid JWT form" errors, the API key may not be correctly formatted
   - The error "No auth credentials found" might indicate the key is inactive or invalid

3. **Testing the API directly**
   - Use the test script at `functions/test-openrouter.js` to test direct API access
   - Run with `node functions/test-openrouter.js` to debug authentication issues

4. **Troubleshooting steps**
   - Try a direct fetch without the OpenAI library
   - Check the OpenRouter documentation for recent changes
   - Ensure you've set the required HTTP-Referer and X-Title headers
   - Consider using a different model if specific models are unavailable