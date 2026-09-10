#!/usr/bin/env sh
set -eu

PROJECT_ROOT="${PROJECT_ROOT:-/app}"
RUST_API_ROOT="${RUST_API_ROOT:-/app/services/api}"
RUST_API_DATA_ROOT="${RUST_API_DATA_ROOT:-${RUST_API_DATA_DIR:-/data}}"
OUTPUT_ROOT="${OUTPUT_ROOT:-${RUST_API_OUTPUT_ROOT:-$RUST_API_DATA_ROOT/jobs}}"
TYPST_PACKAGE_CACHE_PATH="${TYPST_PACKAGE_CACHE_PATH:-$RUST_API_DATA_ROOT/typst-package-cache}"
RETAIN_AI_FX_STATE_ROOT="${RETAIN_AI_FX_STATE_ROOT:-$RUST_API_DATA_ROOT/agent-runtime/fx}"
HOME="${HOME:-$RUST_API_DATA_ROOT/runtime-home}"
TMPDIR="${TMPDIR:-/tmp/retainpdf}"
XDG_CACHE_HOME="${XDG_CACHE_HOME:-$HOME/.cache}"
XDG_CONFIG_HOME="${XDG_CONFIG_HOME:-$HOME/.config}"
CMARKER_VERSION="${CMARKER_VERSION:-0.1.8}"
MITEX_VERSION="${MITEX_VERSION:-0.2.6}"

ensure_writable_directory() {
  directory="$1"
  if ! mkdir -p "$directory" 2>/dev/null; then
    echo "ERROR: runtime user $(id -u):$(id -g) cannot create $directory." >&2
    echo "The mounted data volume must be writable by the retainpdf container user." >&2
    exit 1
  fi
  if [ ! -d "$directory" ] || [ ! -w "$directory" ]; then
    echo "ERROR: runtime directory is not writable by $(id -u):$(id -g): $directory" >&2
    echo "Fix the mounted volume ownership before restarting the container." >&2
    exit 1
  fi
}

export RUST_API_PROJECT_ROOT="${RUST_API_PROJECT_ROOT:-$PROJECT_ROOT}"
export RUST_API_ROOT
export RUST_API_SCRIPTS_DIR="${RUST_API_SCRIPTS_DIR:-$PROJECT_ROOT/services/pipeline}"
export RUST_API_PIPELINE_COMMAND="${RUST_API_PIPELINE_COMMAND:-retainpdf-pipeline}"
export RUST_API_PYTHON_ENTRYPOINT_MODE="${RUST_API_PYTHON_ENTRYPOINT_MODE:-console}"
export RUST_API_DATA_ROOT
export OUTPUT_ROOT
export RUST_API_OUTPUT_ROOT="$OUTPUT_ROOT"
export TYPST_PACKAGE_CACHE_PATH
export RETAIN_AI_FX_STATE_ROOT
export HOME
export TMPDIR
export XDG_CACHE_HOME
export XDG_CONFIG_HOME
if [ -d "${TYPST_PACKAGE_PATH:-}" ]; then
  export TYPST_PACKAGE_PATH
fi

for directory in \
  "$RUST_API_DATA_ROOT" \
  "$RUST_API_DATA_ROOT/uploads" \
  "$RUST_API_DATA_ROOT/downloads" \
  "$RUST_API_DATA_ROOT/db" \
  "$RUST_API_OUTPUT_ROOT" \
  "$TYPST_PACKAGE_CACHE_PATH" \
  "$RETAIN_AI_FX_STATE_ROOT" \
  "$HOME" \
  "$XDG_CACHE_HOME" \
  "$XDG_CONFIG_HOME" \
  "$TMPDIR"
do
  ensure_writable_directory "$directory"
done

for pkg in "cmarker/$CMARKER_VERSION" "mitex/$MITEX_VERSION"; do
  target="$TYPST_PACKAGE_CACHE_PATH/preview/$pkg"
  source="${TYPST_PACKAGE_PATH:-}/preview/$pkg"
  if [ ! -d "$target" ] && [ -d "$source" ]; then
    mkdir -p "$(dirname "$target")"
    cp -R "$source" "$target"
  fi
  if [ ! -d "$target" ]; then
    echo "ERROR: Typst package cache is missing preview/$pkg at $target." >&2
    echo "Set TYPST_PACKAGE_CACHE_PATH to a persistent cache containing preview/$pkg, or rebuild the image with bundled Typst packages." >&2
    exit 1
  fi
done

if [ "${RETAIN_AI_RUNTIME:-python}" = "fx" ]; then
  fx_command="${RETAIN_AI_FX_COMMAND:-fx}"
  expected_fx_version="${RETAIN_AI_FX_EXPECTED_VERSION:-0.0.5}"
  if ! actual_fx_version="$("$fx_command" --version 2>/dev/null)"; then
    echo "ERROR: FX runtime was selected but $fx_command is not executable." >&2
    exit 1
  fi
  if [ "$actual_fx_version" != "$expected_fx_version" ]; then
    echo "ERROR: FX runtime version mismatch: expected $expected_fx_version, got $actual_fx_version." >&2
    exit 1
  fi
fi

exec /usr/local/bin/rust_api
