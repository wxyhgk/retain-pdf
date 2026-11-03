# Reader Regions and Published Artifacts

[API spec index](../../API_SPEC.md) · [Reader read model](reader-read-model.md)

> Address note: `/jobs/{job_id}/…` is grouped into eight categories (`actions`, `progress`, `files`, `reports`, `reader`, `translations`, `data`; `ai` was removed on 2026-11-03). The old addresses were removed on 2026-10-18 and now return 404; use the new ones (`GET /jobs/{job_id}/files`, `/files/output/{name}`, `/files/pages/{page}`, `/reader/markdown`; a book's cover and thumbnail live under `GET /documents/{document_id}/files/…`). Old-to-new table: [`docs/api/01-任务/04-任务接口分类.md`](../../../../docs/api/01-任务/04-任务接口分类.md); every endpoint: [`docs/api/00-接口目录.md`](../../../../docs/api/00-接口目录.md).

## Reader Regions

`GET /api/v1/jobs/{job_id}/reader/regions` projects stable source/translated
hover and selection regions. The full endpoint contract, coordinate convention,
canonical item identity, source-only behavior, and consumer rules are owned by
[Reader read model](reader-read-model.md#identity-and-coordinates).

In short, every item contains a canonical `item_id`, source and translated
one-based page boxes in top-left PDF points, optional source/translated text and
Markdown, `region_type`, `status`, and zero-or-more published asset IDs/URLs.
The backend provides this projection so Reader clients do not parse normalized
OCR or translation artifacts directly.

`GET /api/v1/jobs/{job_id}/reader/metadata` returns independently nullable
source and translated PDF page dimensions. It is also part of the Reader read
model and is an optional overlay rather than an authority for PDF availability.

## Job and Document Files

All downloads have two address families (2026-10-15):

- `GET /api/v1/jobs/{job_id}/files` plus `/files/output/{name}`, `/files/pages/{page}.jpg`
  and `/files/internal/{name}` (internal is admin-only in multi-user mode);
- `GET /api/v1/documents/{document_id}/files` plus `/files/{name}` and
  `/files/pages/{page}.jpg` for the book's own files (source PDF, cover, thumbnail,
  source page previews).

File names, groups, query parameters and the old-to-new address table are in
[下载总览](../../../../docs/api/07-产物下载/01-下载总览.md). Every download resolves through `JobDownloads::open` (job files) or
`library::open_document_file` (book files); the response contract is pinned in
`backend/api/docs/file-responses.txt`. The old `/artifacts` and `/artifacts-manifest`
endpoints were removed on 2026-10-18; the links the API returns for them
(`manifest_path` / `manifest_url`, `links.artifacts_*`, `links.artifacts_manifest_*`,
`actions.open_artifacts`) point at `GET /api/v1/jobs/{job_id}/files`, whose
response (`JobFilesView`, see `contracts/reader-data.v1.schema.json`) has a different shape
from the removed manifest. `source.url` is
`/api/v1/documents/{document_id}/files/source.pdf` when the document id is known;
when the job has no document id, `source.url` is `""` and `ready` is `false`, and the
job's `cover_url` / `thumbnail_url` are `null`.

### Not ready yet (2026-10-19)

- Job does not exist: plain `404`, `error.details` is `{}` (`job not found: …`).
- Unknown file name: plain `404` (`no such file: …`).
- Job exists but the file has not been produced yet: `404` with
  `error.details.reason = "not_ready"` and the message `<name> not ready`, where `<name>`
  is the missing file (`translated.pdf`, `source.pdf`, `ocr.md`, `ocr.zip`, `ocr/images`,
  `all.zip`, `translated.docx`, or the `internal/` file name). `all.zip` for a job that
  has not succeeded used to be `409 job is not finished successfully`; it is now this `404`.
- Clients tell "job is gone" from "not ready yet" by `error.details.reason` only. The
  rule is in [错误约定](../../../../docs/api/00-约定/02-认证与错误.md#还没产出404).
- A book whose source PDF is missing on disk stays a plain `404` without `not_ready`:
  the source is uploaded with the book and never appears later.

## Reader Artifact Links

The `artifacts` field of `GET /api/v1/jobs/{job_id}` carries these links. The standalone `GET /api/v1/jobs/{job_id}/artifacts` that used to return the same object was removed on 2026-10-18; use `GET /api/v1/jobs/{job_id}/files` for the file list.

Purpose:

- frontend consumes structured URLs only
- no local absolute path leakage
- render configuration snapshots are exposed as artifact key `render_config_json`

Response:

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "pdf_ready": true,
    "markdown_ready": true,
    "bundle_ready": true,
    "pdf_url": "/api/v1/jobs/20260327190500-ef3456/files/output/translated.pdf",
    "markdown_url": "/api/v1/jobs/20260327190500-ef3456/reader/markdown",
    "markdown_images_base_url": "/api/v1/jobs/20260327190500-ef3456/files/output/ocr/images/",
    "bundle_url": "/api/v1/jobs/20260327190500-ef3456/files/output/all.zip?download=1",
    "actions": {
      "open_job": {"enabled": true, "method": "GET", "path": "/api/v1/jobs/20260327190500-ef3456", "url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456"},
      "open_artifacts": {"enabled": true, "method": "GET", "path": "/api/v1/jobs/20260327190500-ef3456/files", "url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456/files"},
      "cancel": {"enabled": false, "method": "POST", "path": "/api/v1/jobs/20260327190500-ef3456/actions/cancel", "url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456/actions/cancel"},
      "download_pdf": {"enabled": true, "method": "GET", "path": "/api/v1/jobs/20260327190500-ef3456/files/output/translated.pdf", "url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456/files/output/translated.pdf"},
      "open_markdown": {"enabled": true, "method": "GET", "path": "/api/v1/jobs/20260327190500-ef3456/reader/markdown", "url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456/reader/markdown"},
      "open_markdown_raw": {"enabled": true, "method": "GET", "path": "/api/v1/jobs/20260327190500-ef3456/files/output/ocr.md", "url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456/files/output/ocr.md"},
      "download_bundle": {"enabled": true, "method": "GET", "path": "/api/v1/jobs/20260327190500-ef3456/files/output/all.zip?download=1", "url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456/files/output/all.zip?download=1"}
    },
    "pdf": {
      "ready": true,
      "path": "/api/v1/jobs/20260327190500-ef3456/files/output/translated.pdf",
      "url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456/files/output/translated.pdf",
      "method": "GET",
      "content_type": "application/pdf",
      "file_name": "paper-translated.pdf",
      "size_bytes": 1048576
    },
    "markdown": {
      "ready": true,
      "json_path": "/api/v1/jobs/20260327190500-ef3456/reader/markdown",
      "json_url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456/reader/markdown",
      "raw_path": "/api/v1/jobs/20260327190500-ef3456/files/output/ocr.md",
      "raw_url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456/files/output/ocr.md",
      "images_base_path": "/api/v1/jobs/20260327190500-ef3456/files/output/ocr/images/",
      "images_base_url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456/files/output/ocr/images/",
      "file_name": "full.md",
      "size_bytes": 18234
    },
    "bundle": {
      "ready": true,
      "path": "/api/v1/jobs/20260327190500-ef3456/files/output/all.zip?download=1",
      "url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456/files/output/all.zip?download=1",
      "method": "GET",
      "content_type": "application/zip",
      "file_name": "20260327190500-ef3456.zip",
      "size_bytes": null
    }
  }
}
```

## Final PDF

`GET /api/v1/jobs/{job_id}/files/output/translated.pdf` (removed: `/pdf`)

Response:

- raw `application/pdf`

## Side-by-side PDF

`GET /api/v1/jobs/{job_id}/files/output/side-by-side.pdf` (removed: `/pdf/side-by-side`)

Response:

- raw `application/pdf`
- `Content-Disposition` filename: `{job_id}-side-by-side.pdf`

Behavior:

- reads the job source PDF and final translated PDF from backend artifacts
- generates and caches `jobs/{job_id}/artifacts/{job_id}-side-by-side.pdf`
- each output page places the original page on the left and the translated page on the right
- output page count is `max(source_page_count, translated_page_count)`; a missing side is left blank
- returns `404` + `reason: "not_ready"` (`source.pdf not ready` / `translated.pdf not ready`)
  if either source PDF or translated PDF is not ready

## Cover and Thumbnail

`GET /api/v1/documents/{document_id}/files/cover.jpg`

`GET /api/v1/documents/{document_id}/files/thumbnail.jpg`

The job-level `/jobs/{job_id}/cover` and `/thumbnail` were removed on 2026-10-18. A job's
`cover_url` / `thumbnail_url` already point at the book's address; they are `null`
when the job has no document id.

Behavior:

- returns raw image bytes (generated from the first page on first request, then cached)
- returns the same authorization behavior as other document file endpoints
- see [下载总览](../../../../docs/api/07-产物下载/01-下载总览.md) for sizes and cache headers

## Markdown

The JSON Markdown view is `GET /api/v1/jobs/{job_id}/reader/markdown` (see
[Structured Markdown](#structured-markdown) below); the raw file is
`GET /api/v1/jobs/{job_id}/files/output/ocr.md`. The old `GET /jobs/{job_id}/markdown`
(JSON by default, `?raw=1` for the file) was removed on 2026-10-18.

`GET /api/v1/jobs/{job_id}/files/output/ocr.md`

Response:

- raw `text/markdown; charset=utf-8`
- streamed from the file, not buffered into memory
- `Accept-Ranges: bytes`, and `Range: bytes=<start>-<end>` returns `206` with
  `Content-Range: bytes <start>-<end>/<total>`
- `ETag` derived from size and mtime

### Reading long Markdown in parts

This is the paging path for readers: request the first window, render it, and
fetch the next window when the viewport reaches the end. There is no separate
cursor endpoint — plain HTTP `Range` covers it, and `Content-Range` already
reports the total size, so nothing has to be looked up first.

Two things the client owns, because byte offsets do not respect text structure:

- **Character boundaries.** A window can end in the middle of a multi-byte
  UTF-8 sequence. Decode with `TextDecoder(..., { stream: true })`, which
  carries the partial sequence into the next chunk. Do not decode each window
  independently.
- **Line boundaries.** A window can end mid-line, which would split a fenced
  code block, a table row, or a formula. Hold back the text after the last
  newline and prepend it to the next window before rendering.

Compare `ETag` across windows. The published Markdown is written once by the
pipeline and no current path rewrites it in place, so offsets are stable in
practice — but that is a property of today's job lifecycle, not a guarantee
this endpoint makes. If the `ETag` changes mid-read, the offsets belong to a
different revision and the fetch should restart at zero; otherwise the pieces
silently splice two versions together. `If-Range` works here too.

### Structured Markdown

`GET /api/v1/jobs/{job_id}/reader/markdown` (removed: `/markdown/document`)

Structured response for readers, document preview, and AI Q&A surfaces. It returns
the published Markdown, a Markdown variant whose local `images/...` links are
rewritten to absolute API URLs, and a direct image manifest.

While the job has no published Markdown yet it returns `404` + `error.details.reason = "not_ready"`
(`markdown not ready`); a job that does not exist is a plain `404` without `reason`.

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "job_id": "20260327190500-ef3456",
    "ready": true,
    "content": "# title\n\n![Image](images/page-1/imgs/chart.png)\n",
    "content_with_absolute_image_urls": "# title\n\n![Image](http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456/files/output/ocr/images/page-1/imgs/chart.png)\n",
    "markdown_path": "/api/v1/jobs/20260327190500-ef3456/reader/markdown",
    "markdown_url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456/reader/markdown",
    "raw_path": "/api/v1/jobs/20260327190500-ef3456/files/output/ocr.md",
    "raw_url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456/files/output/ocr.md",
    "images_base_path": "/api/v1/jobs/20260327190500-ef3456/files/output/ocr/images/",
    "images_base_url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456/files/output/ocr/images/",
    "images": [
      {
        "path": "images/page-1/imgs/chart.png",
        "url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456/files/output/ocr/images/page-1/imgs/chart.png",
        "content_type": "image/png",
        "size_bytes": 12345
      }
    ]
  }
}
```

## Markdown Images

`GET /api/v1/jobs/{job_id}/files/output/ocr/images/{path}` (removed: `/markdown/images/{path}`)

Response:

- raw image file stream
- `404` + `reason: "not_ready"` (`ocr/images not ready`) while the job has no Markdown
  image directory yet; a missing image inside an existing directory is a plain `404`

## Download Bundle

`GET /api/v1/jobs/{job_id}/files/output/all.zip` (removed: `/download`)

Bundle contents:

- final translated PDF
- `markdown/full.md` if present
- `markdown/images/**` if present

Response:

- raw `application/zip`
- only for succeeded jobs; otherwise `404` + `reason: "not_ready"` (`all.zip not ready`).
  Before 2026-10-19 this was `409 job is not finished successfully`.
