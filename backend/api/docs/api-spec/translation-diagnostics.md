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
