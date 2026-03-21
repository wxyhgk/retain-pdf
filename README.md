# Workspace Layout

This repo/workspace is organized around a small number of top-level folders:

- `scripts/`
  Main source code for OCR extraction, translation, rendering, CLI entrypoints, and integrations.
- `Fast_API/`
  Thin FastAPI wrapper around the stable CLI entrypoints in `scripts/`.
- `Data/`
  Test/sample datasets. Each case folder usually contains one `.json` OCR file and one `.pdf` source file.
- `output/`
  All generated outputs. The current pipeline writes each run into a structured job folder named `YYYYMMDDHHMM-random`.
- `problem/`
  Notes and expert feedback collected during debugging, such as font and PDF-size investigations.
- `en2zh/`
  Legacy original manual/test data kept for reference.
- `tmp/`
  Temporary scratch files not part of the main pipeline contract.

## Current Output Contract

Both main pipelines now write into:

```text
output/
  202603220035-rtpvxh/
    originPDF/
    jsonPDF/
    transPDF/
```

Meaning:

- `originPDF/`
  Original input PDF copies used by the run.
- `jsonPDF/`
  OCR JSON inputs or MinerU unpacked outputs such as `layout.json`.
- `transPDF/`
  Final translated PDF, translation intermediates, and pipeline summary.

This structure is shared by:

- `python scripts/run_case.py`
- `python scripts/run_mineru_case.py`
- `POST /v1/run-case`
- `POST /v1/run-mineru-case`
- `POST /v1/upload-mineru-case`

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
  --workers 50
```

By default, this now creates a structured job folder under `output/`, for example:

- `output/202603220034-5rdg57/originPDF/`
- `output/202603220034-5rdg57/jsonPDF/`
- `output/202603220034-5rdg57/transPDF/test1-sci-typst.pdf`

Optional controls:

- `--job-id`
  Force a specific job directory name.
- `--output-root`
  Change the root folder that contains the structured job directories.
- `--output-dir`
  Override the translation intermediate directory inside `transPDF/`.
- `--output`
  Override the final PDF filename inside `transPDF/`.

## MinerU End-to-End Flow

The MinerU path is exposed through:

```bash
python scripts/run_mineru_case.py --file-path Data/test1/test1.pdf ...
```

This flow:

1. uploads or references the PDF in MinerU
2. downloads the result bundle
3. uses `layout.json` as the translation/render input
4. writes the final translated PDF into the same structured job folder

For frontend-style upload flows, the same pipeline is also exposed through FastAPI:

```bash
curl -X POST http://127.0.0.1:40000/v1/upload-mineru-case \
  -F "file=@Data/test1/test1.pdf" \
  -F "mode=sci" \
  -F "model=Q3.5-turbo" \
  -F "base_url=http://1.94.67.196:10001/v1" \
  -F "api_key=x"
```

That route uploads the PDF, runs MinerU, translates, renders, and still writes everything into `output/<job_id>/originPDF|jsonPDF|transPDF`.

## Current Conventions

- Keep all generated files under `output/`
- Keep runnable code and prompts under `scripts/`
- Keep sample inputs under `Data/`
- Treat `problem/` and `tmp/` as auxiliary workspace folders, not production pipeline inputs
