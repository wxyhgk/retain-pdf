# API Reference

Purpose: Trang nay tong hop HTTP API da dang ky trong Rust router. No danh cho frontend/backend developer can biet endpoint, handler, auth va domain.

## Responsibilities

Rust API exposes full `/api/v1/*` routes on `RUST_API_PORT` and simple bundle route on `RUST_API_SIMPLE_PORT`. `/health` is public. All `/api/v1/*` routes in both routers use API-key middleware from [`auth::require_api_key`](../../../backend/rust_api/src/auth.rs), wired in [`build_app()`](../../../backend/rust_api/src/app/router.rs) and [`build_simple_app()`](../../../backend/rust_api/src/app/router.rs).

## API Conventions

| Convention | Source |
| --- | --- |
| API prefix | Frontend [`API_PREFIX = "/api/v1"`](../../../frontend/src/js/config/api-constants.ts), Rust routes in [`router.rs`](../../../backend/rust_api/src/app/router.rs) |
| Auth | `X-API-Key` checked by [`auth.rs`](../../../backend/rust_api/src/auth.rs); frontend sends it in [`buildApiHeaders()`](../../../frontend/src/js/config/runtime.ts) |
| Job payload | Grouped [`CreateJobInput`](../../../backend/rust_api/src/models/input/request.rs) |
| Frontend job submit validation | [`jobs-submit.ts`](../../../frontend/src/js/api/jobs-submit.ts) |
| Response wrapping | Frontend unwraps envelopes in [`job/core.ts`](../../../frontend/src/js/job/core.ts) |

## Endpoint Table

Auth: all rows below except `/health` require `X-API-Key`.

### Health And Uploads

| Method | Path | Handler | Request | Response | Error conditions | Source |
| --- | --- | --- | --- | --- | --- | --- |
| GET | `/health` | `health::health` | none | service health | service unavailable only at process/proxy layer | [`router.rs`](../../../backend/rust_api/src/app/router.rs) |
| POST | `/api/v1/uploads` | `uploads::upload_pdf` | multipart PDF | upload record | body/file validation, upload limits | [`router.rs`](../../../backend/rust_api/src/app/router.rs) |

### Jobs And OCR Jobs

| Method | Path | Handler | Request | Response | Error conditions | Source |
| --- | --- | --- | --- | --- | --- | --- |
| POST | `/api/v1/jobs` | `jobs::create_job` | grouped `CreateJobInput` | job submission/detail | unknown fields, missing upload/source, provider credentials, render validation | [`router.rs`](../../../backend/rust_api/src/app/router.rs) |
| GET | `/api/v1/jobs` | `jobs::list_jobs` | query `limit/offset/status/workflow/provider/q` | job list | invalid query/auth | [`jobs-query.ts`](../../../frontend/src/js/api/jobs-query.ts) |
| GET | `/api/v1/jobs/:job_id` | `jobs::get_job` | path job id | job detail | 404 missing job | [`router.rs`](../../../backend/rust_api/src/app/router.rs) |
| GET | `/api/v1/jobs/:job_id/events` | `jobs::get_job_events` | pagination query | event list | 404 missing job | [`router.rs`](../../../backend/rust_api/src/app/router.rs) |
| GET | `/api/v1/jobs/:job_id/diagnostics` | `jobs::get_job_diagnostics` | path | diagnostics | missing summary/artifacts | [`router.rs`](../../../backend/rust_api/src/app/router.rs) |
| GET | `/api/v1/jobs/:job_id/resume-plan` | `jobs::get_resume_plan` | path | resume plan | unsupported state/artifacts | [`router.rs`](../../../backend/rust_api/src/app/router.rs) |
| GET | `/api/v1/jobs/:job_id/stage-actions` | `jobs::get_stage_actions` | path | available stage actions | unsupported state | [`router.rs`](../../../backend/rust_api/src/app/router.rs) |
| POST | `/api/v1/jobs/:job_id/resume` | `jobs::resume_job` | resume payload | updated job | invalid artifacts/state | [`router.rs`](../../../backend/rust_api/src/app/router.rs) |
| POST | `/api/v1/jobs/:job_id/retry-stage` | `jobs::retry_stage` | retry payload | updated job | invalid stage/state | [`router.rs`](../../../backend/rust_api/src/app/router.rs) |
| POST | `/api/v1/jobs/:job_id/cancel` | `jobs::cancel_job` | none/body ignored | cancel result | missing job/already terminal | [`router.rs`](../../../backend/rust_api/src/app/router.rs) |
| POST | `/api/v1/jobs/:job_id/rerun` | `jobs::rerun_job` | rerun options | new/updated job | invalid source/artifacts | [`router.rs`](../../../backend/rust_api/src/app/router.rs) |
| POST/GET | `/api/v1/ocr/jobs` | `jobs::create_ocr_job`, `jobs::list_ocr_jobs` | OCR grouped payload/query | OCR job/list | provider/source/auth errors | [`router.rs`](../../../backend/rust_api/src/app/router.rs) |
| GET | `/api/v1/ocr/jobs/:job_id` | `jobs::get_ocr_job` | path | OCR job detail | 404 missing job | [`router.rs`](../../../backend/rust_api/src/app/router.rs) |
| GET | `/api/v1/ocr/jobs/:job_id/events` | `jobs::get_ocr_job_events` | pagination | events | 404 | [`router.rs`](../../../backend/rust_api/src/app/router.rs) |
| POST | `/api/v1/ocr/jobs/:job_id/cancel` | `jobs::cancel_ocr_job` | none/body ignored | cancel result | missing job/state | [`router.rs`](../../../backend/rust_api/src/app/router.rs) |

### Artifacts, Reader And Debug

| Method | Path | Handler | Request | Response | Error conditions | Source |
| --- | --- | --- | --- | --- | --- | --- |
| GET | `/api/v1/jobs/:job_id/artifacts` | `jobs::get_job_artifacts` | path | legacy artifact links | missing job | [`router.rs`](../../../backend/rust_api/src/app/router.rs) |
| GET | `/api/v1/jobs/:job_id/artifacts-manifest` | `jobs::get_job_artifacts_manifest` | path | artifact manifest items | missing job/no artifacts | [`jobs-artifacts.ts`](../../../frontend/src/js/api/jobs-artifacts.ts) |
| GET | `/api/v1/jobs/:job_id/artifacts/:artifact_key` | `jobs::download_artifact_by_key` | key | file/dir download response | unknown key, missing file, unsafe path | [`router.rs`](../../../backend/rust_api/src/app/router.rs) |
| GET | `/api/v1/jobs/:job_id/pdf` | `jobs::download_pdf` | path | translated PDF | output not ready | [`router.rs`](../../../backend/rust_api/src/app/router.rs) |
| GET | `/api/v1/jobs/:job_id/pdf/side-by-side` | `jobs::download_side_by_side_pdf` | path | generated side-by-side PDF | source/output missing | [`side_by_side_pdf.py`](../../../backend/scripts/services/rendering/tools/side_by_side_pdf.py) |
| GET | `/api/v1/jobs/:job_id/cover` | `jobs::download_cover` | path | image | source/output missing | [`router.rs`](../../../backend/rust_api/src/app/router.rs) |
| GET | `/api/v1/jobs/:job_id/thumbnail` | `jobs::download_thumbnail` | path | image | source/output missing | [`router.rs`](../../../backend/rust_api/src/app/router.rs) |
| GET | `/api/v1/jobs/:job_id/preview/pages/:page` | `jobs::download_page_preview` | page/kind/width query | preview image | page/source missing | [`answer-enhance.ts`](../../../frontend/src/js/reader/ai/answer-enhance.ts) |
| GET | `/api/v1/jobs/:job_id/normalized-document` | `jobs::download_normalized_document` | path | `document.v1.json` | artifact missing | [`router.rs`](../../../backend/rust_api/src/app/router.rs) |
| GET | `/api/v1/jobs/:job_id/normalization-report` | `jobs::download_normalization_report` | path | normalization report | artifact missing | [`router.rs`](../../../backend/rust_api/src/app/router.rs) |
| GET | `/api/v1/jobs/:job_id/markdown` | `jobs::download_markdown` | path | markdown payload | markdown missing | [`jobs-artifacts.ts`](../../../frontend/src/js/api/jobs-artifacts.ts) |
| GET | `/api/v1/jobs/:job_id/markdown/document` | `jobs::get_markdown_document` | path | structured markdown with image URLs | markdown missing | [`data-port.ts`](../../../frontend/src/js/reader/data-port.ts) |
| GET | `/api/v1/jobs/:job_id/markdown/images/*path` | `jobs::download_markdown_image` | path | image | unsafe/missing image | [`answer-enhance.ts`](../../../frontend/src/js/reader/ai/answer-enhance.ts) |
| GET | `/api/v1/jobs/:job_id/download` | `jobs::download_bundle` | path | bundle zip | bundle unavailable | [`router.rs`](../../../backend/rust_api/src/app/router.rs) |
| GET | `/api/v1/jobs/:job_id/reader/regions` | `jobs::get_reader_regions` | path | reader region map | manifest/normalized doc missing | [`data-port.ts`](../../../frontend/src/js/reader/data-port.ts) |
| GET | `/api/v1/jobs/:job_id/reader/metadata` | `jobs::get_reader_metadata` | path | reader metadata | missing artifacts -> nullable in frontend | [`data-port.ts`](../../../frontend/src/js/reader/data-port.ts) |
| POST | `/api/v1/jobs/:job_id/reader/ai/chat` | `jobs::reader_ai_chat` | reader chat payload | answer/citations | job not complete, markdown missing, LLM config | [`reader_ai.rs`](../../../backend/rust_api/src/services/jobs/reader_ai.rs) |
| GET/POST | OCR artifact routes under `/api/v1/ocr/jobs/:job_id/...` | OCR route handlers | same shape as jobs artifact routes | OCR artifacts/report | missing OCR artifacts | [`router.rs`](../../../backend/rust_api/src/app/router.rs) |
| GET | `/api/v1/jobs/:job_id/translation/diagnostics` | `jobs::get_translation_diagnostics` | path | diagnostics JSON | diagnostics missing | [`router.rs`](../../../backend/rust_api/src/app/router.rs) |
| GET | `/api/v1/jobs/:job_id/translation/items` | `jobs::list_translation_items` | query | item list | manifest/debug index missing | [`router.rs`](../../../backend/rust_api/src/app/router.rs) |
| GET | `/api/v1/jobs/:job_id/translation/items/:item_id` | `jobs::get_translation_item` | path | item detail | item missing | [`router.rs`](../../../backend/rust_api/src/app/router.rs) |
| POST | `/api/v1/jobs/:job_id/translation/items/:item_id/replay` | `jobs::replay_translation_item_route` | replay payload | replay result | missing item/model key | [`router.rs`](../../../backend/rust_api/src/app/router.rs) |

### Library, Collections, Assets And AI

| Method | Path | Handler | Request | Response | Error conditions | Source |
| --- | --- | --- | --- | --- | --- | --- |
| GET | `/api/v1/documents` | `library_data::list_documents_route` | limit/offset/status/tag/collection/job_id | document list | invalid query | [`documents.ts`](../../../frontend/src/js/api/documents.ts) |
| GET/PATCH/DELETE | `/api/v1/documents/:document_id` | document handlers | patch/delete payload/query | document/detail/delete result | 404, 409 favorite refs, invalid patch | [`router.rs`](../../../backend/rust_api/src/app/router.rs) |
| GET | `/api/v1/documents/:document_id/source.pdf` | `download_document_source_pdf_route` | path | source PDF | missing document/source | [`use-reader-session.ts`](../../../frontend/src/pages/reader/hooks/use-reader-session.ts) |
| GET | `/api/v1/documents/:document_id/cover` | `download_document_cover_route` | path | cover image | source missing | [`router.rs`](../../../backend/rust_api/src/app/router.rs) |
| GET | `/api/v1/documents/:document_id/thumbnail` | `download_document_thumbnail_route` | path | thumbnail | source missing | [`router.rs`](../../../backend/rust_api/src/app/router.rs) |
| POST | `/api/v1/documents/:document_id/translate` | `translate_document_route` | minimal job payload | job submission | missing upload/document | [`documents.ts`](../../../frontend/src/js/api/documents.ts) |
| POST/GET | `/api/v1/favorites` | favorite handlers | favorite payload/query | favorite/list | invalid document/job/block | [`favorites.ts`](../../../frontend/src/js/api/favorites.ts) |
| PATCH/DELETE | `/api/v1/favorites/:favorite_id` | favorite handlers | patch/delete | favorite/delete result | 404 | [`router.rs`](../../../backend/rust_api/src/app/router.rs) |
| GET | `/api/v1/search` | `search_blocks_route` | query/document filters | FTS hits | invalid query | [`search.ts`](../../../frontend/src/js/api/search.ts) |
| POST | `/api/v1/assets` | `upload_asset_route` | asset body | asset record | invalid/missing asset | [`router.rs`](../../../backend/rust_api/src/app/router.rs) |
| GET | `/api/v1/assets/:asset_id` | `download_asset_route` | path | asset bytes | 404 | [`router.rs`](../../../backend/rust_api/src/app/router.rs) |
| POST | `/api/v1/ai/ask` | `ai_proxy::ask_proxy` | AI ask payload/SSE | SSE or JSON answer | retainpdf-ai down/auth/model errors | [`ai_proxy.rs`](../../../backend/rust_api/src/routes/ai_proxy.rs) |
| POST/GET | `/api/v1/ai/conversations` | conversation handlers | create/list | conversation/list | invalid document | [`conversations.ts`](../../../frontend/src/js/api/conversations.ts) |
| GET/PATCH/DELETE | `/api/v1/ai/conversations/:conversation_id` | conversation handlers | path/patch | conversation/delete | 404 | [`router.rs`](../../../backend/rust_api/src/app/router.rs) |
| POST | `/api/v1/ai/conversations/:conversation_id/messages` | `append_message_route` | message payload | message/conversation | invalid parent/conversation | [`router.rs`](../../../backend/rust_api/src/app/router.rs) |
| POST/GET | `/api/v1/collections` | collection handlers | create/list | collection/list | invalid name | [`collections.ts`](../../../frontend/src/js/api/collections.ts) |
| PATCH/DELETE | `/api/v1/collections/:collection_id` | collection handlers | patch/delete | collection/delete | 404 | [`router.rs`](../../../backend/rust_api/src/app/router.rs) |
| POST | `/api/v1/collections/:collection_id/documents` | `add_collection_documents_route` | document ids | membership result | missing collection/document | [`router.rs`](../../../backend/rust_api/src/app/router.rs) |
| DELETE | `/api/v1/collections/:collection_id/documents/:document_id` | `remove_collection_document_route` | path | delete result | missing membership | [`router.rs`](../../../backend/rust_api/src/app/router.rs) |

### Glossaries, Providers, Legacy Library Books, Simple API

| Method | Path | Handler | Request | Response | Error conditions | Source |
| --- | --- | --- | --- | --- | --- | --- |
| POST | `/api/v1/glossaries/parse-csv` | `parse_glossary_csv_route` | CSV body/upload | parsed entries | invalid CSV | [`glossaries.ts`](../../../frontend/src/js/api/glossaries.ts) |
| POST | `/api/v1/glossaries/import` | `import_glossary_route` | import payload | glossary | validation conflicts | [`router.rs`](../../../backend/rust_api/src/app/router.rs) |
| POST/GET | `/api/v1/glossaries` | glossary create/list | upsert/query | glossary/list | validation | [`router.rs`](../../../backend/rust_api/src/app/router.rs) |
| GET/PUT/DELETE | `/api/v1/glossaries/:glossary_id` | glossary handlers | path/update | glossary/delete | 404/validation | [`router.rs`](../../../backend/rust_api/src/app/router.rs) |
| GET | `/api/v1/glossaries/:glossary_id/export.csv` | `export_glossary_csv_route` | path | CSV | missing glossary | [`router.rs`](../../../backend/rust_api/src/app/router.rs) |
| GET | `/api/v1/providers/ocr` | `providers::list_ocr_providers` | none | provider definitions | auth | [`providers.ts`](../../../frontend/src/js/api/providers.ts) |
| POST | `/api/v1/providers/mineru/validate-token` | `validate_mineru_token` | token payload | validation result | upstream/auth errors | [`router.rs`](../../../backend/rust_api/src/app/router.rs) |
| POST | `/api/v1/providers/paddle/validate-token` | `validate_paddle_token` | token payload | validation result | upstream/auth errors | [`router.rs`](../../../backend/rust_api/src/app/router.rs) |
| POST | `/api/v1/providers/deepseek/validate-token` | `validate_deepseek_token` | key/base URL | validation result | upstream/auth errors | [`router.rs`](../../../backend/rust_api/src/app/router.rs) |
| POST | `/api/v1/providers/deepseek/balance` | `query_deepseek_balance` | key/base URL | balance result | upstream/auth errors | [`router.rs`](../../../backend/rust_api/src/app/router.rs) |
| GET | `/api/v1/library/books` | `library::list_books` | query | legacy book list | legacy storage limitations | [`router.rs`](../../../backend/rust_api/src/app/router.rs) |
| POST | `/api/v1/library/books/delete` | `library::delete_books` | ids | delete result | favorites/job refs | [`router.rs`](../../../backend/rust_api/src/app/router.rs) |
| GET/DELETE | `/api/v1/library/books/:job_id` | book handlers | path/delete | book/delete | missing job | [`router.rs`](../../../backend/rust_api/src/app/router.rs) |
| GET | `/api/v1/library/books/:job_id/cover` | `download_book_cover` | path | image | missing artifact | [`router.rs`](../../../backend/rust_api/src/app/router.rs) |
| GET | `/api/v1/library/books/:job_id/thumbnail` | `download_book_thumbnail` | path | image | missing artifact | [`router.rs`](../../../backend/rust_api/src/app/router.rs) |
| POST | `/api/v1/translate/bundle` on simple port | `jobs::translate_bundle` | multipart/simple bundle | translated bundle/job result | auth/upload/provider errors | [`build_simple_app()`](../../../backend/rust_api/src/app/router.rs) |

## Validation And Transformation

`/api/v1/jobs` rejects legacy flat fields through serde `deny_unknown_fields` in [`CreateJobInput`](../../../backend/rust_api/src/models/input/request.rs); frontend also checks legacy leaks in [`jobs-submit.ts`](../../../frontend/src/js/api/jobs-submit.ts). Job creation transforms request into `ResolvedJobSpec` and validates upload/source/provider/render constraints in [`services/jobs/creation`](../../../backend/rust_api/src/services/jobs/creation).

## Public/Internal/Development

Public product API: `/api/v1/jobs`, uploads, documents, favorites, collections, search, artifacts, providers and AI ask. Internal/developer-heavy API: translation item replay, diagnostics, resume/retry/stage-actions. Legacy-compatible API: `/api/v1/ocr/jobs` and `/api/v1/library/books`. Simple bundle API is a separate surface on simple port.

## Source References

- [`backend/rust_api/src/app/router.rs`](../../../backend/rust_api/src/app/router.rs)
- [`frontend/src/js/api`](../../../frontend/src/js/api)
- [`backend/rust_api/src/models/input/request.rs`](../../../backend/rust_api/src/models/input/request.rs)
- [`backend/rust_api/src/routes/ai_proxy.rs`](../../../backend/rust_api/src/routes/ai_proxy.rs)

## Related Pages

- [Data models](data-models.md)
- [Cross-runtime contracts](cross-runtime-contracts.md)
- [Frontend library and reader](../04-components/frontend-library-and-reader.md)

