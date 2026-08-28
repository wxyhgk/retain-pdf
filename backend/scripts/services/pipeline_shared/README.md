# Pipeline Shared - Notes

`services/pipeline_shared/` contains shared protocol layers used across stages but not belonging to any single provider.

Currently, it mainly contains three types of content:

- `events.py`
  Unified stage event logger for Python workers. All detailed events of OCR / translation / rendering must be written to `logs/pipeline_events.jsonl` through this.
- `contracts.py`
  Shared stdout labels and summary filenames for provider / translate / render workers.
- `io.py`
  Neutral JSON writing helpers.
- `source_json.py`
  Neutral rules on how mainline chooses the official input between raw provider layout and normalized document.
- `summary.py`
  Shared pipeline summary creation and printing logic for mainline workers.

Design Boundaries:

- Only contains stage-level shared protocols, not provider-specific semantics like MinerU or Paddle.
- Only contains common capabilities required by the mainline, not translation strategy details, rendering implementation, or OCR adapters.
- `services/mineru/` can continue to hold the compatibility layer, but new mainline dependencies should preferentially point here.
- The main semantics of events must be written in top-level fields, not just stuffed into `payload`.
- `message` is for human reading only; frontend and Rust API canonicalization should not rely on it to infer stages.

## Event Field Conventions

Python root events must always include:

- `user_stage`: `ocr | translation | render | done`
- `stage`: Internal machine stage of Python
- `substage`: Machine-readable sub-stage
- `stage_detail`: Short user-facing text
- `event_type`: Root event type, e.g., `stage_progress`
- `semantic_event_type`: Semantic event type, e.g., `progress`
- `progress_current`
- `progress_total`
- `progress_unit`
- `payload`

Current stable sub-stages include:

- `ocr_processing`
- `normalizing`
- `translation_prepare`
- `domain_inference`
- `page_policies`
- `continuation_review`
- `translation_batches`
- `translation_tail_retry`
- `garbled_repair`
- `agent_repair`
- `final_untranslated_recovery`
- `render_prepare`
- `render_prewarm`
- `render_pages`
- `render_compile`

When adding new sub-stages, the Rust mapping must be updated synchronously:

- `backend/rust_api/src/models/job/stage.rs`
- `backend/rust_api/src/services/jobs/presentation/live_stage/canonical_events.rs`

See the full protocol at:

- `doc/core/rust_api/11-stage-events-and-failure-protocol.md`

The goal of this layer is not to add another abstraction layer but to consolidate capabilities already shared across the entire pipeline (previously under the name `services/mineru/*`) into a neutral module, facilitating the development of the backend into a "modular monolith" later.
