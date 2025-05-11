#!/bin/bash

# Configuration
KEYS_DIR="./keys"
OPENROUTER_KEY_FILE="${KEYS_DIR}/openrouter.key"
FIREBASE_KEY_FILE="${KEYS_DIR}/firebase.keys"
CONFIG_TEMPLATE="./functions/.runtimeconfig.template.json"
CONFIG_OUTPUT="./functions/.runtimeconfig.json"

# Add timestamp to environment files to prevent browser caching
add_cache_busting() {
  local file=$1
  if [ -f "$file" ]; then
    # Add or update cache busting comment with current timestamp
    local timestamp=$(date +"%Y-%m-%d %H:%M:%S")

    if grep -q "// Last updated:" "$file"; then
      # Update existing timestamp
      sed -i '' "s|// Last updated:.*|// Last updated: $timestamp|" "$file"
    else
      # Add timestamp as first line
      sed -i '' "1i\\
// Last updated: $timestamp\\
" "$file"
    fi
    echo "✅ Added cache busting timestamp to $file"
  fi
}

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

# Check if the Firebase key file exists
if [ ! -f "${FIREBASE_KEY_FILE}" ]; then
  echo "⚠️  Firebase API key file not found at ${FIREBASE_KEY_FILE}"
  echo "Please create this file with your Firebase configuration"
else
  # Extract all Firebase configuration fields
  FIREBASE_API_KEY=$(grep "apiKey:" "${FIREBASE_KEY_FILE}" | cut -d '"' -f 2)
  FIREBASE_AUTH_DOMAIN=$(grep "authDomain:" "${FIREBASE_KEY_FILE}" | cut -d '"' -f 2)
  FIREBASE_PROJECT_ID=$(grep "projectId:" "${FIREBASE_KEY_FILE}" | cut -d '"' -f 2)
  FIREBASE_STORAGE_BUCKET=$(grep "storageBucket:" "${FIREBASE_KEY_FILE}" | cut -d '"' -f 2)
  FIREBASE_MESSAGING_SENDER_ID=$(grep "messagingSenderId:" "${FIREBASE_KEY_FILE}" | cut -d '"' -f 2)
  FIREBASE_APP_ID=$(grep "appId:" "${FIREBASE_KEY_FILE}" | cut -d '"' -f 2)

  if [[ -n "${FIREBASE_API_KEY}" ]]; then
    echo "✅ Found Firebase configuration at ${FIREBASE_KEY_FILE}"
  else
    echo "⚠️  Could not extract Firebase configuration from ${FIREBASE_KEY_FILE}"
    echo "Please make sure the file contains a valid Firebase configuration"
  fi
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

# Update environment files with complete Firebase configuration
if [[ -n "${FIREBASE_API_KEY}" ]]; then
  # Update development environment file
  if [ -f "./src/environments/environment.template.ts" ]; then
    cp "./src/environments/environment.template.ts" "./src/environments/environment.ts"
    sed -i '' "s|AIzaSyDummyApiKeyForDevelopment|${FIREBASE_API_KEY}|g" "./src/environments/environment.ts"
    sed -i '' "s|something.web.app|${FIREBASE_AUTH_DOMAIN}|g" "./src/environments/environment.ts"
    sed -i '' "s|something|${FIREBASE_PROJECT_ID}|g" "./src/environments/environment.ts"
    sed -i '' "s|something.appspot.com|${FIREBASE_STORAGE_BUCKET}|g" "./src/environments/environment.ts"
    sed -i '' "s|000000000000|${FIREBASE_MESSAGING_SENDER_ID}|g" "./src/environments/environment.ts"
    sed -i '' "s|1:000000000000:web:0000000000000000000000|${FIREBASE_APP_ID}|g" "./src/environments/environment.ts"
    echo "✅ Updated environment.ts with complete Firebase configuration"
    # Add cache busting timestamp
    add_cache_busting "./src/environments/environment.ts"
  fi

  # Update production environment file
  if [ -f "./src/environments/environment.prod.template.ts" ]; then
    cp "./src/environments/environment.prod.template.ts" "./src/environments/environment.prod.ts"
    sed -i '' "s|demo-api-key|${FIREBASE_API_KEY}|g" "./src/environments/environment.prod.ts"
    sed -i '' "s|something.firebaseapp.com|${FIREBASE_AUTH_DOMAIN}|g" "./src/environments/environment.prod.ts"
    sed -i '' "s|something|${FIREBASE_PROJECT_ID}|g" "./src/environments/environment.prod.ts"
    sed -i '' "s|something.firebasestorage.app|${FIREBASE_STORAGE_BUCKET}|g" "./src/environments/environment.prod.ts"
    sed -i '' "s|234234234|${FIREBASE_MESSAGING_SENDER_ID}|g" "./src/environments/environment.prod.ts"
    sed -i '' "s|23423234234|${FIREBASE_APP_ID}|g" "./src/environments/environment.prod.ts"
    echo "✅ Updated environment.prod.ts with complete Firebase configuration"
    # Add cache busting timestamp
    add_cache_busting "./src/environments/environment.prod.ts"
  fi
fi

# Clear Angular cache to ensure new environment settings are picked up
echo "🧹 Clearing Angular cache..."
rm -rf .angular/cache 2>/dev/null || true
rm -rf node_modules/.cache 2>/dev/null || true

echo "🚀 Starting Firebase emulators..."
# Start Firebase emulators with all services
firebase emulators:start --import=./emulator_data --export-on-exit=./emulator_data

