#!/usr/bin/env sh
set -eu

: "${FRONT_API_BASE:=}"
: "${FRONT_X_API_KEY:=}"
: "${FRONT_OCR_PROVIDER:=paddle}"
: "${FRONT_PADDLE_TOKEN:=}"
: "${FRONT_PADDLE_API_URL:=}"
: "${FRONT_MINERU_TOKEN:=}"
: "${FRONT_MODEL_API_KEY:=}"
: "${FRONT_MODEL:=deepseek-v4-flash}"
: "${FRONT_BASE_URL:=https://api.deepseek.com/v1}"
: "${FRONT_RUNTIME_CONFIG_ROOT:=/usr/share/nginx/html}"

# The frontend always loads runtime-config.local.js first.
# If the file is missing, nginx falls back to index.html and the browser
# tries to execute HTML as JavaScript, which whitescreens the page.
: > "$FRONT_RUNTIME_CONFIG_ROOT/runtime-config.local.js"

runtime_config="$(
  jq -n \
    --arg apiBase "$FRONT_API_BASE" \
    --arg xApiKey "$FRONT_X_API_KEY" \
    --arg ocrProvider "$FRONT_OCR_PROVIDER" \
    --arg paddleToken "$FRONT_PADDLE_TOKEN" \
    --arg paddleApiUrl "$FRONT_PADDLE_API_URL" \
    --arg mineruToken "$FRONT_MINERU_TOKEN" \
    --arg modelApiKey "$FRONT_MODEL_API_KEY" \
    --arg model "$FRONT_MODEL" \
    --arg baseUrl "$FRONT_BASE_URL" \
    '{
      apiBase: $apiBase,
      xApiKey: $xApiKey,
      ocrProvider: $ocrProvider,
      paddleToken: $paddleToken,
      paddleApiUrl: $paddleApiUrl,
      mineruToken: $mineruToken,
      modelApiKey: $modelApiKey,
      model: $model,
      baseUrl: $baseUrl
    }'
)"

{
  printf 'window.__FRONT_RUNTIME_CONFIG__ = %s;\n' "$runtime_config"
  if [ -z "$FRONT_API_BASE" ]; then
    printf 'window.__FRONT_RUNTIME_CONFIG__.apiBase = window.location.origin;\n'
  fi
} > "$FRONT_RUNTIME_CONFIG_ROOT/runtime-config.js"
