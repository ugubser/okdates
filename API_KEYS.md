# API Key Management

This document describes how API keys are managed in the OkDates application to ensure security and prevent accidental commits to version control.

## OpenRouter API Keys

OkDates uses the OpenRouter API for LLM capabilities. The API key is never stored in the repository but is injected at runtime using the following methods.

### Setting Up API Keys

1. **Create a key file:**
   
   Create a file `keys/openrouter.key` in the project root with your OpenRouter API key:
   ```
   sk-or-v1-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

   This file is automatically ignored by git (.gitignore) to prevent accidental commits.

2. **Alternative: Use the start script:**
   
   Run `./start-emulator.sh` which will prompt for your API key if not found and save it to the appropriate file.

### Key Loading Sequence

The application looks for the API key in several places, in this order:

1. Firebase Functions config (for deployed functions)
2. Environment variables (`OPENROUTER_API_KEY`)
3. Key file (`keys/openrouter.key`) 
4. Config files (`ai.config.json`)

This allows flexibility while maintaining security.

### Configuration Templates

The repository contains template files that show the structure but don't contain actual API keys:

- `functions/ai.config.template.json` - Template for functions config
- `src/assets/ai.config.template.json` - Template for frontend config
- `functions/.runtimeconfig.template.json` - Template for Firebase Functions emulator

### Development Workflow

1. Clone the repository
2. Run `./start-emulator.sh`
3. When prompted, enter your OpenRouter API key
4. The script will create all necessary config files with your key inserted

### Deployment

For production deployment, set the API key in Firebase Functions config:

```bash
firebase functions:config:set openrouter.api_key="YOUR_API_KEY" openrouter.model="meta-llama/llama-4-maverick"
```

Then deploy:
```bash
firebase deploy --only functions
```

### Security Notes

- Never commit API keys to the repository
- Use `.gitignore` to prevent accidental commits
- Use the Firebase Functions config for production deployment
- Consider rotating API keys periodically for enhanced security