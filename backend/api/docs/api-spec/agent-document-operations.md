# Backend-only Agent Document Operations

[API spec index](../../API_SPEC.md) ·
[public AI control plane](ai-control-plane.md)

## Operation Capability and Execution Contract

These routes are for the bundled local `retainpdf-agent` CLI and trusted AI
host. They are not a frontend contract; browsers use the
[public operation projection and actions](ai-control-plane.md#public-operation-projection-and-actions).
A create request may carry a closed
`retainpdf_page_program_v1` data program; the backend executes only fixed page
operators and never model-generated Python, shell, paths, packages, or binary
selection.

The trusted backend first exchanges its full `X-API-Key` for a short-lived,
least-privilege capability:

```text
POST /api/v1/internal/agent/capabilities
```

```json
{
  "schema": "agent_capability_issue_v1",
  "conversation_id": "conv-id",
  "document_id": "sha256-document-id",
  "actions": [
    "document.inspect",
    "operation.create",
    "operation.get",
    "operation.run",
    "operation.commit",
    "operation.cancel"
  ],
  "ttl_seconds": 120
}
```

The conversation must already be bound to the document. TTL is limited to
1..300 seconds. The returned `rpdfcap1` token is not persisted and becomes
invalid when it expires or the API process restarts. The CLI reads it from
`RETAINPDF_AGENT_CAPABILITY` and sends
`X-RetainPDF-Agent-Capability`; it must not put the token in arguments or
logs. Capability authentication is admitted only for the exact inspect and
operation routes below. Runtime-session access and capability re-issuance
still require the full API key.

```text
GET  /api/v1/documents/{document_id}
POST /api/v1/internal/agent/operations
GET  /api/v1/internal/agent/operations/{operation_id}
POST /api/v1/internal/agent/operations/{operation_id}/run
POST /api/v1/internal/agent/operations/{operation_id}/commit
POST /api/v1/internal/agent/operations/{operation_id}/cancel
```

Create request:

```json
{
  "schema": "document_operation_create_v1",
  "idempotency_key": "client-generated-stable-key",
  "conversation_id": "",
  "request_message_id": "message-id",
  "document_id": "sha256-document-id",
  "intent_summary": "duplicate page 1 and rotate the copy",
  "program_sha256": "sha256-of-canonical-program-json",
  "program": {
    "schema": "retainpdf_page_program_v1",
    "steps": [
      {"op": "select_pages", "pages": [1, 1]},
      {"op": "rotate_pages", "pages": [2], "degrees": 90}
    ]
  }
}
```

Page numbers are 1-based against the current step output. `select_pages`
therefore supports deletion, reordering, and duplication; `rotate_pages`
accepts only 90, 180, or 270 degrees. Unknown fields and operators are rejected.
`program_sha256` is checked against canonical JSON before workspace creation.
Omitting `program` retains the non-executing `control_plane_preview_v1`
compatibility path.

Run request:

```json
{
  "schema": "document_operation_run_v1",
  "idempotency_key": "client-generated-run-key",
  "confirmed": true
}
```

Retry uses the same coarse `run` action, not another model tool. A failed
attempt can be retried with a new stable idempotency key:

```json
{
  "schema": "document_operation_run_v1",
  "idempotency_key": "client-generated-retry-key",
  "confirmed": true,
  "retry": true
}
```

For `ambiguous`, the caller must independently accept possible duplicate
execution:

```json
{
  "schema": "document_operation_run_v1",
  "idempotency_key": "client-generated-ambiguous-retry-key",
  "confirmed": true,
  "retry": true,
  "accept_duplicate_risk": true
}
```

Retry preserves the operation id, source hash, program hash, limits, and prior
attempt directory, while transactionally selecting a new current attempt and
dispatch id. Its idempotency key is persisted on that attempt, so a dropped
response cannot create attempt N+1 on replay. A changed active document version
returns 409. `accept_duplicate_risk` without `retry`, or an ambiguous retry
without the flag, is rejected.

Cancel and commit use `document_operation_cancel_v1` and
`document_operation_commit_v1`. Effectful calls require a non-empty
idempotency key. Responses use `document_operation_view_v1` and include the
immutable manifest, durable state, candidate version when present, and the
append-only event history.

Capability checks are enforced twice: the auth layer checks the exact
method/path action allowlist, then the operation route compares the bound
conversation/document with the request payload or stored operation before any
effect runs. Full API-key authentication remains supported for trusted
bootstrap and administration.

The model runtime never receives this capability. The shared host command
broker used by the OpenAI-compatible and FX operation runtimes admits only the
exact `retainpdf-agent` argv grammar, then mints a 60-second capability for that
single action and executes the real CLI outside the model runtime.
The host injects conversation, document, request-message, and idempotency scope.
In the default `explicit` confirmation mode, `operation.run`,
`operation.commit`, and retry additionally require the `/v1/ask` request field
`confirm_document_operation: true`; this field represents an independent user
confirmation and is not model-controlled. The AI response projects pending
actions as `confirmation_requests`, and streaming responses emit
`agent_confirmation_required`, so clients never need to infer authority from
model prose. Backend runtime config may explicitly select `green_light`; that
mode supplies host confirmation automatically but does not broaden the exact
CLI grammar, scoped capability, idempotency, state, or candidate-validation
boundaries. The current user message is persisted before the Agent turn so its
id remains a durable operation foreign key across client disconnects. Direct
browser actions do not call these internal routes: they send the last observed
status, attempt, and program hash to the public CAS endpoints instead.

The restricted executor writes a durable run index before the API returns from
dispatch and an atomic terminal result when the worker finishes. A later GET
reconciles queued/running state after API restart. Before publication, every
expected source/output page pair is rasterized through fixed PyMuPDF code at a
backend-owned maximum dimension of 512 pixels after applying the approved
mapping and rotation; dimensions and RGB pixels must match. The worker writes
a compact `retainpdf_visual_validation_v1` report, and
Rust verifies its immutable hash, source/program/candidate identities, page
counts, aggregate pixel hashes, and zero mismatch list before publishing a
candidate. Browser or SSE disconnection does not cancel the worker. Commit is
a separate compare-and-swap action; after commit the candidate is projected as
the document's active source for later operations and translation. Arbitrary
executable programs remain disabled until a real OS/container confinement
backend exists.

### Internal Agent Runtime Session Cursor

These backend-only routes persist an opaque adapter cursor. They are not a
frontend chat contract and contain no model transcript:

```text
GET    /api/v1/internal/agent/runtime-sessions/{conversation_id}
PUT    /api/v1/internal/agent/runtime-sessions/{conversation_id}
DELETE /api/v1/internal/agent/runtime-sessions/{conversation_id}
```

PUT uses `agent_runtime_session_put_v1` with `runtime_id`, `session_cursor`,
and `expected_revision`. DELETE uses `agent_runtime_session_clear_v1` with
`expected_revision`. A stale revision returns 409, so a replacement agent
process cannot overwrite the session published by a newer process.
