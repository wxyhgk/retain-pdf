# RetainPDF backend contracts

This directory is the backend-local mirror of the JSON contracts consumed by
the Rust API, `retain-jobsd`, the Python AI service, and the Python pipeline.
Backend code and tests must resolve contracts from `<backend-root>/contracts`
where the current backend root is `backend/`, so an extracted backend package
remains testable without the parent monorepo.

The mirrored files are:

- `ai-ask.v1.schema.json`
- `agent-calculation.v1.schema.json`
- `ai-conversations.v1.schema.json`
- `create-job.v1.schema.json`
- `job-events.v2.schema.json`
- `job-status.v1.schema.json`
- `jobs-control.v1.schema.json`
- `library-books.v1.schema.json`
- `pipeline-stdout.v1.schema.json`
- `public-document-operation.v1.schema.json`
- `runtime-config.v1.schema.json`

In the monorepo, `contracts` remains the upstream schema package used by
frontend consumers. Every mirrored JSON file must remain byte-for-byte equal to
its upstream counterpart. Run:

```bash
python3 backend/contracts/check_parity.py --require-upstream
```

In an extracted backend repository, the upstream directory is intentionally
absent. From the extracted `backend/` root, run:

```bash
python3 contracts/check_parity.py
```

This validates that all ten local contract files exist and contain valid
JSON, then explicitly skips upstream parity. In the monorepo, schema changes
start in `contracts`, are copied byte-for-byte here, and must pass the
`--require-upstream` gate.
