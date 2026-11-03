# Credential References

[API spec index](../../API_SPEC.md)

## Credential Reference Contract

The backend-owned credential vault is exposed through authenticated endpoints:

- `GET|POST /api/v1/credentials`
- `GET|PUT|DELETE /api/v1/credentials/:credential_ref`

Create/update accepts a secret once and returns only metadata plus an opaque
`credential_ref`. No credential response ever returns the secret or a reversible
masked value; the metadata view has no `secret` member at all. `GET
/api/v1/credentials` accepts no query parameters: the former
`include_values=true` switch, which returned every stored secret, was removed on
2026-10-22 and any query parameter (including `include_values`) is now rejected
with `400 BAD_REQUEST` (``unknown field `include_values`, … in the query
string``). Metadata includes a per-record `revision`. Updates should send
`expected_credential_revision`; this rejects concurrent changes to the same
credential without treating unrelated vault changes as conflicts. The
vault-wide `expected_revision` compare-and-swap remains supported for older
clients and for create/delete flows. Stale writes return `409` with
`CREDENTIAL_REVISION_CONFLICT` or `CREDENTIAL_VAULT_REVISION_CONFLICT`.

A credential's `kind` is fixed at creation. `PUT` may repeat the current kind
(compared after trim and lower-casing, so clients can send their whole payload),
but a different `kind` is rejected with `400 BAD_REQUEST` before any revision
check and leaves the record unchanged: jobs that reference the credential would
otherwise fail later with `CREDENTIAL_KIND_MISMATCH`. Create a new credential
instead. The update order is: unknown reference `404`, kind change `400`, stale
vault revision `409`, stale record revision `409`. `provider`, `label` and
`secret` remain updatable.

All five handlers run their vault file IO, the process and cross-process locks,
`fsync` and the delete-time SQLite reference count on a blocking thread
(`spawn_blocking`), not on the async workers; responses and errors are unchanged.
The vault is atomically persisted below the configured
data root with `0700` directory and `0600` file permissions on POSIX systems.
On POSIX systems, mutations are serialized across backend processes through a
private file lock; publishing fsyncs both the replacement file and its parent
directory before the request is reported as successful. Other platforms retain
the in-process mutation lock and atomic replacement behavior.

`DELETE /api/v1/credentials/:credential_ref` accepts `expected_revision` and
an optional `force` query flag. By default, deletion is rejected while any
persisted job request references the credential, including terminal jobs: retry
and rerun can still need that reference.（以前还查 AI 运行时配置 `secrets/ai-runtime.json` 和 AI 启动环境变量里的引用，
2026-11-03 跟 AI 服务一起删了。）
After explicitly accepting that recovery impact, a caller may repeat the request
with `force=true`. The conflict response never discloses referencing job IDs,
counts, runtime fields, or credential values.
Credential-backed task creation holds a shared lifecycle lock from reference
validation through durable job persistence, while deletion holds the exclusive
lock. This coordination applies within a process on every platform and across
backend processes on POSIX. Therefore a coordinated concurrent delete cannot
slip between those two steps: either the job is persisted first and deletion
returns `CREDENTIAL_IN_USE`, or deletion finishes first and task creation
returns `CREDENTIAL_REF_NOT_FOUND`.

### When credentials imported by job creation are removed

Clients that still send inline secrets (`ocr.mineru_token`, `ocr.paddle_token`,
`translation.api_key`; the web app does this with the keys kept in the browser)
do not leave those secrets in the job: before the job is persisted the backend
imports each one into this vault as a *managed* credential
(`managed_by: legacy_job_import`, not shown in responses) and stores only the
reference. Identical managed secrets of the same kind and provider are reused
rather than duplicated. A managed copy is removed automatically — only when no
persisted job references it any more —
after:

- the job is deleted (`DELETE /api/v1/jobs/{job_id}`);
- the document is deleted (`DELETE /api/v1/documents/{document_id}`), covering
  all of its jobs;
- a rerun discards the old `<job_id>-ocr` child job that referenced it.

A retry override that sends a new inline secret imports that one too. The copy
it superseded is not collected by the retry itself; it can stay behind until it
is removed with `DELETE` (or until every job referencing it is deleted).

Until then the secret stays on the server even if the user deletes the key in
the browser, because retry and resume of that job still need it. Any explicit
`PUT` of a managed credential transfers it to the user (it is then never
garbage-collected). To remove secrets from the machine without deleting jobs,
`GET /api/v1/credentials` lists them and `DELETE
/api/v1/credentials/{credential_ref}` removes one (`force=true` if jobs still
reference it; those jobs then cannot be retried). User-created credentials are
never removed automatically.

Translation jobs and document-scoped translation accept
`translation.credential_ref`. OCR jobs and full workflows accept
`ocr.credential_ref`; OCR references use kind `ocr_provider_token`, and their
stored provider must match `ocr.provider` after trim and case normalization.
The backend validates references at task creation, persists only opaque
references, resolves each secret immediately before launching the worker, and
injects it through the existing provider-specific environment variable. OCR
stage specs contain only `env:...` references and never contain a vault
reference or secret. Runtime stdout/stderr and persisted job state are scrubbed
with the resolved runtime secrets.

`GET /api/v1/providers/ocr` exposes this contract per provider through
`credential.credential_kind`, `credential.reference_field`, and
`credential.legacy_inline_field`. The existing `credential.field`, `env`, and
`required_for` members remain available for older clients. A provider that does
not need a credential returns `credential: null`.

Legacy inline OCR fields remain accepted temporarily. When OCR will actually
run, the backend imports the selected inline secret into the vault as an
`ocr_provider_token`, clears every inline OCR secret field, and persists the
generated reference. When an existing OCR artifact is reused, unused OCR
credentials are discarded instead. Supplying both an active inline OCR secret
and `ocr.credential_ref` is rejected. OCR and translation retry overrides can
explicitly switch between their temporary inline compatibility fields and a
credential reference; the superseded secret source is cleared before the retry
request is persisted.

## Credential Errors

Credential-reference resolution owns these machine-readable codes:

| `error.code` | HTTP status | Meaning |
| --- | ---: | --- |
| `CREDENTIAL_REF_INVALID` | 400 | The opaque reference has an invalid shape. |
| `CREDENTIAL_REF_NOT_FOUND` | 404 | No credential exists for the reference. |
| `CREDENTIAL_KIND_MISMATCH` | 400 | The credential exists but cannot be used for the requested purpose. |
| `CREDENTIAL_PROVIDER_MISMATCH` | 400 | An OCR credential belongs to a different provider than `ocr.provider`. |
| `CREDENTIAL_IN_USE` | 409 | Persisted jobs still reference the credential; deletion requires an explicit `force=true` override. |
| `CREDENTIAL_REVISION_CONFLICT` | 409 | The target credential changed after the client loaded its metadata. |
| `CREDENTIAL_VAULT_REVISION_CONFLICT` | 409 | A legacy vault-wide compare-and-swap revision is stale. |
| `CREDENTIAL_VAULT_UNAVAILABLE` | 500 | The backend cannot safely read or validate the credential vault. |

Since 2026-10-22 the three `409` responses also carry a stable lowercase
`error.details.reason` (only added; `code` and `error.code` are unchanged):

| `error.code` | `error.details.reason` |
| --- | --- |
| `CREDENTIAL_IN_USE` | `credential_in_use` |
| `CREDENTIAL_REVISION_CONFLICT` | `credential_revision_conflict` |
| `CREDENTIAL_VAULT_REVISION_CONFLICT` | `credential_vault_revision_conflict` |

The other credential errors keep `details: {}`.

For example, a missing reference returns the unified error object while
retaining the existing top-level domain code and message:

```json
{
  "code": "CREDENTIAL_REF_NOT_FOUND",
  "message": "credential reference was not found",
  "error": {
    "code": "CREDENTIAL_REF_NOT_FOUND",
    "http_status": 404,
    "details": {}
  }
}
```

Credential mutation validation may still use the generic `BAD_REQUEST` or
`NOT_FOUND` codes. Revision conflicts use the credential-specific codes above.
New clients must read `error.code`; the top-level fields remain available only
for compatibility and currently have no declared removal date. Error bodies
never include the secret, a masked reversible value, vault path, or persisted
credential record.

Credential JSON bodies, typed credential paths, and all query parameters
(list and delete) reject unknown fields with `400` and otherwise use the shared
safe extractor-error contract. Malformed input therefore
returns the unified error object with fixed public messages instead of Axum or
Serde parsing details. Unsupported methods on a matched credential route are
still authenticated before the backend returns `METHOD_NOT_ALLOWED`.

See [Errors, storage, and implementation notes](storage-and-errors.md) for the
shared envelope, extractor mappings, and generic code list.
