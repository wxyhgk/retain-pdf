# MinerU API Reference

This directory holds MinerU external interface reference materials and in-project usage instructions.
Its positioning differs from `paddle_ocr_api/`:

- `paddle_ocr_api/`: RetainPDF's own OCR adapter documentation
- `mineru_api/`: MinerU official interface reference

To modify RetainPDF mainline OCR integration, check [paddle_ocr_api/README.md](../../core/paddle_ocr_api/README.md) and [Rust API docs](../../core/rust_api/README.md) first.

MinerU provides two document parsing APIs for different scenarios:

🎯 Precision Parsing API — Token required; supports single/batch, tables/formulas/multi-format output
⚡ Agent Lightweight Parsing API — No login; IP rate-limited against abuse; designed for AI Agent workflows

Mode Comparison
| Dimension | 🎯 Precision Parsing API | ⚡ Agent Lightweight Parsing API |
|---|---|---|
| Token Required | ✅ Yes | ❌ No (IP rate limit) |
| Endpoint | /api/v4/extract/task or /api/v4/file-urls/batch | /api/v1/agent/parse/url or /api/v1/agent/parse/file |
| Model Version | pipeline (default) / vlm (recommended) / MinerU-HTML | Fixed pipeline lightweight model |
| File Size Limit | ≤ 200MB | ≤ 10MB |
| Page Limit | ≤ 600 pages | ≤ 20 pages |
| Batch Support | ✅ Yes (≤ 200) | ❌ Single file |
| Output Format | Zip containing Markdown, JSON; exportable to docx/html/latex | Markdown only (CDN link) |
| Invocation | Async (submit → poll) | Async (submit → poll) |

## 🎯 Precision Parsing API

Token required; supports pipeline / vlm / MinerU-HTML models; single file and batch both supported.

### Overview

MinerU Precision Parsing API is designed for complex documents requiring high-precision, deep structured extraction. It intelligently identifies and processes complex layouts, multimodal content (tables, math formulas, charts, images, multi-column layouts etc.), converting document content into high-quality structured data.

Core Features:

- Ultimate precision: Industry-leading parsing accuracy, especially for non-standard and complex documents
- Deep structuring: Beyond text extraction; deeply understands document layout and semantics, outputting structured data with rich hierarchical relationships
- Multimodal support: Comprehensive precise recognition and extraction of text, tables, images, formulas etc.
- Complex layout adaptation: Effectively handles scanned documents, messy layouts, watermark interference etc.

File Limits:

| Limit Item | Limit Value |
|---|---|
| Max File Size | 200 MB |
| Max Pages | 600 pages |
| Supported Types | PDF, Images (png/jpg/jpeg/jp2/webp/gif/bmp), Doc, Docx, Ppt, PPTx |

### Single File Parsing

#### Create Parsing Task

Interface Description

For creating parsing tasks via API; users must apply for Token first. Notes:

- Single file size cannot exceed 200MB; page count not exceeding 600
- Each account has 2000 pages/day highest priority parsing quota; beyond 2000 pages priority lowered
- Due to network restrictions, overseas URLs like github, aws will timeout
- This interface does not support direct file upload
- Header must contain Authorization field in format Bearer + space + Token

Python Request Example (for pdf, doc, ppt, image files):

```python
import requests

token = "API token applied from official site"
url = "https://mineru.net/api/v4/extract/task"
header = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {token}"
}
data = {
    "url": "https://cdn-mineru.openxlab.org.cn/demo/example.pdf",
    "model_version": "vlm"
}

res = requests.post(url,headers=header,json=data)
print(res.status_code)
print(res.json())
print(res.json()["data"])
```

Python Request Example (for html files):

```python
import requests

token = "API token applied from official site"
url = "https://mineru.net/api/v4/extract/task"
header = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {token}"
}
data = {
    "url": "https://****",
    "model_version": "MinerU-HTML"
}

res = requests.post(url,headers=header,json=data)
print(res.status_code)
print(res.json())
print(res.json()["data"])
```

CURL Request Example (for pdf, doc, ppt, image files):

```bash
curl --location --request POST 'https://mineru.net/api/v4/extract/task' \
--header 'Authorization: Bearer ***' \
--header 'Content-Type: application/json' \
--header 'Accept: */*' \
--data-raw '{
    "url": "https://cdn-mineru.openxlab.org.cn/demo/example.pdf",
    "model_version": "vlm"
}'
```

CURL Request Example (for html files):

```bash
curl --location --request POST 'https://mineru.net/api/v4/extract/task' \
--header 'Authorization: Bearer ***' \
--header 'Content-Type: application/json' \
--header 'Accept: */*' \
--data-raw '{
    "url": "https://****",
    "model_version": "MinerU-HTML"
}'
```

Request Body Parameters

| Parameter | Type | Required | Example | Description |
|---|---|---|---|---|
| url | string | Yes | https://static.openxlab.org.cn/opendatalab/pdf/demo.pdf | File URL; supports .pdf, .doc, .docx, .ppt, .pptx, images (png/jpg/jpeg/jp2/webp/gif/bmp), .html |
| is_ocr | bool | No | false | Enable OCR; default false; effective only for pipeline, vlm models |
| enable_formula | bool | No | true | Enable formula recognition; default true; effective only for pipeline, vlm models. Note: for vlm model, affects inline formula parsing only |
| enable_table | bool | No | true | Enable table recognition; default true; effective only for pipeline, vlm models |
| language | string | No | ch | Document language; default ch. See language reference for options. Effective only for pipeline, vlm models |
| data_id | string | No | abc** | Data ID for parsed object. Composed of letters, digits, underscore (_), hyphen (-), period (.); max 128 chars; can uniquely identify your business data |
| callback | string | No | http://127.0.0.1/callback | Callback URL for parsing result notification; supports HTTP and HTTPS. When empty, must poll results periodically. Callback interface must support POST, UTF-8, Content-Type:application/json, parameters checksum and content. Parsing interface sets checksum and content per rules below when calling your callback. checksum: string from user uid + seed + content via SHA256. User UID available in personal center. For tamper prevention, generate string per algorithm upon receiving push and verify against checksum. content: JSON string; parse back to JSON object. See task query result data section for content examples. Note: If your callback returns HTTP 200, reception successful; other codes treated as failure. On failure, mineru retries up to 5 times until success. After 5 failures, stops pushing; recommend checking callback interface status. |
| seed | string | No | abc** | Random string for callback signature. Letters, digits, underscore (_); max 64 chars; custom. Used to verify callback request originated from MinerU parsing service. Note: Required when using callback. |
| extra_formats | [string] | No | ["docx","html"] | markdown, json are default export formats; no setup needed. Supports one or more of docx, html, latex. Ineffective for html source files. |
| page_ranges | string | No | 1-600 | Page range specification; comma-separated string. E.g., "2,4-6": selects page 2, pages 4-6 inclusive (result [2,4,5,6]); "2--2": from page 2 to second-to-last page ("-2" means second-to-last). |
| model_version | string | No | vlm | MinerU model version; three options: pipeline, vlm, MinerU-HTML; default pipeline. For HTML files, must specify MinerU-HTML explicitly; for non-HTML, choose pipeline or vlm |
| no_cache | bool | No | false | Bypass cache; default false. API server caches URL content for a period; setting true ignores cached results and fetches latest from URL. |
| cache_tolerance | int | No | 900 | Cache tolerance seconds; default 900 (15 min). Tolerable URL content cache validity; cache beyond this time not used. Effective when no_cache is false |

Response Parameters

| Parameter | Type | Example | Description |
|---|---|---|---|
| code | int | 0 | Interface status code; success: 0 |
| msg | string | ok | Interface processing message; success: "ok" |
| trace_id | string | c876cd60b202f2396de1f9e39a1b0172 | Request ID |
| data.task_id | string | a90e6ab6-44f3-4554-b459-b62fe4c6b436 | Extraction task id; usable for querying task result |

Response Example

```json
{
  "code": 0,
  "data": {
    "task_id": "a90e6ab6-44f3-4554-b4***"
  },
  "msg": "ok",
  "trace_id": "c876cd60b202f2396de1f9e39a1b0172"
}
```

#### Get Task Result

Interface Description

Query extraction task progress by task_id; upon completion, interface responds with extraction details.

Python Request Example

```python
import requests

token = "API token applied from official site"
task_id = "task_id returned from previous create task"
url = f"https://mineru.net/api/v4/extract/task/{task_id}"
header = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {token}"
}

res = requests.get(url, headers=header)
print(res.status_code)
print(res.json())
print(res.json()["data"])
```

CURL Request Example

```bash
curl --location --request GET 'https://mineru.net/api/v4/extract/task/{task_id}' \
--header 'Authorization: Bearer *****' \
--header 'Accept: */*'
```

Response Parameters

| Parameter | Type | Example | Description |
|---|---|---|---|
| code | int | 0 | Interface status code; success: 0 |
| msg | string | ok | Interface processing message; success: "ok" |
| trace_id | string | c876cd60b202f2396de1f9e39a1b0172 | Request ID |
| data.task_id | string | abc** | Task ID |
| data.data_id | string | abc** | Data ID for parsed object. Note: Returns corresponding data_id if provided in parsing request. |
| data.state | string | done | Task processing status; complete: done, pending: queuing, running: parsing, failed: parsing failed, converting: format converting |
| data.full_zip_url | string | https://cdn-mineru.openxlab.org.cn/pdf/018e53ad-d4f1-475d-b380-36bf24db9914.zip | File parsing result zip package. For non-html file result details see: https://opendatalab.github.io/MinerU/reference/output_files/ ; layout.json corresponds to intermediate processing result (middle.json), **_model.json to model inference result (model.json), **_content_list.json to content list (content_list.json), full.md is MarkDown parsing result. For html files: full.md is MarkDown result, main.html is extracted body html |
| data.err_msg | string | File format not supported, please upload compliant file type | Parsing failure reason; valid when state=failed |
| data.extract_progress.extracted_pages | int | 1 | Document parsed page count; valid when state=running |
| data.extract_progress.start_time | string | 2025-01-20 11:43:20 | Document parsing start time; valid when state=running |
| data.extract_progress.total_pages | int | 2 | Document total pages; valid when state=running |

Response Examples

```json
{
  "code": 0,
  "data": {
    "task_id": "47726b6e-46ca-4bb9-******",
    "state": "running",
    "err_msg": "",
    "extract_progress": {
      "extracted_pages": 1,
      "total_pages": 2,
      "start_time": "2025-01-20 11:43:20"
    }
  },
  "msg": "ok",
  "trace_id": "c876cd60b202f2396de1f9e39a1b0172"
}
```

```json
{
  "code": 0,
  "data": {
    "task_id": "47726b6e-46ca-4bb9-******",
    "state": "done",
    "full_zip_url": "https://cdn-mineru.openxlab.org.cn/pdf/018e53ad-d4f1-475d-b380-36bf24db9914.zip",
    "err_msg": ""
  },
  "msg": "ok",
  "trace_id": "c876cd60b202f2396de1f9e39a1b0172"
}
```

### Batch File Parsing

#### Local File Batch Upload Parsing

Interface Description

For local file upload parsing scenarios; can batch-request file upload links via this interface. After upload, system auto-submits parsing tasks. Notes:

- Applied upload links valid for 24 hours; complete upload within validity period
- No Content-Type header needed when uploading
- After upload complete, no need to call submit parsing task interface. System auto-scans completed uploads and submits parsing tasks
- Max 200 links per application
- Header must contain Authorization field in format Bearer + space + Token

[Python and CURL examples omitted for brevity - identical structure to single file with batch endpoint and files array]

Request Body Parameters

| Parameter | Type | Required | Example | Description |
|---|---|---|---|---|
| enable_formula | bool | No | true | Enable formula recognition; default true; effective only for pipeline, vlm models |
| enable_table | bool | No | true | Enable table recognition; default true; effective only for pipeline, vlm models |
| language | string | No | ch | Document language; default ch |
| file.name | string | Yes | demo.pdf | Filename; supports multiple formats; strongly recommend correct extension |
| file.is_ocr | bool | No | true | Enable OCR; default false |
| file.data_id | string | No | abc** | Data ID for parsed object |
| file.page_ranges | string | No | 1-600 | Page range specification |
| callback | string | No | http://127.0.0.1/callback | Callback URL |
| seed | string | No | abc** | Random string for callback signature |
| extra_formats | [string] | No | ["docx","html"] | Extra export formats |
| model_version | string | No | vlm | MinerU model version |

Response Parameters

| Parameter | Type | Example | Description |
|---|---|---|---|
| code | int | 0 | Interface status code; success: 0 |
| msg | string | ok | Interface processing message |
| trace_id | string | c876cd60b202f2396de1f9e39a1b0172 | Request ID |
| data.batch_id | string | 2bb2f0ec-a336-4a0a-b61a-**** | Batch extraction task id |
| data.file_urls | [string] | ["https://mineru.oss-cn-shanghai.aliyuncs.com/api-upload/***"] | File upload links |

#### URL Batch Upload Parsing

Interface Description

For batch creating extraction tasks via API. Notes:

- Max 200 per application
- File size ≤ 200MB, pages ≤ 600
- Overseas URLs may timeout
- Header must contain Authorization

[Examples follow same pattern as above with batch endpoint]

### Batch Get Task Results

Interface Description

Batch query extraction task progress by batch_id.

[Python/CURL examples and response parameters follow same pattern]

### Common Error Codes

| Error Code | Description | Resolution |
|---|---|---|
| A0202 | Token error | Check Token correctness; verify Bearer prefix or replace Token |
| A0211 | Token expired | Replace Token |
| -500 | Parameter error | Ensure parameter types and Content-Type correct |
| -10001 | Service exception | Try again later |
| -10002 | Request parameter error | Check request parameter format |
| -60001 | Generate upload URL failed | Try again later |
| -60002 | Match file format failed | File type detection failed; ensure filename and link have correct extension and file is pdf/doc/docx/ppt/pptx/png/jp(e)g |
| -60003 | File read failed | Check file integrity and re-upload |
| -60004 | Empty file | Upload valid file |
| -60005 | File size exceeds limit | Check file size; max 200MB |
| -60006 | File pages exceed limit | Split file and retry |
| -60007 | Model service temporarily unavailable | Retry later or contact support |
| -60008 | File read timeout | Check URL accessibility |
| -60009 | Task submission queue full | Try again later |
| -60010 | Parsing failed | Try again later |
| -60011 | Get valid file failed | Ensure file uploaded |
| -60012 | Task not found | Ensure task_id valid and not deleted |
| -60013 | No permission to access task | Can only access own submitted tasks |
| -60014 | Delete running task | Running tasks not deletable |
| -60015 | File conversion failed | Convert to pdf manually and re-upload |
| -60016 | File conversion failed | Conversion to specified format failed; try other format or retry |
| -60017 | Retry limit reached | Wait for model upgrade and retry |
| -60018 | Daily parsing quota reached | Come back tomorrow |
| -60019 | HTML parsing quota insufficient | Come back tomorrow |
| -60020 | File split failed | Retry later |
| -60021 | Read file pages failed | Retry later |
| -60022 | Webpage read failed | May be network issue or rate limiting; retry later |

</content>