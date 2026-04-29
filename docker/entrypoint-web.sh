#!/usr/bin/env sh
set -eu

: "${FRONT_API_BASE:=}"
: "${FRONT_X_API_KEY:=}"
: "${FRONT_OCR_PROVIDER:=paddle}"
: "${FRONT_PADDLE_TOKEN:=}"
: "${FRONT_MINERU_TOKEN:=}"
: "${FRONT_MODEL_API_KEY:=}"
: "${FRONT_MODEL:=deepseek-v4-flash}"
: "${FRONT_BASE_URL:=https://api.deepseek.com/v1}"

# The frontend always loads runtime-config.local.js first.
# If the file is missing, nginx falls back to index.html and the browser
# tries to execute HTML as JavaScript, which whitescreens the page.
: > /usr/share/nginx/html/runtime-config.local.js

if [ -n "$FRONT_API_BASE" ]; then
  API_BASE_VALUE="\"$FRONT_API_BASE\""
else
  API_BASE_VALUE="window.location.origin"
fi

cat > /usr/share/nginx/html/runtime-config.js <<EOF
window.__FRONT_RUNTIME_CONFIG__ = {
  apiBase: ${API_BASE_VALUE},
  xApiKey: "${FRONT_X_API_KEY}",
  ocrProvider: "${FRONT_OCR_PROVIDER}",
  paddleToken: "${FRONT_PADDLE_TOKEN}",
  mineruToken: "${FRONT_MINERU_TOKEN}",
  modelApiKey: "${FRONT_MODEL_API_KEY}",
  model: "${FRONT_MODEL}",
  baseUrl: "${FRONT_BASE_URL}",
};
EOF
