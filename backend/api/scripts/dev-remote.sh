#!/usr/bin/env bash
set -euo pipefail

# Compatibility entrypoint. The Python launcher owns preparation, readiness,
# signals, and cleanup; rust_api is the sole supervisor for backend children.
REPOSITORY_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
exec "${PYTHON:-python3}" "$REPOSITORY_ROOT/ops/development/dev_stack.py" "$@"
