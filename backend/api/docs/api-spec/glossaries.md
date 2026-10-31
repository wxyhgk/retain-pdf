# Glossary Resources

[API spec index](../../API_SPEC.md)

## Glossary Resources API

Named glossary endpoints:

- `POST /api/v1/glossaries`
- `GET /api/v1/glossaries`
- `GET /api/v1/glossaries/{glossary_id}`
- `PUT /api/v1/glossaries/{glossary_id}`
- `DELETE /api/v1/glossaries/{glossary_id}`
- `POST /api/v1/glossaries/parse-csv`
- `GET /api/v1/glossaries/{glossary_id}/export.csv`

`POST /api/v1/glossaries/import` was removed on 2026-10-22 (it took JSON, duplicated POST / PUT and had no caller).

`GET /api/v1/glossaries` is not paginated. Optional filters (unknown parameters are 400):

- `enabled=true|false` (the job-creation dropdown uses `enabled=true`)
- `source_lang=en`
- `target_lang=zh-CN`
- `q=physics` (name / description / id, case-insensitive; an empty `q` does not filter)

Create / update request body:

```json
{
  "name": "semiconductor",
  "entries": [
    {"source": "band gap", "target": "带隙", "note": "materials"},
    {"source": "density of states", "target": "态密度", "note": ""}
  ]
}
```

- `name` and `entries` are required (missing fields are 422); `entries` is replaced as a whole.
- `description`, `source_lang`, `target_lang`, `enabled` are optional. When omitted (or `null`), POST uses the
  defaults (`""`, `true`) and **PUT keeps the stored value** (since 2026-10-22; before, PUT cleared them and reset
  `enabled` to `true`).
- Optional `expected_updated_at` (PUT only): the save only happens while the stored `updated_at` still equals it,
  otherwise 409 with `error.details.reason = "glossary_changed"`. Without it, last write wins.
- PUT only updates an existing glossary: a missing one (also one deleted after it was read) is 404 and is not recreated.
- `updated_at` has millisecond precision (since 2026-10-22) and strictly increases on every save.
- Entries: unknown `level` / `match_mode` values and regex sources that do not compile are 400 with the entry's
  source in the message (CSV parsing stays lenient). Limits: 1000 entries (including the merged job snapshot), source / target 200 chars, note and
  context 500 chars.
- Deduplication and the inline-overrides-glossary merge use one key: (source, context). Sources compare
  lowercased for `case_insensitive` and case-sensitively for `exact` / `regex`; context compares case-insensitively.
  The later entry wins.
- A job referencing a missing or disabled glossary (`translation.glossary_id`) is 400.

List item / detail fields:

- `glossary_id`
- `name`
- `description`
- `source_lang`
- `target_lang`
- `enabled`
- `entry_count`
- `entries`
- `created_at`
- `updated_at`

CSV parse helper request:

```json
{
  "csv_text": "source,target,note\nband gap,带隙,materials\n"
}
```

CSV parse helper response returns normalized `entries`, `entry_count` and `duplicate_count` (rows dropped by
deduplication; added 2026-10-22). It accepts plain text only and detects comma, tab or semicolon separators using
quoted-field parsing, recognized headers and consistent column counts. Without a header row the columns are `source,target,note`. Errors carry the line
number (`row 3: ...`). Rows where source, target, note and context are all empty are skipped. A cell made of `'`
followed by `=`, `+`, `-`, `@`, tab or CR loses that `'` (added by the export).

CSV export:

- `GET /api/v1/glossaries/{glossary_id}/export.csv`
- Returns `Content-Type: text/csv; charset=utf-8`, starting with a UTF-8 BOM, and
  `Content-Disposition: attachment; filename="..."; filename*=UTF-8''<name>.csv`
- Columns: `source,target,note,level,match_mode,context`
- Cells starting with `=`, `+`, `-`, `@`, tab or CR get a leading `'` (formula injection guard); `parse-csv` strips it,
  so export → parse round-trips.

Recommended import flow:

1. The user selects/drops a CSV, TSV, TXT or XLSX file (up to 2 MiB), or pastes CSV / TSV text into the import box.
   Files are decoded locally: automatic UTF-8 / GB18030 and BOM-marked UTF-16, with a manual encoding selector.
2. XLSX sheets are read locally; the user selects a sheet, header setting and column mapping. Text separators can
   be selected manually. The preview shows five rows, total and duplicate counts, and validation errors.
   The frontend converts mapped columns to CSV and calls `POST /api/v1/glossaries/parse-csv`.
3. Frontend appends/merges normalized rows into the draft by default (same source/context key as the server,
   imported entries win), or replaces the draft entries when explicitly selected. Duplicate counts are shown.
   Empty results, parse errors and merged results over 1000 entries leave the draft intact.
4. Frontend saves with `POST /api/v1/glossaries` or `PUT /api/v1/glossaries/{glossary_id}`.
   Pending import text must be applied or cleared first. Importing alone does not persist the glossary.

The manager includes library/entry search, a CSV template download, and unsaved-change confirmation before
switching libraries, creating another glossary or closing the dialog. Filtering entries does not change their
edit/delete indexes or remove hidden entries from the saved payload. Context is editable. Selected entries can
be deleted together after confirmation; this includes selected entries hidden by a filter and only persists on save.
Context restricts source-text matches; taxonomy-only columns should be mapped to notes or ignored.

Jobs and reruns: a job stores a snapshot (merged `translation.glossary_entries`) plus the user's inline entries
(`translation.glossary_inline_entries`). Rerun / stage retry that create a new job re-resolve against the current
glossary with the original inline entries; if the source job's glossary was deleted the rerun is 409
`glossary_missing` (`glossary_disabled` if it was disabled). See `docs/api/04-翻译/03-术语表.md`.
