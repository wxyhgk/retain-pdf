# Translation Diagnostics

[API spec index](../../API_SPEC.md)

## Translation Diagnostics Contract

These endpoints are for fast item-level debugging. They expose the translation diagnostics artifact, the per-item debug index, the saved item payload, and a replay hook that reruns the current translation code on a single item without mutating job artifacts.

Security:

- responses are redacted before returning to clients
- structured secret fields such as `api_key`, `mineru_token`, and `paddle_token` are blanked
- inline secret substrings are replaced with `[REDACTED]`

All four endpoints are job-local and currently read from:

- `DATA_ROOT/jobs/<job_id>/artifacts/translation_diagnostics.json`
- `DATA_ROOT/jobs/<job_id>/artifacts/translation_debug_index.json`
- `DATA_ROOT/jobs/<job_id>/translated/translation-manifest.json`

## Translation Diagnostics Summary

`GET /api/v1/jobs/{job_id}/translation/diagnostics`

Response:

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "job_id": "20260416034152-d12925",
    "summary": {
      "schema": "translation_diagnostics_v1",
      "counts": {
        "translated": 412,
        "kept_origin": 18,
        "skipped": 97
      },
      "provider_family": "deepseek",
      "final_status_counts": {
        "translated": 412,
        "kept_origin": 18,
        "skipped": 97
      }
    }
  }
}
```

## Translation Item Index

`GET /api/v1/jobs/{job_id}/translation/items`

Query parameters:

- `limit`
- `offset`
- `page`
- `final_status`
- `error_type`
- `route`
- `q`

Response:

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "items": [
      {
        "item_id": "p006-b014",
        "page_idx": 5,
        "page_number": 6,
        "block_idx": 14,
        "block_type": "text",
        "math_mode": "direct_typst",
        "continuation_group": "",
        "classification_label": "body",
        "should_translate": true,
        "skip_reason": "",
        "final_status": "kept_origin",
        "source_preview": "Formation of heterocycle 9 improves hyperconjugation...",
        "translated_preview": "",
        "route_path": ["direct_typst", "single_item"],
        "fallback_to": "sentence_level",
        "degradation_reason": "transport_error",
        "error_types": ["TranslationProtocolError"]
      }
    ],
    "total": 1,
    "limit": 20,
    "offset": 0
  }
}
```

## Raw Translation Item

`GET /api/v1/jobs/{job_id}/translation/items/{item_id}`

Response:

- same payload shape as the saved translated item
- sensitive fields and inline secrets are redacted

## Replay Translation Item: Response Projection

`POST /api/v1/jobs/{job_id}/translation/items/{item_id}/replay`

Response:

- replay output is returned as JSON payload
- replay payload is redacted with the same rules as diagnostics/item endpoints

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "job_id": "20260416034152-d12925",
    "item_id": "p006-b014",
    "page_idx": 5,
    "page_number": 6,
    "page_path": "page-006.json",
    "item": {
      "item_id": "p006-b014",
      "source_text": "Formation of heterocycle 9 improves hyperconjugation...",
      "translated_text": "",
      "classification_label": "body",
      "should_translate": true,
      "final_status": "kept_origin",
      "translation_diagnostics": {
        "route_path": ["direct_typst", "single_item"],
        "fallback_to": "sentence_level",
        "degradation_reason": "transport_error"
      }
    }
  }
}
```

## Replay Translation Item: Execution Behavior

`POST /api/v1/jobs/{job_id}/translation/items/{item_id}/replay`

Behavior:

- launches `services/pipeline/devtools/replay_translation_item.py`
- re-applies current policy to the saved item payload
- if the item still qualifies for translation, reruns `translate_batch([item])`
- never writes back to the original job directory

Response:

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "job_id": "20260416034152-d12925",
    "item_id": "p006-b014",
    "payload": {
      "job_id": "20260416034152-d12925",
      "item_id": "p006-b014",
      "page_idx": 5,
      "policy_before": {
        "should_translate": true,
        "final_status": "kept_origin"
      },
      "policy_after": {
        "should_translate": true,
        "final_status": "translated"
      },
      "replay_result": {
        "translated_text": "杂环 9 的形成增强了超共轭作用……"
      },
      "replay_error": null
    }
  }
}
```

These endpoints are intended for local debugging and automated regression fixtures. They are not yet optimized for bulk export or high-throughput replay.

## Revise Translation Item (write-back)

`PATCH /api/v1/jobs/{job_id}/translation/items/{item_id}`

Contract: `contracts/translation-revisions.v1.schema.json`.

Request:

```json
{
  "translated_text": "谐振子是描述分子振动的模型体系。",
  "source": "user",
  "reason": "措辞",
  "expected_generation": 48,
  "rerender": false
}
```

- `source` is one of `user` / `agent` / `refine`; `reason`, `expected_generation`, `rerender` are optional.
- `translated_text` uses the same form as the item's `protected_translated_text` (in `direct_typst` mode: display text with inline math as `$...$`).

Behavior:

- Rust rejects the request with `409 job_running` while the job is queued or running, then runs `retainpdf-pipeline translation-revise`.
- Python takes the translation checkpoint lock, requires a committed checkpoint whose page hashes match the page files, and validates the revised text with the same `review_translation_item` used during translation. Only error-severity issues block.
- On success it atomically rewrites the affected page payload(s) (a continuation-group member rebuilds the whole unit, possibly on another page), advances `translation-checkpoint.v1.json` (`page_hash`, `generation + 1`, new generation snapshot) and appends one line to `translated/revisions.v1.jsonl`. Any failure restores the original bytes.
- Identical text returns `changed: false` without writing anything.
- After the write Rust registers the revised page(s) in the live-translation read model, so `GET live-translation/pages/{page_idx}` returns the new text and `page_hash` for succeeded, failed and canceled jobs alike, and `live-events` emits one more `translation_units_committed` per revised page (same shape as a worker commit: `attempt`, `generation`, `page_idx`, `page_hash`, `changed_item_ids`). No new pipeline attempt is created and the job status does not change: the page's current row (the one the live reader resolves) is advanced in place and its attempt's `generation` is bumped, so `(attempt, generation)` stays monotonic for the reader. Pages owned by a running attempt are left to its worker. Once every page's registered hash matches the checkpoint, superseded `generation-*` snapshot directories older than the checkpoint generation are removed.
- The result is reported in `live_publication` (`published` / `current` / `pending` / `unavailable` / `failed`, plus per-page status). Registration failure never rolls the write back: the page files and checkpoint stay authoritative, the old snapshots are kept so the live view keeps serving the previous version, and registration is retried idempotently by the next revision of the job (resending the same request returns `changed: false` and registers it) or when live translation is opened (`GET live-translation/layout`). Registration only accepts page hashes recorded in `revisions.v1.jsonl`, and never lets an older checkpoint generation overwrite a newer one.
- `rerender: true` submits the same in-place render as `POST retry-stage {"stage":"render","create_new_job":false}` after the write. When revising several blocks, set it only on the last request (or call retry-stage once). The render source-cleanup cache under `artifacts/render_prewarm` is kept; text-only edits still match it.

Errors (`error.details.reason`):

- `422 TRANSLATION_REVISION_REJECTED`: `validation_failed` (with `details.validation.issues`), `item_not_translatable` (policy keeps the block as original).
- `409 TRANSLATION_REVISION_CONFLICT`: `job_running`, `checkpoint_locked`, `generation_mismatch` (with `current_generation`), `translation_not_committed`, `publication_inconsistent`, `group_members_missing`, `translations_owned_by_another_job`, `read_only_job`.
- `422 UNPROCESSABLE_ENTITY`: request body does not match the schema (unknown field, bad `source`).

## Translation Item Revision History

`GET /api/v1/jobs/{job_id}/translation/items/{item_id}/revisions`

Returns `{ job_id, item_id, revisions: [...], total }`, oldest first. Each entry is one `translation_revision_v1` record from `translated/revisions.v1.jsonl`. Unknown items return 404.
