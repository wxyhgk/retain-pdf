# RetainPDF backend contracts

This directory is the backend-local mirror of the JSON contracts consumed by
the Rust API, `retain-jobsd`, and the Python pipeline.（Python AI 服务 2026-11-03 删了。）
Backend code and tests must resolve contracts from `<backend-root>/contracts`
where the current backend root is `backend/`, so an extracted backend package
remains testable without the parent monorepo.

The mirrored files are:

- `create-job.v1.schema.json`
- `glossaries.v1.schema.json`
- `job-actions.v1.schema.json`
- `job-data.v1.schema.json`
- `job-events.v2.schema.json`
- `job-reports.v1.schema.json`
- `job-status.v1.schema.json`
- `jobs-control.v1.schema.json`
- `library-books.v1.schema.json`
- `library-documents.v1.schema.json`
- `ocr-providers.v1.schema.json`
- `pipeline-stdout.v1.schema.json`
- `reader-data.v1.schema.json`
- `refine-report.v1.schema.json`
- `token-usage.v1.schema.json`
- `translation-revisions.v1.schema.json`

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

This validates that all twenty local contract files exist and contain valid
JSON, then explicitly skips upstream parity. In the monorepo, schema changes
start in `contracts`, are copied byte-for-byte here, and must pass the
`--require-upstream` gate.
