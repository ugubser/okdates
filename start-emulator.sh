#!/bin/bash

# Ensure .runtimeconfig.json exists for Firebase Functions emulator
cat > functions/.runtimeconfig.json << 'EOF'
{
  "openrouter": {
    "api_key": "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",
    "model": "meta-llama/llama-4-maverick"
  }
}
EOF

# Start Firebase emulators with all services
firebase emulators:start