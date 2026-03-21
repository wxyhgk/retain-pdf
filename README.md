# Workspace Layout

This repo/workspace is organized around a small number of top-level folders:

- `scripts/`
  Main source code for OCR extraction, translation, rendering, and CLI entrypoints.
- `Data/`
  Test/sample datasets. Each case folder usually contains one `.json` OCR file and one `.pdf` source file.
- `output/`
  All generated outputs:
  - final PDFs
  - translation JSON folders under `output/translations/`
  - Typst runtime/cache folders such as `output/typst_overlay/` and `output/formula_cache/`
  - archived old outputs under `output/old/`
- `problem/`
  Notes and expert feedback collected during debugging, such as font and PDF-size investigations.
- `en2zh/`
  Legacy original manual/test data kept for reference.
- `tmp/`
  Temporary scratch files not part of the main pipeline contract.

## Recommended CLI Contract

For automation or API wrapping, prefer explicit paths instead of relying on folder auto-discovery:

```bash
python scripts/run_case.py \
  --source-json Data/test9/test9.json \
  --source-pdf Data/test9/test9.pdf \
  --mode sci \
  --model deepseek-chat \
  --base-url https://api.deepseek.com/v1 \
  --api-key "$DEEPSEEK_API_KEY" \
  --workers 50 \
  --output-dir translations/test9-run \
  --output test9-run.pdf
```

Outputs from that command will land in:

- `output/translations/test9-run/`
- `output/test9-run.pdf`

## Current Conventions

- Keep all generated files under `output/`
- Keep runnable code and prompts under `scripts/`
- Keep sample inputs under `Data/`
- Treat `problem/` and `tmp/` as auxiliary workspace folders, not production pipeline inputs
