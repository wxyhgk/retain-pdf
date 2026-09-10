# Rust API Spec

This file is the entrypoint for the Rust API implementation contract. The
detailed contract is split by stable backend domain under `docs/api-spec/`.

For frontend and third-party integration, the canonical public entrypoint is
the [RetainPDF backend API index](../../docs/core/api/index.md). The pages linked
below retain the more detailed Rust/Python orchestration, diagnostics, recovery,
and internal Agent contracts used by backend maintainers.

## Global HTTP Conventions

- Base path: `/api/v1`
- Health path: `/health`
- Except for raw file download endpoints, responses are JSON.
- Except for `GET /health`, endpoints require `X-API-Key` unless a documented
  internal Agent capability authorizes the exact method and path.
- `X-API-Key` authenticates access to the Rust API. It is not an OCR provider
  token or model API key.
- API paths, stage names, artifact keys, schema versions, and stdout labels are
  protocol constants rather than deployment configuration.

Successful JSON responses use the shared envelope:

```json
{
  "code": 0,
  "message": "ok",
  "data": {}
}
```

`code = 0` means success. JSON error responses additionally contain the
authoritative `error = {code, http_status, details}` object. New consumers must
branch on `error.code`; the top-level `code` and `message`, plus existing
domain-specific top-level fields, remain as compatibility fields and have no
declared removal date. Generic and domain-specific code rules are defined in
[Errors, storage, and implementation notes](docs/api-spec/storage-and-errors.md).
The same envelope covers JSON, query, typed path, and multipart extractor
failures, as well as unknown API paths and unsupported methods. Public messages
are fixed and do not expose framework parsing details. Unknown `/api/...` paths
currently return `404`; an unsupported method on a matched authenticated route
still passes through authentication before the `405` response.

Authentication header:

```http
X-API-Key: your-rust-api-key
```

Responses never echo raw provider or model credentials. New translation calls
should use an opaque `credential_ref`; the temporary inline API-key path exists
only for compatibility. See the detailed credential contract below.

## Contract Map

| Domain | Contents |
| --- | --- |
| [Runtime, configuration, and events](docs/api-spec/runtime-and-events.md) | Rust/Python boundary, runtime knobs, status model, queue semantics, historical job events |
| [Jobs and workflows](docs/api-spec/jobs.md) | Upload, create, OCR reuse, list/detail, stage retry, ambiguity policy, cancel, document-scoped history |
| [Reader regions and artifacts](docs/api-spec/artifacts.md) | Reader alignment, artifact JSON, PDF, cover, thumbnail, Markdown, images, bundles |
| [Glossary resources](docs/api-spec/glossaries.md) | Glossary CRUD, CSV parsing/export, and JSON import |
| [Translation diagnostics](docs/api-spec/translation-diagnostics.md) | Summary, item index/detail, redaction, and single-item replay |
| [Credential references](docs/api-spec/credentials.md) | Vault API, CAS revisions, permissions, runtime resolution, and adoption scope |
| [AI proxy, conversations, and public operation control](docs/api-spec/ai-control-plane.md) | Ask/SSE proxy, runtime settings, durable message tree, operation projection, explicit confirmation actions, and candidate download |
| [Backend-only Agent document operations](docs/api-spec/agent-document-operations.md) | Capabilities, fixed page programs, confirmation modes, retry/idempotency, candidate validation, runtime cursor |
| [Live translation overlay](docs/api-spec/live-translation.md) | Durable layout/page snapshots, SSE replay, commit ordering, and producer requirements |
| [Document metadata suggestions](docs/api-spec/document-metadata.md) | Durable title candidates, OCR role mapping, provenance, and guarded application |
| [Errors, storage, and implementation notes](docs/api-spec/storage-and-errors.md) | Error shape, code ranges, data-root layout, and backend/worker ownership |

## Related Backend Documents

- [Service documentation index](README.md)
- [Current runtime API map](CURRENT_API_MAP.md)
- [Rust API architecture](RUST_API_ARCHITECTURE.md)
- [Stage execution contract](STAGE_EXECUTION_CONTRACT.md)
- [OCR provider contract](OCR_PROVIDER_CONTRACT.md)
- [Render options contract](RENDER_OPTIONS_CONTRACT.md)
- [Rust API directory map](RUST_API_DIRECTORY_MAP.md)

## Maintenance Rules

- Update the domain page that owns the behavior; do not append new numbered
  sections to this index.
- Treat `src/app/router/*.rs` as the authority for route registration. Endpoint
  maps in these pages are curated navigation aids and must not be interpreted
  as additional or planned routes.
- Keep public HTTP paths and schema identifiers unchanged when moving prose.
- Cross-domain rules should have one normative home and be linked from other
  pages instead of copied.
- Changes to worker/stage payloads must also update their schema and producer /
  consumer contract tests; documentation alone does not change the protocol.
- Do not document secrets, absolute runtime paths, signed URLs, or raw provider
  request bodies in examples.
