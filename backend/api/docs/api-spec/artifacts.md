# Reader Regions and Published Artifacts

[API spec index](../../API_SPEC.md)

## Reader Regions

`GET /api/v1/jobs/{job_id}/reader/regions`

Reader-only endpoint for source/translated hover alignment. The backend projects
stable item regions from normalized OCR blocks and translation page payloads, so
frontend readers do not need to parse internal artifacts directly.

Response:

```json
{
  "ok": true,
  "data": {
    "items": [
      {
        "item_id": "p008-b009",
        "source": {
          "page": 8,
          "bbox": [72.1, 132.4, 310.8, 186.2],
          "unit": "pdf_point",
          "origin": "top_left"
        },
        "translated": {
          "page": 8,
          "bbox": [74.0, 130.0, 330.0, 190.0],
          "unit": "pdf_point",
          "origin": "top_left"
        }
      }
    ]
  }
}
```

Notes:

- `page` is 1-based.
- `bbox` is `[x0, y0, x1, y1]` in PDF points with a top-left origin.
- `source.bbox` is read from normalized OCR `document.v1.json` when a matching
  block exists.
- `translated.bbox` currently uses the translated page item bbox. Future render
  diagnostics may replace it with the final rendered Typst block bbox while
  keeping this response shape stable.

## Artifact JSON

`GET /api/v1/jobs/{job_id}/artifacts`

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
    "pdf_url": "/api/v1/jobs/20260327190500-ef3456/pdf",
    "markdown_url": "/api/v1/jobs/20260327190500-ef3456/markdown",
    "markdown_images_base_url": "/api/v1/jobs/20260327190500-ef3456/markdown/images/",
    "bundle_url": "/api/v1/jobs/20260327190500-ef3456/download",
    "actions": {
      "open_job": {"enabled": true, "method": "GET", "path": "/api/v1/jobs/20260327190500-ef3456", "url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456"},
      "open_artifacts": {"enabled": true, "method": "GET", "path": "/api/v1/jobs/20260327190500-ef3456/artifacts", "url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456/artifacts"},
      "cancel": {"enabled": false, "method": "POST", "path": "/api/v1/jobs/20260327190500-ef3456/cancel", "url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456/cancel"},
      "download_pdf": {"enabled": true, "method": "GET", "path": "/api/v1/jobs/20260327190500-ef3456/pdf", "url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456/pdf"},
      "open_markdown": {"enabled": true, "method": "GET", "path": "/api/v1/jobs/20260327190500-ef3456/markdown", "url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456/markdown"},
      "open_markdown_raw": {"enabled": true, "method": "GET", "path": "/api/v1/jobs/20260327190500-ef3456/markdown?raw=true", "url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456/markdown?raw=true"},
      "download_bundle": {"enabled": true, "method": "GET", "path": "/api/v1/jobs/20260327190500-ef3456/download", "url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456/download"}
    },
    "pdf": {
      "ready": true,
      "path": "/api/v1/jobs/20260327190500-ef3456/pdf",
      "url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456/pdf",
      "method": "GET",
      "content_type": "application/pdf",
      "file_name": "paper-translated.pdf",
      "size_bytes": 1048576
    },
    "markdown": {
      "ready": true,
      "json_path": "/api/v1/jobs/20260327190500-ef3456/markdown",
      "json_url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456/markdown",
      "raw_path": "/api/v1/jobs/20260327190500-ef3456/markdown?raw=true",
      "raw_url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456/markdown?raw=true",
      "images_base_path": "/api/v1/jobs/20260327190500-ef3456/markdown/images/",
      "images_base_url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456/markdown/images/",
      "file_name": "full.md",
      "size_bytes": 18234
    },
    "bundle": {
      "ready": true,
      "path": "/api/v1/jobs/20260327190500-ef3456/download",
      "url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456/download",
      "method": "GET",
      "content_type": "application/zip",
      "file_name": "20260327190500-ef3456.zip",
      "size_bytes": null
    }
  }
}
```

## Final PDF

`GET /api/v1/jobs/{job_id}/pdf`

Response:

- raw `application/pdf`

## Side-by-side PDF

`GET /api/v1/jobs/{job_id}/pdf/side-by-side`

Response:

- raw `application/pdf`
- `Content-Disposition` filename: `{job_id}-side-by-side.pdf`

Behavior:

- reads the job source PDF and final translated PDF from backend artifacts
- generates and caches `jobs/{job_id}/artifacts/{job_id}-side-by-side.pdf`
- each output page places the original page on the left and the translated page on the right
- output page count is `max(source_page_count, translated_page_count)`; a missing side is left blank
- returns `404` if either source PDF or translated PDF is not ready

## Cover and Thumbnail

`GET /api/v1/jobs/{job_id}/cover`

`GET /api/v1/jobs/{job_id}/thumbnail`

Behavior:

- returns raw image bytes when a cached or discoverable image exists
- returns the same authorization behavior as other job artifact endpoints
- returns `cover not ready` or `thumbnail not ready` when no published image is available
- current selection policy is conservative: first supported image under published markdown images
  is cached as both cover and thumbnail unless a later pipeline stage publishes more specific paths

## Markdown

`GET /api/v1/jobs/{job_id}/markdown`

Default response:

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "job_id": "20260327190500-ef3456",
    "content": "# title",
    "raw_path": "/api/v1/jobs/20260327190500-ef3456/markdown?raw=true",
    "raw_url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456/markdown?raw=true",
    "images_base_path": "/api/v1/jobs/20260327190500-ef3456/markdown/images/",
    "images_base_url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456/markdown/images/"
  }
}
```

`GET /api/v1/jobs/{job_id}/markdown?raw=1`

Response:

- raw `text/markdown; charset=utf-8`

`GET /api/v1/jobs/{job_id}/markdown/document`

Structured response for readers, document preview, and AI Q&A surfaces. It returns
the published Markdown, a Markdown variant whose local `images/...` links are
rewritten to absolute API URLs, and a direct image manifest.

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "job_id": "20260327190500-ef3456",
    "ready": true,
    "content": "# title\n\n![Image](images/page-1/imgs/chart.png)\n",
    "content_with_absolute_image_urls": "# title\n\n![Image](http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456/markdown/images/page-1/imgs/chart.png)\n",
    "markdown_path": "/api/v1/jobs/20260327190500-ef3456/markdown/document",
    "markdown_url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456/markdown/document",
    "raw_path": "/api/v1/jobs/20260327190500-ef3456/markdown?raw=true",
    "raw_url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456/markdown?raw=true",
    "images_base_path": "/api/v1/jobs/20260327190500-ef3456/markdown/images/",
    "images_base_url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456/markdown/images/",
    "images": [
      {
        "path": "images/page-1/imgs/chart.png",
        "url": "http://127.0.0.1:41000/api/v1/jobs/20260327190500-ef3456/markdown/images/page-1/imgs/chart.png",
        "content_type": "image/png",
        "size_bytes": 12345
      }
    ]
  }
}
```

## Markdown Images

`GET /api/v1/jobs/{job_id}/markdown/images/{path}`

Response:

- raw image file stream

## Download Bundle

`GET /api/v1/jobs/{job_id}/download`

Bundle contents:

- final translated PDF
- `markdown/full.md` if present
- `markdown/images/**` if present

Response:

- raw `application/zip`
