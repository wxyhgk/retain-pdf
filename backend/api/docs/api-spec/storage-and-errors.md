# Errors, Storage, and Implementation Notes

[API spec index](../../API_SPEC.md)

## Error Shape

All JSON error responses expose one authoritative, typed error object:

```json
{
  "code": 40000,
  "message": "request could not be processed",
  "error": {
    "code": "BAD_REQUEST",
    "http_status": 400,
    "details": {}
  }
}
```

The fields have these meanings:

- `error.code` is the stable machine-readable code. New consumers must branch
  on this field rather than the human-readable message or legacy top-level
  `code`.
- `error.http_status` is the integer HTTP response status and always agrees
  with the actual response status.
- `error.details` is always an object. It carries documented, non-secret
  domain context; an error with no additional context returns `{}`.
- top-level `code` and `message` remain present for compatibility. Existing
  domain-specific top-level fields also remain present during this migration.
  No removal deadline is currently specified.

Successful response envelopes are unchanged and do not include `error`.

### Generic error codes

Errors without a more specific owning-domain code use one of:

- `UNAUTHORIZED`
- `FORBIDDEN`
- `BAD_REQUEST`
- `PAYLOAD_TOO_LARGE`
- `UNSUPPORTED_MEDIA_TYPE`
- `UNPROCESSABLE_ENTITY`
- `NOT_FOUND`
- `METHOD_NOT_ALLOWED`
- `CONFLICT`
- `TOO_MANY_REQUESTS`
- `BAD_GATEWAY`
- `SERVICE_UNAVAILABLE`
- `INTERNAL`

The legacy numeric top-level codes continue to use these values and ranges:

- `400xx` request errors
- `401xx` authentication errors
- `403xx` authorization errors
- `404xx` not found
- `40500` method not allowed
- `409xx` state conflict
- `41300` request body too large
- `41500` unsupported request media type
- `42200` syntactically valid input that does not match the expected schema
- `429xx` rate limiting
- `502xx` upstream errors
- `503xx` service availability errors
- `500xx` internal error

These ranges are compatibility metadata, not the new dispatch key. Consumers
should use `error.code`.

### Framework and routing rejections

Public JSON, query-string, path-parameter, and multipart input extractors
normalize framework rejections into the same error object as application
errors. They expose fixed, safe messages and do not return parser internals,
Serde field traces, multipart boundary diagnostics, request bodies, or other
raw rejection details.

| Rejection | HTTP status | Legacy `code` | `error.code` | Public `message` |
| --- | ---: | ---: | --- | --- |
| Malformed JSON syntax | 400 | `40000` | `BAD_REQUEST` | `invalid JSON request body` |
| JSON value does not match the request schema | 422 | `42200` | `UNPROCESSABLE_ENTITY` | `JSON request body does not match the expected schema` |
| Missing JSON content type | 415 | `41500` | `UNSUPPORTED_MEDIA_TYPE` | `expected an application/json request body` |
| JSON body exceeds the configured limit | 413 | `41300` | `PAYLOAD_TOO_LARGE` | `request body is too large` |
| Invalid query parameters | 400 | `40000` | `BAD_REQUEST` | `invalid query parameters` |
| Invalid typed path parameters | 400 | `40000` | `BAD_REQUEST` | `invalid path parameters` |
| Invalid initial multipart request | 400 | `40000` | `BAD_REQUEST` | `invalid multipart request` |

Multipart failures that occur later while consuming fields follow the same
safe-message rule. A configured body-limit failure remains `413` /
`PAYLOAD_TOO_LARGE`; internal body-read failures are not exposed with their
underlying parser text.

Multipart file fields are bounded while they are streamed, not after a full
in-memory allocation. The current endpoint limits are:

| Endpoint | Limit source | Default / fallback |
| --- | --- | ---: |
| `/api/v1/uploads` | `RUST_API_UPLOAD_MAX_BYTES` | 512 MiB when unset or `0` |
| `/api/v1/ocr/jobs` | `RUST_API_UPLOAD_MAX_BYTES` | 512 MiB when unset or `0` |
| `/api/v1/translate/bundle` | `RUST_API_UPLOAD_MAX_BYTES` | 512 MiB when unset or `0` |
| `/api/v1/assets` | `RUST_API_ASSET_MAX_BYTES` | 20 MiB |
| `/api/v1/fonts/upload` | backend hard limit | 64 MiB |

These checks use bytes actually received from each field and do not trust
`Content-Length` as an authority. Oversized fields use the unified `413` /
`41300` / `PAYLOAD_TOO_LARGE` response.

An unknown `/api/...` path currently returns the unified `404` response with
legacy `code=40400`, `error.code=NOT_FOUND`, and `message="route not found"`.
For a path that belongs to the authenticated API but is called with an
unsupported method, authentication still runs first. A caller without valid
authorization receives the authentication error; an authenticated caller
receives the unified `405` response with legacy `code=40500`,
`error.code=METHOD_NOT_ALLOWED`, and `message="method not allowed"`. The
method response retains the framework-provided `Allow` header.

### Domain error codes

A domain may provide a more precise uppercase `SNAKE_CASE` code, owned and
documented by that domain. Existing examples include `CREDENTIAL_*`,
`LIVE_TRANSLATION_*`, and OCR artifact reuse codes such as
`OCR_ARTIFACT_NOT_REUSABLE`. The same domain code is returned in both
`error.code` and the legacy top-level `code` during the compatibility period.

Domain-specific legacy fields are mirrored under `error.details`. For example,
an OCR artifact reuse conflict remains readable by old clients while giving
new clients one uniform dispatch location:

```json
{
  "code": "OCR_ARTIFACT_NOT_REUSABLE",
  "message": "existing OCR artifacts cannot be reused",
  "reason": "missing_layout_data",
  "can_fallback_to_ocr": true,
  "error": {
    "code": "OCR_ARTIFACT_NOT_REUSABLE",
    "http_status": 409,
    "details": {
      "reason": "missing_layout_data",
      "can_fallback_to_ocr": true
    }
  }
}
```

Error messages and details must not contain credentials, signed URLs, raw
provider requests, or absolute filesystem paths. Unknown detail keys must not
be used as an authorization or retry signal unless the owning domain documents
them.

## Storage Layout

Rust API layer stores:

- uploads in `DATA_ROOT/uploads/`
- downloads in `DATA_ROOT/downloads/`
- metadata in `DATA_ROOT/db/jobs.db`
- SQLite logical families:
  - `uploads`, `jobs`, `artifacts`, `job_artifact_entries`, and `events` for
    core job state, published artifacts, and historical timelines
  - `pipeline_attempts`, `pipeline_stages`, `pipeline_units`, and
    `pipeline_dispatches` for durable generation-fenced execution state and
    external-provider dispatch receipts
  - `documents`, `favorites`, `collections`, `collection_documents`,
    `document_tags`, and `blocks_fts` for the library projection
  - `ai_conversations` / `ai_messages` for the durable message tree
  - `document_operations`, immutable attempts/events, and `document_versions`
    for Agent operation execution and compare-and-swap publication
- job workspaces in `DATA_ROOT/jobs/<job_id>/`
- document-operation workspaces in `DATA_ROOT/operations/<operation_id>/`
- the credential vault in the protected `DATA_ROOT/secrets/` subtree

Current standard job workspace layout:

- `DATA_ROOT/jobs/<job_id>/source`
- `DATA_ROOT/jobs/<job_id>/ocr`
- `DATA_ROOT/jobs/<job_id>/translated`
- `DATA_ROOT/jobs/<job_id>/rendered`
- `DATA_ROOT/jobs/<job_id>/artifacts`
- `DATA_ROOT/jobs/<job_id>/logs`

Legacy jobs using `originPDF/jsonPDF/transPDF/typstPDF` or absolute-path artifact storage are no longer supported by detail and download endpoints and must be rerun.

## Implementation Notes

- Rust API should not parse or manipulate PDF internals
- Rust only orchestrates jobs and exposes resources
- Python worker remains the single execution implementation, driven by stage spec files
- later migration to dedicated Python worker service is straightforward because the API contract is already stable
- `workflow = "book"` is the current protocol identifier for the full document flow
- it is kept for API stability and does not imply user-facing entrypoint names must expose the provider
