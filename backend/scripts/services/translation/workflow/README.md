# Translation Workflow Boundaries

`services.translation.workflow` is the book-level translation orchestration layer.
It is responsible for chaining stable protocols, preparing strategy/context, executing LLM, backfilling results, storage, diagnostics, and events,
but should not let a single file handle all responsibilities.

## Current Entry Points

- `execution.py`
  External request object and execution entry point.
- `execution_plan.py`
  Creates immutable execution plans based on OCR JSON, strategy configuration, glossary, context, and provider diagnostics configuration.
- `execution_runner.py`
  Executes the plan and writes aggregate products such as manifest, review, and diagnostics.
- `book_flow.py`
  Current full-book translation stage sequence.

## Directory Goals

- `phases/`
  Receives stage implementations currently concentrated in `stages.py`.
  A phase may call policy, continuation, LLM, or repair services, but event formatting and storage details should be narrowed.

- `scheduling/`
  Receives queue allocation, batch workers, result draining, tail retry, and flush strategies.
  These logics are currently scattered in `batch_runner.py`, `workers.py`, and `batching/pending_units.py`.

- `legacy/`
  Receives old per-page translation compatibility paths.
  Currently mainly `translation_workflow.py`, along with callers that still need it for debugging.

- `batching/`
  Batch construction rules: deduplication, low-risk merge judgment, fast-path planning, and pending-unit selection.
  It should not be responsible for provider transport or per-page file storage.

## Boundary Rules

- Workflow may orchestrate services but should not contain provider-specific HTTP logic.
- Workflow may emit pipeline events, but event contracts must be stable; stages cannot be inferred from log messages.
- Batch scheduling should not decide translation quality strategies, only execute prepared units and expose structured failures.
- Result flush should not recreate global translation-unit state unless explicitly requested by the caller.
- Rendering prewarm is the responsibility of runtime/pipeline; translation should not import rendering modules.

## Migration Sequence

1. Move stage implementations in `stages.py` to `phases/` by responsibility.
2. Move queue workers / tail retry in `batch_runner.py` to `scheduling/`.
3. Move old per-page translation helpers to `legacy/`; remove related production exports only after no more production calls remain.
