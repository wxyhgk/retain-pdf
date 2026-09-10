# fx agent runtime adapter

This directory is the backend-only integration boundary for experimenting with
[`vercel-labs/fx`](https://github.com/vercel-labs/fx) as RetainPDF's agent
harness. It is deliberately an adapter, not a new source of truth and not a PDF
executor.

## Decision

Use fx for:

- model turns, tool selection, streamed agent events, and bounded process
  supervision;
- loading a small RetainPDF agent instruction set;
- invoking a narrow local `retainpdf-agent` CLI for RetainPDF lifecycle
  operations;
- retaining an fx session cursor that can be rebuilt from the canonical
  RetainPDF conversation when necessary.

Do not use fx for:

- document, conversation, operation, or candidate-version authority;
- direct access to the RetainPDF data root or backend source tree;
- executing model-generated Python or shell commands;
- deciding that an operation was committed;
- replacing the document-operation dispatch journal or recovery state machine;
- providing the production sandbox boundary.

The intended call path is:

```text
RetainPDF API
  -> fx runtime adapter (ACP client)
  -> one fx ACP session
  -> local retainpdf-agent CLI
  -> Rust document-operation control plane
  -> separately confined Executor
```

The frontend talks only to the existing RetainPDF API. It never embeds libfx,
holds a Vercel AI Gateway credential, or connects directly to the operation
store.

## Why ACP plus a local CLI

The implemented adapter launches the native `fx acp` process from a private,
nearly empty per-conversation workspace for each active turn. ACP is only the
host-to-agent session protocol. RetainPDF operations are reached through one
bundled local CLI, so the product does not need an MCP server, MCP discovery,
or another network service lifecycle.

This gives the host control over:

- the active session and prompt lifecycle;
- permission requests and streamed events;
- the exact local command admitted to a conversation;
- timeout handling and process supervision;
- the mapping between a RetainPDF conversation and an fx session cursor.

The broker currently admits only these coarse public commands:

```text
retainpdf-agent document inspect
retainpdf-agent operation create --program-json '<compact-json>'
retainpdf-agent operation run --operation-id <id>
retainpdf-agent operation run --operation-id <id> --retry failed
retainpdf-agent operation run --operation-id <id> --retry ambiguous --accept-duplicate-risk yes
retainpdf-agent operation get --operation-id <id>
retainpdf-agent operation commit --operation-id <id>
retainpdf-agent operation cancel --operation-id <id> --reason-code <reason>
```

The agent composes PDF behavior from a versioned program or restricted IR.
Adding a new product operation should not normally require adding another model
tool.

## Trust boundary

fx is a coding-agent harness, so its built-in filesystem and command tools must
not be treated as RetainPDF capabilities.

The current P0 adapter enforces:

1. Start fx with an empty, operation-independent primary workspace.
2. Do not add the repository, data root, document store, or credential
   directories as additional workspaces.
3. Use the headless permission flow and approve only a fully parsed
   `retainpdf-agent` command whose executable, subcommand, flags, and identifier
   arguments match the backend-owned grammar.
4. Deny other command execution, file mutation, skill installation, external
   tool-server configuration, and workspace expansion; only the exact
   RetainPDF CLI wrapper call is admitted.
5. Let the host run the real CLI against the configured Rust API with a
   short-lived capability scoped to one conversation, document, and action.
   Do not give fx the capability or Rust service API key.
6. Require an idempotency key on every effectful CLI call.
7. Treat all model, document, CLI, and fx output as untrusted input at the Rust
   boundary.

The adapter must not use a wildcard permission such as
`retainpdf-agent *`. The model supplies a command string, so the host must
reject shell separators, substitutions, redirections, unknown flags, absolute
paths, parent traversal, and identifiers outside the contract before approving
the call. The current closed page program is transported from fx as size-bounded
inline JSON or base64url, then parsed, canonicalized and hashed again by the
host. The host writes the resulting backend-owned payload to a fixed no-follow
request file for the real CLI; there is no model-chosen path or general
request-file channel.

There are two different classes of local CLI:

- fx may call the small control CLI above to create, inspect, run, and commit a
  durable operation;
- PDF transformation CLIs such as Python, Typst, Ghostscript, or future native
  utilities run only inside the separately confined Executor.

Local availability does not make the second class safe to run directly in the
fx host process. Keeping it behind the Executor preserves resource limits,
network denial, output validation, cancellation, and crash reconciliation.

fx permissions and the document-program sandbox solve different problems. The
former controls whether an agent tool call is admitted. The latter must contain
untrusted transformation code, filesystem access, network access, descendants,
resources, and output validation. The existing Rust `DocumentOperationExecutor`
boundary remains responsible for that second problem.

## Durable state and recovery

Rust remains authoritative for conversations and document operations. Persist
only the opaque `runtime_id` / `session_cursor` mapping and its CAS `revision`
alongside the RetainPDF conversation; never infer document state from an fx
transcript.

Recovery rules:

- Browser or SSE disconnect: the host worker and any accepted operation keep
  running, but AI answer deltas are not replayed and the client cannot reattach
  to the same turn stream. Recover conversation and operation state through
  the Rust APIs.
- AI Gateway disconnect before a CLI effect: retry or rebuild the fx turn from
  the canonical conversation snapshot.
- Disconnect after a CLI effect: replay only the identical host-broker action
  whose deterministic idempotency key is unchanged, then query the returned
  operation ID; do not ask the model to invent a replacement effect.
- fx process crash: restart the adapter and load the fx session when available;
  otherwise create a new fx session from a bounded RetainPDF conversation
  snapshot.
- API or executor crash: reconcile through the durable dispatch intent,
  receipt, and operation event log. fx does not participate in this decision.
- Candidate ready while chat is offline: preserve `result_ready`; use the
  configured confirmation policy and normal CAS commit path after reconnection.

This separation means losing an fx session can reduce conversational quality,
but it cannot lose, duplicate, or silently commit a document operation.

## Platform and maturity gate

fx currently describes itself as experimental. Its native binary and packaged
Node addons currently target macOS and Linux, not Windows. Its WebAssembly
fallback requires JSPI and omits subagents, skills, OS sandboxing, native
processes, and web search. Removing MCP simplifies our integration but does not
remove this platform gap.

Therefore fx is selected only by the explicit `RETAIN_AI_RUNTIME=fx` backend
configuration and an exact ACP version check. The first adapter is a
macOS/Linux development spike, not a required desktop runtime. Windows may use
the Python or OpenAI-compatible runtime, but the native FX runtime fails closed
there. Enabling fx is explicit: a missing binary, missing Gateway key, or
version mismatch fails closed and never weakens document execution isolation.

fx 0.0.5 admits endpoint overrides only for explicit loopback HTTP URLs with a
port. The backend maps `RETAIN_AI_FX_GATEWAY_BASE_URL` to both
`FX_GATEWAY_BASE_URL` and `<base>/v3/ai/language-model` via
`FX_GATEWAY_CHAT_URL`; setting only the former does not move model completion
traffic. Empty preserves the public Vercel Gateway. Remote HTTPS, LAN hosts,
embedded credentials, queries, and fragments fail before fx starts because fx
would otherwise ignore them and silently use its public default.

For a custom bridge, runtime capability probing and `/readyz` also require its
loopback TCP port to accept connections. This is deliberately not a model turn:
it sends no Gateway key, creates no billable request, and does not claim that a
provider/model is healthy. The real live test remains responsible for proving
that fx posts model traffic to `<base>/v3/ai/language-model`.

With an installed fx `0.0.5`, the transport proof is:

```bash
uv run --project backend python -m pytest \
  backend/ai/tests/test_fx_gateway_live.py -q
```

It uses a dummy key and loopback capture server, records only whether an
authorization header was present, and skips when the exact binary is absent.

## Current P0 adapter

`retainpdf_ai.runtimes.fx.FxAcpRuntime`（并由 `retainpdf_ai.runtime` 兼容导出）
为每个 active turn 启动一个私有 `fx acp` 进程。该进程只在 stdout 传输有界
ACP JSON-RPC，丢弃原始 stderr，使用私有 workspace 与 HOME，不配置 MCP server，
固定 ACP protocol 1 和 fx `0.0.5`，并在每次 prompt 前通过
`session/set_config_option` 明确切换到 `ask` 模式。

Turns for the same conversation are single-flight in-process and across host
processes through a private POSIX file lock. Different conversations run with
bounded parallelism (`RETAIN_AI_FX_MAX_CONCURRENT_TURNS`, default `4`).
`RETAIN_AI_FX_STATE_ROOT` defaults to `<repo>/data/agent-runtime/fx`; it does not
automatically follow a custom `RETAIN_AI_DATA_ROOT`, so deployments that need
both roots co-located must configure it explicitly.

Rust stores the opaque `conversation -> fx sessionId` mapping through
`/api/v1/internal/agent/runtime-sessions/:conversation_id`. Updates use
revision CAS. If the cursor is missing, or fx lost its local session, the
adapter creates a new session and supplies a bounded snapshot of the canonical
RetainPDF conversation as untrusted recovery context.

The adapter rejects every ACP permission request except an exact command in the
backend-owned grammar above. `agent_command_broker.py` owns lifecycle and real
CLI execution; `agent_broker_commands.py` owns the grammar; contracts, safe
event projection and Unix-socket framing live in the other `agent_broker_*`
modules. For an admitted request it exposes a generated,
one-turn wrapper over a private Unix socket. The host reparses the argv, consumes
the approval once, injects document/message scope and idempotency keys, mints a
single-action 60-second capability, and runs the real CLI in a separate process.
Neither fx nor the wrapper receives the Rust capability or service API key, and
capability-shaped output is redacted before it returns to fx.

The current user message is persisted to the canonical Rust conversation before
fx starts, so operation creation can bind a durable `request_message_id` even if
the browser disconnects during the turn. In `explicit` mode, `run`, `commit`
and retry are rejected unless the inbound request independently carries user
confirmation; an ambiguous retry additionally requires the exact duplicate-risk
flag. `green_light` supplies the host grant without changing the command grammar.
`ask` mode remains only a permission policy—not an OS sandbox. The first executable
program is instead a closed `retainpdf_page_program_v1` JSON grammar interpreted
by a fixed backend worker; arbitrary generated code still requires a separately
confined Executor.

## Implementation status and remaining gates

1. **Partial:** the adapter requires fx `0.0.5`; packaged releases must also
   pin the platform artifact digest instead of following latest.
2. **Implemented:** `AgentRuntime` wraps the existing Python agent and the fx
   ACP adapter.
3. **Implemented for P0:** one `fx acp` process is leased to one active turn;
   same-conversation turns are serialized, cross-conversation concurrency is
   bounded, stdout is reserved for bounded ACP JSON-RPC, and the process is
   always reaped. A process pool is intentionally deferred.
4. **Implemented:** bundle `retainpdf-agent` as a strict loopback HTTP client
   backed only by the Rust document-operation service. The CLI prefers a
   1..300-second Rust-signed capability scoped to conversation, document, and
   explicit actions; the full API key remains trusted-bootstrap-only.
5. **Implemented:** store the conversation-to-fx-session cursor in Rust with
   revision CAS and rebuild after cursor/local-session loss.
6. **Implemented:** host-owned, single-use command broker with exact argv
   grammar, request-scope injection, least-privilege capability minting, and
   explicit run/commit/retry confirmation or configured green-light grant.
   Browser disconnect does not propagate
   cooperative cancellation into an active synchronous ACP/LLM turn; operation
   worker cancellation is a separate implemented control-plane capability.
7. **Implemented for restricted page programs:** fixed worker execution,
   resource limits, durable terminal results, Rust validation, candidate
   publication, restart recovery, and explicit commit. Arbitrary code remains
   disabled.
8. **Pending:** pin packaged platform artifact digests, add true client-to-turn
   cancellation, and evaluate the adapter before making fx a required runtime
   or removing the Python reading runtime.
