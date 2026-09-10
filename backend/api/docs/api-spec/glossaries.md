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
- `POST /api/v1/glossaries/import`
- `GET /api/v1/glossaries/{glossary_id}/export.csv`

`GET /api/v1/glossaries` supports optional filters:

- `enabled=true|false`
- `source_lang=en`
- `target_lang=zh-CN`
- `q=physics`

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

CSV parse helper response returns normalized `entries` and `entry_count`. It accepts plain CSV text only; Excel files should be converted by the frontend first.

CSV export:

- `GET /api/v1/glossaries/{glossary_id}/export.csv`
- Returns `Content-Type: text/csv; charset=utf-8`
- Columns: `source,target,note,level,match_mode,context`

Recommended import flow:

1. Frontend reads a user CSV file as text.
2. Frontend calls `POST /api/v1/glossaries/parse-csv`.
3. Frontend shows normalized rows for review.
4. Frontend saves with `POST /api/v1/glossaries` or `PUT /api/v1/glossaries/{glossary_id}`.

JSON import:

- `POST /api/v1/glossaries/import`
- Body shape is the same as create / update request body.
- If `glossary_id` is empty or omitted, the backend creates a new glossary.
- If `glossary_id` is provided, the backend updates that existing glossary.
