#!/bin/bash

# Configuration
KEYS_DIR="./keys"
OPENROUTER_KEY_FILE="${KEYS_DIR}/openrouter.key"
CONFIG_TEMPLATE="./functions/.runtimeconfig.template.json"
CONFIG_OUTPUT="./functions/.runtimeconfig.json"

# Create keys directory if it doesn't exist
mkdir -p "${KEYS_DIR}"

# Check if the OpenRouter key file exists
if [ ! -f "${OPENROUTER_KEY_FILE}" ]; then
  echo "⚠️  OpenRouter API key file not found at ${OPENROUTER_KEY_FILE}"
  
  # Prompt for API key if it doesn't exist
  echo "Please enter your OpenRouter API key (starts with sk-or-v1-...):"
  read -r API_KEY
  
  # Save the key to file
  echo "${API_KEY}" > "${OPENROUTER_KEY_FILE}"
  echo "✅ API key saved to ${OPENROUTER_KEY_FILE}"
else
  # Read the API key from file
  API_KEY=$(cat "${OPENROUTER_KEY_FILE}")
  echo "✅ Found OpenRouter API key at ${OPENROUTER_KEY_FILE}"
fi

# Check if API key is valid
if [[ ! "${API_KEY}" =~ ^sk-or-v1- ]]; then
  echo "⚠️  Warning: API key doesn't match expected format (should start with sk-or-v1-)"
  echo "    Current key: ${API_KEY:0:10}..."
  echo "    You may want to check ${OPENROUTER_KEY_FILE} and update it with a valid key"
fi

# Copy the template file to actual config
if [ -f "${CONFIG_TEMPLATE}" ]; then
  cp "${CONFIG_TEMPLATE}" "${CONFIG_OUTPUT}"
  
  # Replace the placeholder with actual API key in the config file
  sed -i '' "s|YOUR_OPENROUTER_API_KEY_HERE|${API_KEY}|g" "${CONFIG_OUTPUT}"
  echo "✅ Created runtime config with API key at ${CONFIG_OUTPUT}"
else
  echo "⚠️  Config template not found at ${CONFIG_TEMPLATE}"
  
  # Create the config file directly
  cat > "${CONFIG_OUTPUT}" << EOF
{
  "openrouter": {
    "api_key": "${API_KEY}",
    "model": "meta-llama/llama-4-maverick"
  }
}
EOF
  echo "✅ Created default runtime config at ${CONFIG_OUTPUT}"
fi

# Copy the API key to ai.config.json files
for CONFIG_FILE in "./functions/ai.config.json" "./src/assets/ai.config.json"; do
  if [ -f "${CONFIG_FILE}.template" ]; then
    cp "${CONFIG_FILE}.template" "${CONFIG_FILE}"
    sed -i '' "s|YOUR_OPENROUTER_API_KEY_HERE|${API_KEY}|g" "${CONFIG_FILE}"
    echo "✅ Updated ${CONFIG_FILE} with API key"
  else
    # Create from scratch
    cat > "${CONFIG_FILE}" << EOF
{
  "// API settings for text generation via OpenRouter": "",
  "openRouter": {
    "key": "${API_KEY}",
    "baseUrl": "https://openrouter.ai/api/v1",
    "model": "meta-llama/llama-4-maverick:free"
  }
}
EOF
    echo "✅ Created ${CONFIG_FILE} with API key"
  fi
done

echo "🚀 Starting Firebase emulators..."
# Start Firebase emulators with all services
firebase emulators:start --import=./emulator_data --export-on-exit=./emulator_data

