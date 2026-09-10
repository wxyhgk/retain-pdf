# Document Metadata Suggestions

[API spec index](../../API_SPEC.md)

The document metadata API derives durable, reviewable title suggestions from
the uploaded PDF and normalized OCR output. It never lets a model or OCR
adapter write `documents.title` directly.

## Endpoints

```text
POST /api/v1/documents/{document_id}/metadata-suggestions
GET  /api/v1/documents/{document_id}/metadata-suggestions?limit=20
POST /api/v1/documents/{document_id}/metadata-suggestions/{suggestion_id}/apply
```

## Generate a suggestion

Request:

```json
{
  "job_id": "optional-ocr-job-id",
  "fields": ["title"],
  "apply_if_default": true
}
```

- `job_id` must belong to the selected document and expose a readable
  `normalized_document_json`. When omitted, the newest usable document job is
  selected.
- Version 1 supports only `title`. The array is retained so authors, year, and
  DOI can be added without replacing the endpoint.
- `apply_if_default` only applies the selected title while the current title is
  still the upload filename and has not been user-locked.
- Candidate priority is explicit OCR `structure_role=document_title`, provider
  `doc_title`, legacy `structure_role=title + layout_role=title`, then PDF Info
  metadata. Generic headings and abstracts are excluded.

Response data:

```json
{
  "suggestion_id": "meta-20260903123000-a1b2c3",
  "document_id": "sha256-document-id",
  "source_job_id": "ocr-job-id",
  "artifact_sha256": "sha256-of-the-source-and-normalized-evidence",
  "status": "completed",
  "fields": ["title"],
  "title_candidates": [
    {
      "value": "A Reliable Paper Title",
      "source": "ocr_structure",
      "confidence": 0.99,
      "evidence": [
        {
          "source": "normalized_document",
          "page_idx": 0,
          "block_id": "p001-b0001",
          "structure_role": "document_title",
          "layout_role": "title"
        }
      ]
    }
  ],
  "selected_title": "A Reliable Paper Title",
  "generation_method": "ocr_structure",
  "needs_ai_review": false,
  "applied": false,
  "can_apply": true,
  "created_at": "2026-09-03T12:30:00Z",
  "updated_at": "2026-09-03T12:30:00Z"
}
```

The suggestion and its evidence hash are persisted before it is returned, so
the frontend can recover it with `GET` after refresh or connection loss.

## Apply a suggestion

Request:

```json
{
  "expected_document_updated_at": "2026-09-03T12:29:00Z"
}
```

The revision guard is optional, but clients should send the `updated_at` value
they displayed. Application runs in an immediate SQLite transaction and
returns both the updated suggestion and document. It is idempotent when that
suggestion is already applied.

Manual `PATCH /api/v1/documents/{document_id}` title updates set
`title_source=user` and `title_locked=true`. Automatic suggestions cannot
overwrite that title. Automatically applied titles expose `title_source` as
`ocr` or `pdf_metadata` and remain distinguishable from user edits.

## Stable errors

- `OCR_JOB_NOT_FOUND` — the explicitly selected job does not exist.
- `DOCUMENT_METADATA_JOB_MISMATCH` — the job belongs to another document.
- `DOCUMENT_METADATA_SOURCE_NOT_READY` — the selected OCR artifact is absent.
- `DOCUMENT_METADATA_SOURCE_INVALID` — the normalized document is invalid JSON.
- `DOCUMENT_TITLE_CANDIDATE_NOT_FOUND` — neither PDF metadata nor OCR contains
  a usable title.
- `DOCUMENT_METADATA_SUGGESTION_NOT_FOUND` — the suggestion does not exist for
  this document.
- `DOCUMENT_TITLE_CHANGED` — a user or another request changed the title.
- `DOCUMENT_REVISION_CONFLICT` — `expected_document_updated_at` is stale.

LLM normalization is intentionally outside this first deterministic phase.
Future AI fallback must consume bounded candidate evidence, write another
durable suggestion with `source=ai`, and still use the same guarded apply
transition; it must never mutate the document row directly.
