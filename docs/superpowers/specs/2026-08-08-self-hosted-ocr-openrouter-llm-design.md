# Self-hosted OCR (PaddleX/PP-StructureV3) + OpenRouter DeepSeek LLM

Date: 2026-08-08
Status: Approved (design)

## Context

`retain-pdf-vi` is a fork of `wxyhgk/retain-pdf` (which does English → Chinese)
retargeted for English → Vietnamese paper translation. On job submission the
pipeline needs two external services:

1. An **OCR provider** to turn the source PDF into structured text/layout.
2. An **LLM** to translate the normalized document.

By default the repo ships two OCR paths — `paddle` (Baidu AI Studio's hosted,
job-queue OCR API at `https://paddleocr.aistudio-app.com`) and `mineru`
(another hosted API) — both of which are cloud services requiring a token,
not self-hosted OCR. The LLM path defaults to DeepSeek's own API
(`https://api.deepseek.com/v1`).

Goals for this change:

- Run OCR **locally** against a self-hosted PaddleX server instead of the
  cloud `paddle` provider.
- Route LLM calls for DeepSeek **through OpenRouter** instead of DeepSeek's
  own API.

Neither goal requires touching the translation, rendering, or Rust job-runner
main flow.

## Key findings from the existing codebase

- The `paddle` OCR provider (`backend/scripts/services/ocr_provider/paddle_api.py`)
  is a thin client for Baidu AI Studio's async job API
  (`POST /api/v2/ocr/jobs`, poll, download JSONL). It is **not** the same
  thing as running PaddleOCR/PaddleX locally.
- The repo has a first-class extension point for real self-hosting: the
  `local_command` OCR provider kind
  (`backend/scripts/services/ocr_provider/local_command_driver.py`,
  documented in `doc/api/03-OCR/04-local-command插件.md`). It runs any shell
  command per job, passing input/output paths via env vars
  (`RETAIN_OCR_SOURCE_PDF`, `RETAIN_OCR_RAW_PAYLOAD_JSON`, etc.). The command
  just has to exit 0 and leave a raw payload or `document.v1.json` in place.
  It's already registered in `backend/config/ocr_providers.json` under the
  `local` key, with `RETAIN_LOCAL_OCR_COMMAND` / `RETAIN_OCR_RAW_PROVIDER` as
  its knobs.
- `RETAIN_OCR_RAW_PROVIDER` is passed straight through as the adapter key
  (`local_command_driver.py` → `adapt_path_to_document_v1_with_report(...,
  provider=raw_provider, allow_provider_mismatch=True)`). It is **not**
  auto-detected from payload shape, so a wrapper can explicitly request the
  `paddle` adapter (`backend/scripts/services/document_schema/provider_adapters/paddle/adapter.py`)
  for any payload that looks like `{"layoutParsingResults": [...], "dataInfo": {...}}`.
- PaddleX's own local **serving** mode (`paddlex --serve --pipeline
  PP-StructureV3`, documented in the PaddleOCR repo at
  `docs/version3.x/inference_deployment/serving/serving.md` and
  `docs/version3.x/pipeline_usage/PP-StructureV3.md`) exposes `POST
  /layout-parsing` and returns exactly
  `{"logId", "errorCode", "errorMsg", "result": {"layoutParsingResults": [...],
  "dataInfo": {...}}}` — the **same shape** the `paddle` adapter already
  parses, because Baidu AI Studio's cloud API is itself a hosted wrapper
  around PaddleX pipeline serving. Request parameters
  (`useDocOrientationClassify`, `useTableRecognition`, `layoutThreshold`,
  etc.) are the same camelCase names already built by
  `paddle_api.build_optional_payload()`.
- Consequence: a wrapper for `local_command` can reuse the **existing**
  `paddle` adapter unmodified — no new adapter code — by setting
  `RETAIN_OCR_RAW_PROVIDER=paddle` and writing `response.json()["result"]`
  as the raw payload.
- PaddleX's default PP-StructureV3 pipeline config only processes the first
  10 pages of a PDF unless the pipeline config file is edited to remove that
  cap — relevant since academic papers routinely exceed 10 pages.
- The LLM transport
  (`backend/scripts/services/translation/llm/providers/deepseek/transport.py`,
  `client.py`) is a generic OpenAI-style `chat/completions` client with a
  configurable base URL and bearer token, and already falls back from
  `response_format: json_schema` to `json_object` on a 400 — i.e. it's
  written to tolerate providers that aren't DeepSeek's own endpoint.
  OpenRouter is OpenAI-compatible, so this is a config-only change.
- `FRONT_BASE_URL` / `FRONT_MODEL` / `FRONT_MODEL_API_KEY` /
  `FRONT_OCR_PROVIDER` (from `docker/web.env`) are **browser-runtime
  defaults only** — `docker/entrypoint-web.sh` stamps them into
  `window.__FRONT_RUNTIME_CONFIG__` at container start. They are not read by
  the backend. Changing them changes what the web UI prefills / uses by
  default; nothing server-side needs to change for the LLM switch.
- OCR provider options shown in the UI are **not hardcoded** — the Rust API
  exposes `GET /api/v1/providers/ocr` (`backend/rust_api/src/routes/providers.rs`),
  which serves `ocr_provider_definitions()` straight from
  `backend/config/ocr_providers.json`. Since `local` is already defined
  there, it becomes selectable in the UI with no frontend code changes once
  the backend config/env are set.

## Approaches considered

**A. Reuse the existing `paddle` raw-payload adapter (chosen).** Wrapper
calls local PaddleX serving, forwards `result` as-is, tags it
`RETAIN_OCR_RAW_PROVIDER=paddle`. Zero new adapter code; preserves table /
formula / heading structure, which matters for paper translation quality.

**B. Convert to `generic_flat_ocr`.** Wrapper flattens PaddleX output into
the minimal page→block→bbox/text schema. More engine-agnostic (easy to swap
OCR engines later) but loses structural fidelity (tables, formulas, heading
levels) and requires writing/maintaining conversion + sub_type-inference
logic. Rejected: paper translation benefits directly from keeping structure,
and approach A gets that for free.

**Pipeline choice within approach A:** PaddleOCR-VL (repo's own cloud
default, VLM-based, best quality, needs more VRAM) vs. PP-StructureV3
(traditional pipeline, lighter, still has table/formula/layout support).
**Chosen: PP-StructureV3**, per explicit user preference, despite having
≥12GB VRAM available.

## Design

### Architecture

```
Browser -> retain-pdf-vi web/app (unchanged)
        -> local_command driver (unchanged)
        -> NEW wrapper script -> PaddleX serving (PP-StructureV3, GPU, local)
        -> existing `paddle` adapter -> document.v1.json (unchanged)
        -> translation stage -> OpenRouter chat/completions (unchanged code, new env)
        -> render (unchanged)
```

Only two new things: the PaddleX serving process, and one wrapper script.
Everything else is existing code exercised through existing extension
points, or plain env var changes.

### Components

**a) PaddleX serving process** (new, independent lifecycle, own GPU host or
same host as the backend):

```bash
pip install "paddlex[serving]"
paddlex --get_pipeline_config PP-StructureV3 --save_path ./pp_structurev3.yaml
# edit ./pp_structurev3.yaml to remove the default 10-page cap
paddlex --serve --pipeline ./pp_structurev3.yaml --device gpu:0 --port 8080
```

**b) Wrapper script** — new file
`backend/scripts/services/ocr_provider/local_paddlex_wrapper.py`:

- Reads `RETAIN_OCR_SOURCE_PDF` and `RETAIN_OCR_RAW_PAYLOAD_JSON` from the
  env vars the `local_command` driver injects.
- Base64-encodes the PDF; builds the request body as
  `{"file": <b64>, "fileType": 0, **build_optional_payload("PP-StructureV3")}`,
  importing `build_optional_payload` directly from
  `services.ocr_provider.paddle_api` for parity with the cloud path.
- `POST {RETAIN_LOCAL_PADDLEX_URL:-http://localhost:8080}/layout-parsing`.
- On any HTTP/JSON/timeout error: print the cause to stderr, `sys.exit(1)`.
- On success: write `response.json()["result"]` to
  `RETAIN_OCR_RAW_PAYLOAD_JSON`, exit 0.
- Respects `RETAIN_LOCAL_OCR_COMMAND_TIMEOUT_SECONDS` (already supported by
  the driver) — needs a generous default since PP-StructureV3 on a full
  paper can take a while even on GPU.

**c) Backend/env config** — no new provider entry required
(`backend/config/ocr_providers.json` already defines `local`). Set:

```
# docker/app.env (or wherever the backend process reads env from)
RETAIN_LOCAL_OCR_COMMAND=python /app/backend/scripts/services/ocr_provider/local_paddlex_wrapper.py
RETAIN_OCR_RAW_PROVIDER=paddle
RETAIN_LOCAL_PADDLEX_URL=http://<paddlex-host>:8080

# docker/web.env
FRONT_OCR_PROVIDER=local
```

**d) OpenRouter for the LLM** — `docker/web.env` only:

```
FRONT_BASE_URL=https://openrouter.ai/api/v1
FRONT_MODEL=deepseek/deepseek-chat   # confirm current slug on openrouter.ai/models
FRONT_MODEL_API_KEY=<OpenRouter API key>
```

### Error handling

- Wrapper failures (PaddleX unreachable, bad response, timeout) exit
  non-zero; the existing `local_command_driver.py` already surfaces
  stdout/stderr into job logs and fails the job — no new error-handling
  layer needed.
- The PaddleX page-limit default is a silent-truncation trap if the config
  override is skipped; verification must include a >10-page PDF.
- OpenRouter's DeepSeek route should be verified live once, since subtle
  differences (context window, throttling) from DeepSeek's own API could
  surface even though the client already tolerates `response_format`
  differences via its existing fallback.

### Testing / verification plan

1. Start PaddleX serving with the page-limit override applied.
2. Set the env vars above.
3. Submit a short (<10 page) paper through the existing pipeline entrypoint;
   confirm `document.v1.json` validates and keeps headings/tables/formulas.
4. Submit a paper >10 pages; confirm every page is present in the output.
5. Confirm the translation stage completes successfully via OpenRouter and
   the rendered PDF looks correct.

## Out of scope

- Changing the `mineru` provider or any other existing OCR path.
- Any frontend code changes (the `local` provider and OpenRouter values
  surface automatically via existing dynamic config).
- High-availability / Triton-based PaddleX serving (basic serving is
  sufficient for a single-user self-hosted setup).
