# Document workspace execution control plane

This directory is the Rust backend boundary for durable, AI-invokable document
workspaces. The product does not need one model tool per PDF feature. It needs a
small set of infrastructure capabilities that let an agent inspect a document,
run a transformation in a confined workspace, validate the result, and publish
an immutable candidate version.

The module is registered from `services/mod.rs`. It keeps the deterministic
test executor and stateless preview executor, and now also has a production
`restricted_page_program_v1` interpreter. The production path executes a
closed JSON grammar through a fixed backend worker; it still cannot run
model-generated Python or shell code.

P0 currently includes core manifest/state/receipt contracts, versioned SQLite
tables for operations/attempts/events/document versions, idempotent dispatch
reconciliation, durable new-attempt retry, candidate publication,
compare-and-swap commit, a backend-only HTTP adapter, and the local
`retainpdf-agent` CLI. The OpenAI-compatible and experimental FX ACP operation
runtimes reach the CLI through a shared host-owned, exact-argv command broker.
Real page selection, deletion, reordering, duplication, and rotation produce a
validated candidate without adding one model tool per PDF feature.

## Implemented local control surface

The internal routes are protected by the existing API authentication layer and
are not a frontend contract:

```text
POST /api/v1/internal/agent/capabilities
POST /api/v1/internal/agent/operations
GET  /api/v1/internal/agent/operations/:operation_id
POST /api/v1/internal/agent/operations/:operation_id/run
POST /api/v1/internal/agent/operations/:operation_id/commit
POST /api/v1/internal/agent/operations/:operation_id/cancel
```

A capability carrying `document.inspect` may also authorize only
`GET /api/v1/documents/:document_id` for its bound document. It does not
authorize source-PDF/media downloads, mutation routes, capability re-issuance,
or runtime-session access.

Every request uses a versioned JSON schema. Create derives a stable operation
and dispatch identity from the conversation/document scope plus its
idempotency key. Repeating an accepted create, run, commit, or cancel returns
the durable operation projection instead of repeating the effect.

The bundled CLI is a thin loopback HTTP client and never opens SQLite:

```text
retainpdf-agent document inspect --document-id <id>
retainpdf-agent operation create --request requests/create.json
retainpdf-agent operation get --operation-id <id>
retainpdf-agent operation run --operation-id <id> --request requests/run.json
retainpdf-agent operation commit --operation-id <id> --request requests/commit.json
retainpdf-agent operation cancel --operation-id <id> --request requests/cancel.json
```

It accepts only an explicit loopback HTTP origin, reads regular non-symlink
JSON request files from the current workspace, rejects traversal and unknown
flags, and emits a versioned JSON envelope. A trusted backend may authenticate
with `RETAINPDF_AGENT_API_KEY`; operation runtimes use a single-action,
60-second capability only inside the host-owned real CLI subprocess. Neither
the model runtime nor its wrapper receives that credential.

Create requests without program content remain on `control_plane_preview_v1`
for compatibility. A validated `retainpdf_page_program_v1` is frozen into the
workspace and dispatched through `restricted_page_program_v1`.

## Product model

```text
user intent
  -> agent writes a plan or transformation program
  -> Rust snapshots the plan and creates an operation workspace
  -> a confined worker executes against read-only inputs
  -> validators inspect the candidate artifacts
  -> Rust publishes a candidate document version
  -> an explicit commit selects that version
```

The agent composes behavior. The backend supplies only general capabilities:

1. inspect the current PDF and normalized `document.v1.json`;
2. create and query a durable operation workspace;
3. execute a versioned program in that workspace;
4. render and validate candidate artifacts;
5. publish, commit, cancel, retry, or discard a candidate.

Page deletion, rotation, reordering, watermarking, redaction, translation, and
similar features should normally be programs built on these capabilities, not
separate public model tools.

## Existing foundations

- `services/ai` provides Markdown reading plus OpenAI/FX document-operation
  runtimes. `AskOrchestrator` coordinates the turn, while the host broker keeps
  effectful execution behind the exact grammar and Rust capability boundary.
- Rust is the single writer for documents, conversations, jobs, and artifact
  references.
- `JobsFacade` and the job runner already provide asynchronous execution,
  events, checkpoints, cancellation, restart recovery, and artifacts.
- `document.v1.json` is the stable semantic document boundary. Provider raw
  payloads must never become operation inputs.
- `documents.active_job_id` is a current-job pointer, not a sufficient document
  version or transaction model.

## Responsibility

This control plane owns:

- immutable operation identity, input version, program hash, and attempt;
- durable state and append-only execution events;
- confirmation policy for destructive, costly, or ambiguous work;
- creation and validation of the workspace layout;
- dispatch to a separately confined worker;
- mapping from input document/job to candidate artifacts;
- recovery after API, AI service, worker, or network interruption;
- explicit publish, commit, rejection, cancellation, and audit metadata.

It does not own:

- prompts, model selection, or the agent loop;
- OCR provider payload interpretation;
- frontend presentation state;
- in-process execution of model-generated Python;
- direct writes to source PDFs or committed artifacts;
- silently promoting a result to the active document version.

The FX adapter is documented in `services/ai/fx_runtime/README.md`; the shared
AI runtime boundaries are documented in `services/ai/README.md`. Models may
plan and call the coarse lifecycle tools, but this Rust module remains
authoritative for operation state,
dispatch recovery, candidate publication, and commit/CAS.

## Workspace bundle

Every attempt is self-contained under the backend data root:

```text
operations/<operation_id>/
  attempts/
    0001/
      manifest.json             immutable operation and input identity
      state.json                projected mirror; SQLite remains authoritative
      source/
        source.pdf              immutable snapshot or read-only materialization
        document.v1.json        optional normalized semantic input
      program/
        program.json            exact declarative program approved for this attempt
        limits.json             backend-owned resource limits
      outputs/
        candidate.pdf           never treated as committed in place
        executor-result.json     atomic worker terminal identity
        visual-validation.json  compact bounded full-page raster comparison
        validation.json         Rust publication gate report
      logs/
        stdout.log
        stderr.log
```

The canonical append-only event journal is stored in SQLite. A future broker
receipt log may also be mirrored into each attempt directory, but filesystem
mirrors never override committed database state.

All paths stored in manifests are workspace-relative. The agent cannot choose
an absolute path, a parent traversal, an executable path, an environment
variable, or an output destination outside this layout.

## State machine

```text
draft
  -> awaiting_confirmation
  -> queued
  -> running
  -> validating
  -> result_ready
  -> committed

Any executable state may also reach:
  failed | cancelled | ambiguous
```

`result_ready` and `committed` are separate. A valid generated PDF is an
immutable candidate; it does not replace the selected document version until
the operation is committed.

`ambiguous` is fail-closed. It means dispatch or an external effect may have
occurred without a known terminal result. Recovery requires an explicit policy,
following the translation request-journal behavior.

An explicit retry reuses the same operation id and immutable source/program,
but creates a fresh attempt directory, dispatch id, state record, and event
sequence. The previous terminal attempt is never rewritten. `failed` may be
retried after a new confirmation. `ambiguous` additionally requires
`accept_duplicate_risk=true`, because the prior worker may still have produced
an effect. The retry idempotency key is stored on the new attempt: repeating a
request after losing its HTTP response replays that attempt even if it has
already failed, rather than silently creating another one. Retry is rejected if
the document's active base version changed meanwhile.

## Minimum durable record

```text
DocumentOperation
  operation_id
  conversation_id
  request_message_id
  document_id
  base_job_id
  intent_summary
  program_sha256
  status
  confirmation_policy
  confirmed_at
  attempt
  dispatch_id
  dispatch_intent_at
  dispatch_receipt
  executor_kind
  dispatched_at
  candidate_artifact_key
  result_job_id
  validation_summary_json
  error_json
  created_at
  updated_at
```

The model-facing tools remain coarse:

```text
retainpdf_document_inspect
retainpdf_operation_create
retainpdf_operation_get
retainpdf_operation_run
retainpdf_operation_commit
retainpdf_operation_cancel
```

These are lifecycle capabilities, not a catalog of PDF product features.
Browser clients use the redacted `/api/v1/ai/operations/*` projection and CAS
actions documented in
[`docs/api-spec/ai-control-plane.md`](../../../docs/api-spec/ai-control-plane.md),
not these model tools or internal capability routes.
The conversation-scoped public list accepts `limit` plus `offset` and returns
`operations`, `total`, the effective page, and `has_more`; its stable order is
`updated_at DESC, operation_id DESC`. The public `allowed_actions` projection
is the UI authority, while every action still submits the last observed
status, attempt, and program hash for compare-and-swap validation.

## Execution boundary

Setting a subprocess working directory is not sandboxing. Path validation alone
does not prevent generated code from reading the host filesystem, opening the
network, forking processes, or exhausting resources.

No model-generated executable code may run until an executor provides all of
these controls. The restricted page interpreter avoids that code-execution
boundary: model output is data validated against a closed schema, and only
fixed backend operators execute. Its worker still uses fixed workspace paths,
a cleared environment, resource limits, and process-tree cancellation.

An eventual arbitrary-code executor must additionally provide:

- filesystem visibility restricted to the operation workspace;
- source inputs mounted or materialized read-only;
- network disabled by default;
- fixed interpreter and dependency image selected by the backend;
- no model-selected binary, package installation, environment, or host path;
- wall-time, CPU, memory, process-count, file-count, and output-byte limits;
- process-tree termination on cancellation or timeout;
- stdout/stderr capture with secret redaction;
- output type, PDF readability, page count, and size validation;
- an execution journal durable before dispatch and after terminal outcome.

The current worker is safe only for the closed page-program grammar. It is not
an authorization to run generated Python, packages, binaries, or paths.

## Validation pipeline

A successful process exit is insufficient. The restricted page-program slice
currently checks before `result_ready`:

1. the candidate is a readable PDF and has at least one page;
2. file count and output bytes stay within the manifest limits;
3. source, program, and candidate are regular non-symlink files in fixed
   workspace locations;
4. input, program, and candidate hashes match their immutable identities;
5. the parsed page count is recorded in the validation report;
6. every expected source/output page pair rasterizes through PyMuPDF with a
   backend-fixed maximum dimension of 512 pixels;
7. expected and candidate RGB pixels match after applying the approved page
   mapping and rotations;
8. the compact visual report hash matches the executor terminal receipt before
   Rust publishes a candidate.

The visual report stores aggregate pixel, geometry, and page-plan hashes plus a
bounded mismatch-page list; it does not retain a PNG for every page. This keeps
recovery artifacts compact while still validating every page. Operators that
intentionally alter page content will need an operator-specific expected-image
contract before they can pass this gate. Every commit remains explicit.

## First vertical slice

The first slice should prove the generic lifecycle with one generated
transformation program, not add a permanent `rotate_pages` API:

1. create a workspace from an existing document and explicit base job;
2. persist an immutable program and its SHA-256 identity;
3. require confirmation before dispatch;
4. run through the executor interface with a deterministic test executor;
5. produce and validate `candidate.pdf`;
6. expose it as `result_ready` without changing `active_job_id`;
7. commit explicitly and record the selected result version;
8. simulate API replacement during execution and recover from the durable run
   index and terminal result.

This slice is implemented for the restricted page program. Candidate PDF
production, full-page raster comparison, Rust-side report/hash/size/page/file
validation, immutable publication, restart recovery, explicit commit,
active-source projection, tamper rejection, and cancellation are covered end
to end. Arbitrary Python/Typst/Ghostscript programs remain gated on a real
OS/container confinement backend.

## Implementation order

1. Freeze workspace manifest, state, event, and API view schemas.
2. Add core domain types without HTTP or database dependencies.
3. Append a versioned SQLite migration and repository tests.
4. Add workspace path creation and atomic state/event persistence here.
5. Define an executor trait plus deterministic test executor.
6. **Done for page programs:** implement validation and candidate publication.
7. **Done for page programs:** expose execution through the restricted AI-side broker.
8. Select and verify a production confinement backend before any arbitrary code.
9. **Done for operation retry:** restart, duplicate dispatch, confirmation,
   cancellation, immutable new attempts, ambiguous-risk acceptance, response-loss
   replay, and active-base inheritance are covered. Add an explicit concurrent
   commit-race test before broadening the executor grammar.

## Non-negotiable invariants

- Source PDFs and committed result artifacts are immutable.
- Every operation names its base version explicitly.
- The exact program hash is persisted and confirmed before dispatch.
- One attempt is dispatched at most once for one program hash.
- Retries create attempts; they do not erase prior outcomes.
- Operation events are append-only and safe to expose after redaction.
- A stale base version, corrupt journal, or unknown dispatch outcome never
  auto-commits.
- Model text and generated code are untrusted at every Rust boundary.
