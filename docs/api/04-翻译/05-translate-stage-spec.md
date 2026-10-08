# translate.stage.v1

`translate.stage.v1` 是 Rust API 启动 Python 翻译 worker 的稳定内部契约。外部调用者通常不需要直接写这个文件，但理解它有助于排查任务。

## 执行入口

Rust 会启动：

```bash
python -m retainpdf_pipeline.translate --spec <job_root>/specs/translate.spec.json
```

Python 可执行文件由 `PYTHON_BIN` 配置，不再回退到旧脚本。

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
    "model": "deepseek-flash",
    "base_url": "https://api.deepseek.com/v1",
    "credential_ref": "env:RETAIN_TRANSLATION_API_KEY",
    "preparation": "off",
    "reviewer_model": "",
    "reviewer_base_url": "",
    "reviewer_credential_ref": ""
  }
}
```

## 安全约定

- API key 不写入 spec 明文。
- `credential_ref` 指向运行时环境变量。
- Rust worker 启动时注入 `RETAIN_TRANSLATION_API_KEY`。
- 配置了审校 key（`reviewer_api_key` 或 `reviewer_credential_ref`）时，`reviewer_credential_ref` 写 `env:RETAIN_REVIEWER_API_KEY`，worker 启动时注入同名环境变量；没配置时写空串，Python 侧回退到翻译模型。走 Rust 模型执行器（`execution_connection`）时两个 key 环境变量都不注入。

## 译前准备与审校字段

- `preparation`: `off` / `artifacts_only` / `terms` / `terms+style`，默认 `off`，含义见「翻译参数」。provider.stage.v1 的 `translation` 段带同样的字段。
- `reviewer_model`、`reviewer_base_url`: 原样透传，空串表示回退到 `model` / `base_url`。

## 产物

翻译 worker 成功后会写：

- `translated/translation-manifest.json`
- `translated/term-base.v1.json`、`translated/style-guide.v1.json`（仅 `preparation` 不为 `off` 时）
- 逐页 translation payload
- `artifacts/translation_diagnostics.json`
- `artifacts/translation_debug_index.json`
- `artifacts/translation_review.json`
- `artifacts/pipeline_summary.json`
