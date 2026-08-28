MinerU provides two document parsing APIs for different scenarios:

🎯 Precision Parsing API — Token required; supports single/batch, tables/formulas/multi-format output
⚡ Agent Lightweight Parsing API — No login; IP rate-limited against abuse; designed for AI Agent workflows

Mode Comparison
| Dimension | 🎯 Precision Parsing API | ⚡ Agent Lightweight Parsing API |
|---|---|---|
| Token Required | ✅ Yes | ❌ No (IP rate limit) |
| Endpoint | /api/v4/extract/task or /api/v4/file-urls/batch | /api/v1/agent/parse/url or /api/v1/agent/parse/file |
| Model Version | pipeline (default) / vlm (recommended) / MinerU-HTML | Fixed pipeline lightweight model |
| Table/Formula Recognition | ✅ Supported (configurable) | ❌ Disabled (speed priority) |
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

[Python and CURL request examples identical to doc/reference/mineru_api/README.md - omitted for brevity]

Request Body Parameters

| Parameter | Type | Required | Example | Description |
|---|---|---|---|---|
| url | string | Yes | https://static.openxlab.org.cn/opendatalab/pdf/demo.pdf | File URL; supports multiple formats |
| is_ocr | bool | No | false | Enable OCR; default false |
| enable_formula | bool | No | true | Enable formula recognition; default true |
| enable_table | bool | No | true | Enable table recognition; default true |
| language | string | No | ch | Document language; default ch |
| data_id | string | No | abc** | Data ID for parsed object |
| callback | string | No | http://127.0.0.1/callback | Callback URL for result notification |
| seed | string | No | abc** | Random string for callback signature |
| extra_formats | [string] | No | ["docx","html"] | Extra export formats |
| page_ranges | string | No | 1-600 | Page range specification |
| model_version | string | No | vlm | MinerU model version |
| no_cache | bool | No | false | Bypass cache; default false |
| cache_tolerance | int | No | 900 | Cache tolerance seconds; default 900 |

Response Parameters

| Parameter | Type | Example | Description |
|---|---|---|---|
| code | int | 0 | Interface status code; success: 0 |
| msg | string | ok | Interface processing message |
| trace_id | string | c876cd60b202f2396de1f9e39a1b0172 | Request ID |
| data.task_id | string | a90e6ab6-44f3-4554-b459-b62fe4c6b436 | Extraction task id |

[Response examples and remaining sections follow same structure as doc/reference/mineru_api/README.md]

### Common Error Codes

| Error Code | Description | Resolution |
|---|---|---|
| A0202 | Token error | Check Token correctness; verify Bearer prefix or replace Token |
| A0211 | Token expired | Replace Token |
| -500 | Parameter error | Ensure parameter types and Content-Type correct |
| -10001 | Service exception | Try again later |
| -10002 | Request parameter error | Check request parameter format |
| -60001 | Generate upload URL failed | Try again later |
| -60002 | Match file format failed | Ensure filename and link have correct extension |
| -60003 | File read failed | Check file integrity and re-upload |
| -60004 | Empty file | Upload valid file |
| -60005 | File size exceeds limit | Max 200MB |
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
| -60016 | File conversion failed | Try other format or retry |
| -60017 | Retry limit reached | Wait for model upgrade and retry |
| -60018 | Daily parsing quota reached | Come back tomorrow |
| -60019 | HTML parsing quota insufficient | Come back tomorrow |
| -60020 | File split failed | Retry later |
| -60021 | Read file pages failed | Retry later |
| -60022 | Webpage read failed | Network issue or rate limiting; retry later |

</content>