#!/usr/bin/env sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)

git -C "$REPO_ROOT" config core.hooksPath .githooks
chmod +x "$REPO_ROOT/.githooks/pre-commit"

printf '%s\n' "Installed git hooks at .githooks"

