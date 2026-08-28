# translate.stage.v1

`translate.stage.v1` là hợp đồng nội bộ ổn định mà Rust API sử dụng để khởi động worker dịch Python. Các bên gọi bên ngoài thường không cần viết trực tiếp tệp này, nhưng việc hiểu nó sẽ giúp ích cho việc khắc phục sự cố tác vụ.

## Điểm vào thực thi

Rust sẽ khởi động:

```bash
run_translate_only.py --spec <job_root>/specs/translate.spec.json
```

## Cấu trúc Spec

```json
{
  "schema_version": "translate.stage.v1",
  "stage": "translate",
  "job": {
    "job_id": "20260616120000-abcdef",
    "job_root": "/data/jobs/20260616120000-abcdef",
    "workflow": "book"
  },
  "inputs": {
    "source_json": "/data/jobs/xxx/ocr/normalized/document.v1.json",
    "source_pdf": "/data/jobs/xxx/source/book.pdf",
    "layout_json": "/data/jobs/xxx/ocr/result.json"
  },
  "params": {
    "start_page": 0,
    "end_page": -1,
    "batch_size": 1,
    "workers": 100,
    "mode": "sci",
    "math_mode": "direct_typst",
    "skip_title_translation": false,
    "classify_batch_size": 12,
    "rule_profile_name": "general_sci",
    "custom_rules_text": "",
    "glossary_id": "",
    "glossary_name": "",
    "glossary_entries": [],
    "context_mode": "needed",
    "glossary_mode": "matched",
    "memory_mode": "matched",
    "model": "deepseek-v4-flash",
    "base_url": "https://api.deepseek.com/v1",
    "credential_ref": "env:RETAIN_TRANSLATION_API_KEY"
  }
}
```

## Quy ước bảo mật

- API key không được ghi vào spec dưới dạng plaintext.
- `credential_ref` trỏ đến biến môi trường runtime.
- Worker Rust khởi động sẽ tiêm `RETAIN_TRANSLATION_API_KEY`.

## Sản phẩm

Sau khi worker dịch thành công sẽ ghi:

- `translated/translation-manifest.json`
- Từng payload dịch theo trang
- `artifacts/translation_diagnostics.json`
- `artifacts/translation_debug_index.json`
- `artifacts/translation_review.json`
- `artifacts/pipeline_summary.json`
