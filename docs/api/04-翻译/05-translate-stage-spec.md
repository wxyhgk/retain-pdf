# translate.stage.v1

`translate.stage.v1` 是 Rust API 启动 Python 翻译 worker 的稳定内部契约。外部调用者通常不需要直接写这个文件，但理解它有助于排查任务。

## 执行入口

Rust 会启动：

```bash
retainpdf-pipeline translate-only --spec <job_root>/specs/translate.spec.json
```

未安装 retainpdf-pipeline 的桌面兼容目录回退到 python backend/pipeline/entrypoints/run_translate_only.py --spec <job_root>/specs/translate.spec.json。

## Spec 结构

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

## 安全约定

- API key 不写入 spec 明文。
- `credential_ref` 指向运行时环境变量。
- Rust worker 启动时注入 `RETAIN_TRANSLATION_API_KEY`。

## 产物

翻译 worker 成功后会写：

- `translated/translation-manifest.json`
- 逐页 translation payload
- `artifacts/translation_diagnostics.json`
- `artifacts/translation_debug_index.json`
- `artifacts/translation_review.json`
- `artifacts/pipeline_summary.json`
