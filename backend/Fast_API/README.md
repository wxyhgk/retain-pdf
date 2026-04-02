# Fast API Wrapper

This directory contains a thin FastAPI wrapper around the stable CLI entry points in `scripts/`:

- `scripts/run_case.py`
- `scripts/run_mineru_case.py`

The API is job-based. `POST` returns immediately with a `job_id`, and the client polls job status with `GET /v1/jobs/{job_id}`.

## Install

```bash
cd /home/wxyhgk/tmp/Code
pip install -r Fast_API/requirements.txt
```

## Start

```bash
cd /home/wxyhgk/tmp/Code
uvicorn Fast_API.main:app --host 0.0.0.0 --port 40000
```

## Endpoints

- `GET /health`
- `POST /v1/run-case`
- `POST /v1/run-mineru-case`
- `POST /v1/run-mineru-case-upload`
- `POST /v1/upload-mineru-case`
- `GET /v1/jobs/{job_id}`
- `GET /v1/jobs/{job_id}/download`
- `GET /v1/jobs?limit=20`

## Workflow

1. Submit a job with `POST`.
2. Receive `job_id` immediately.
3. Poll `GET /v1/jobs/{job_id}` until status becomes `succeeded` or `failed`.
4. Read output paths from the returned `artifacts`.

## Output Layout

Both API routes now write into a structured job directory:

```text
output/
  202603220035-rtpvxh/
    source/
    ocr/
    translated/
    typst/
```

Typical meaning:

- `source/`: original input PDF copies
- `ocr/`: OCR JSON inputs or MinerU unpacked outputs like `layout.json`
- `translated/`: final translated PDF, translation intermediates, and pipeline summary
- `typst/`: retained Typst intermediate `.typ/.pdf` artifacts for debugging and backtracking

Legacy note:

- old jobs under `originPDF/jsonPDF/transPDF` are still readable by the API and download route

## `POST /v1/run-case`

Wraps `scripts/run_case.py`.

This route accepts either:

- `input_dir`
- or both `source_json` and `source_pdf`

It now creates a structured job folder by default. You can also pass:

- `job_id`
- `output_root`
- `output_dir`
- `output`

Example:

```bash
curl -X POST http://127.0.0.1:40000/v1/run-case \
  -H 'Content-Type: application/json' \
  -d '{
    "source_json": "/home/wxyhgk/tmp/Code/Data/test9/test9.json",
    "source_pdf": "/home/wxyhgk/tmp/Code/Data/test9/test9.pdf",
    "mode": "sci",
    "model": "deepseek-chat",
    "base_url": "https://api.deepseek.com/v1",
    "api_key": "YOUR_KEY",
    "batch_size": 6,
    "workers": 4,
    "render_mode": "typst",
    "compile_workers": 0
  }'
```

Example response:

```json
{
  "job_id": "8a2f5b5c1d9e",
  "status": "queued",
  "created_at": "2026-03-22T08:00:00Z",
  "updated_at": "2026-03-22T08:00:00Z"
}
```

## `POST /v1/run-mineru-case`

Wraps `scripts/run_mineru_case.py`.

This route runs the full chain:

1. MinerU parse
2. download/unpack result bundle
3. translate from `layout.json`
4. render translated PDF into `translated/`

Example:

```bash
curl -X POST http://127.0.0.1:40000/v1/run-mineru-case \
  -H 'Content-Type: application/json' \
  -d '{
    "file_path": "/home/wxyhgk/tmp/Code/Data/test9/test9.pdf",
    "mineru_token": "YOUR_MINERU_TOKEN",
    "model_version": "vlm",
    "language": "en",
    "page_ranges": "1-3",
    "mode": "sci",
    "model": "deepseek-chat",
    "base_url": "https://api.deepseek.com/v1",
    "api_key": "YOUR_KEY",
    "workers": 4,
    "batch_size": 6
  }'
```

## `POST /v1/run-mineru-case-upload`

Wraps the same MinerU pipeline, but accepts a local PDF upload directly as `multipart/form-data`.

This route is intended for frontend or browser upload flows:

1. upload a PDF file
2. save it under `Fast_API/uploads/<job_id>/`
3. submit the background MinerU job immediately
4. poll the same `GET /v1/jobs/{job_id}` endpoint

Recommended route:

- `POST /v1/run-mineru-case-upload`

Compatibility alias:

- `POST /v1/upload-mineru-case`

Example:

```bash
curl -X POST http://127.0.0.1:40000/v1/run-mineru-case-upload \
  -F "file=@/home/wxyhgk/tmp/Code/Data/test1/test1.pdf" \
  -F "mineru_token=YOUR_MINERU_TOKEN" \
  -F "model_version=vlm" \
  -F "language=en" \
  -F "page_ranges=1-3" \
  -F "mode=sci" \
  -F "model=Q3.5-turbo" \
  -F "base_url=http://1.94.67.196:10001/v1" \
  -F "api_key=" \
  -F "workers=4" \
  -F "batch_size=6" \
  -F "render_mode=typst"
```

Common form fields:

- `file`
- `mode`
- `skip_title_translation`
- `start_page`
- `end_page`
- `classify_batch_size`
- `model`
- `base_url`
- `api_key`
- `workers`
- `batch_size`
- `render_mode`
- `compile_workers`
- `typst_font_family`
- `mineru_token`
- `model_version`
- `is_ocr`
- `disable_formula`
- `disable_table`
- `language`
- `page_ranges`
- `data_id`
- `no_cache`
- `cache_tolerance`
- `extra_formats`
- `poll_interval`
- `poll_timeout`
- `translated_pdf_name`
- body layout tuning fields such as `body_font_size_factor`

## Poll Job Status

```bash
curl http://127.0.0.1:40000/v1/jobs/8a2f5b5c1d9e
```

## Download Job Bundle

```bash
curl -L http://127.0.0.1:40000/v1/jobs/8a2f5b5c1d9e/download -o 8a2f5b5c1d9e.zip
```

Returned zip includes:

- final translated PDF from `translated/`
- all files under `ocr/unpacked/`
- `pipeline_summary.json` when present

Returned job payload includes:

- `job_id`
- `job_type`
- `status`
- `created_at`
- `updated_at`
- `started_at`
- `finished_at`
- `command`
- `error`
- `result`
- `artifacts`

When the job finishes, `artifacts` contains the extracted output paths and timing fields parsed from the CLI logs.

For `run-case`, artifacts typically include:

- `job_root`
- `origin_pdf_dir`
- `json_pdf_dir`
- `trans_pdf_dir`
- `translation_dir`
- `output_pdf`

For `run-mineru-case`, artifacts typically include:

- `job_root`
- `source_pdf`
- `layout_json`
- `translations_dir`
- `output_pdf`
- `summary`

Upload-based MinerU jobs reuse the same artifact parsing. Their stored request payload additionally includes:

- `uploaded_file`
- `uploaded_filename`

## Notes

- The wrapper stays thin and continues to call the existing CLIs.
- Job metadata is persisted under `Fast_API/jobs/`.
- Long-running tasks no longer block the HTTP request.
- Passing `output/...` as API output paths is unnecessary. The server already writes inside a structured job folder under `output/`.
- Uploaded files are stored under `Fast_API/uploads/<job_id>/`.
- The upload route passes the generated `job_id` through to `scripts/run_mineru_case.py`, so final outputs land under `output/<job_id>/source|ocr|translated|typst`.
- Legacy jobs using `originPDF|jsonPDF|transPDF` remain downloadable.
- Download bundles are cached under `Fast_API/downloads/<job_id>.zip`.
