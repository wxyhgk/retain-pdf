#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FRONTEND_DIR="$ROOT_DIR/frontend"
DEFAULT_FILE="$ROOT_DIR/data/temPDF/test1.pdf"
REPORT_FILE="$ROOT_DIR/doc/ops/reports/frontend-status-smoke-latest.json"

PDF_FILE="${1:-$DEFAULT_FILE}"
if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  cd "$FRONTEND_DIR"
  npm run smoke:status -- --help
  exit 0
fi

if [[ $# -gt 0 ]]; then
  shift
fi

cd "$FRONTEND_DIR"

npm run smoke:status -- \
  --file "$PDF_FILE" \
  --report-file "$REPORT_FILE" \
  "$@"

echo
echo "report_file=$REPORT_FILE"
