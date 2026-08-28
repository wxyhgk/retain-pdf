# Translation Promptfoo Debugging

The goal of this framework is not to replay entire books but to condense "why a translation item was not translated / degraded / produced dirty output" into the smallest reproducible, comparable, and automatically regression-testable loop.

The current process is divided into three layers:

- Rust API Debug Interface
  - `GET /api/v1/jobs/{job_id}/translation/diagnostics`
  - `GET /api/v1/jobs/{job_id}/translation/items`
  - `GET /api/v1/jobs/{job_id}/translation/items/{item_id}`
  - `POST /api/v1/jobs/{job_id}/translation/items/{item_id}/replay`
- Single-Item Python Replay
  - `backend/scripts/devtools/replay_translation_item.py`
- Promptfoo Fixture/Eval
  - Files `scan_drift.py`, `capture_case.py`, `run_eval.py`, `promptfooconfig*.yaml` in the current directory

## 1. First Locate Specific Items

When the local API is running, you can preview:

```bash
curl -H 'X-API-Key: retain-pdf-desktop' \
  'http://127.0.0.1:41000/api/v1/jobs/<job_id>/translation/items?final_status=kept_origin&q=protocol'
```

Nếu không muốn viết curl thủ công, cũng có thể dùng trực tiếp:

```bash
python backend/scripts/devtools/translation_debug_api.py \
  items \
  --job-id <job_id> \
  --final-status kept_origin \
  --q protocol
```

Hoặc xem trực tiếp từng item:

```bash
curl -H 'X-API-Key: retain-pdf-desktop' \
  'http://127.0.0.1:41000/api/v1/jobs/<job_id>/translation/items/<item_id>'
```

```bash
python backend/scripts/devtools/translation_debug_api.py \
  item \
  --job-id <job_id> \
  --item-id <item_id>
```

Khi cần phát lại trực tiếp quy trình dịch hiện tại:

```bash
python backend/scripts/devtools/translation_debug_api.py \
  replay \
  --job-id <job_id> \
  --item-id <item_id>
```

## 2. Pre-Scan Strategy Drift Between Saved and Replay

```bash
python backend/scripts/devtools/promptfoo/scan_drift.py \
  --job-root 20260415003317-c856fe \
  --saved-final-status kept_origin \
  --limit 10
```

By default, it will:

- Pre-filter by `final_status=kept_origin` on the saved side
- Replay each candidate item
- Output items that exhibit strategy drift

Nếu muốn xuất ra tất cả các ứng viên đã replay:

```bash
python backend/scripts/devtools/promptfoo/scan_drift.py \
  --job-root 20260415003317-c856fe \
  --saved-final-status kept_origin \
  --all
```

## 3. Record Bad Examples as Fixtures

```bash
python backend/scripts/devtools/promptfoo/capture_case.py \
  --job-root 20260416034152-d12925 \
  --item-id p006-b014 \
  --description 'page6 red-shift paragraph untranslated' \
  --expected-contains 红移 \
  --expected-contains 荧光 \
  --required-term 551\ nm
```

By default, it will write to:

- `backend/scripts/devtools/promptfoo/fixtures/cases.csv`
- `backend/scripts/devtools/promptfoo/fixtures/cases/<job>--<item>.json`

This case JSON artifact will simultaneously freeze the following information:

- Saved item snapshot
- Current replay result
- policy_before / policy_after
- Drift summary

Nếu lần này chỉ muốn ghi lại phía saved, không muốn kích hoạt replay:

```bash
python backend/scripts/devtools/promptfoo/capture_case.py \
  --job-root 20260416034152-d12925 \
  --item-id p006-b014 \
  --description 'page6 red-shift paragraph untranslated' \
  --skip-replay
```

Các trường đa giá trị trong CSV sử dụng `||` để phân tách, thuận tiện cho nhiều người chỉnh sửa trực tiếp:

- `expected_contains`
- `required_terms`
- `forbidden_substrings`

## 4. Run promptfoo

Prerequisites:

- Python directly uses the current repository environment
- `promptfoo` requires `Node 20.20+` or `22.22+`

`run_eval.py` will prioritize using the `node` from the current shell; if the current version is insufficient but a compatible version is installed in `~/.nvm/versions/node`, it will automatically switch without requiring you to manually `nvm use`.

Chỉ đánh giá đầu ra replay hiện tại:

```bash
python backend/scripts/devtools/promptfoo/run_eval.py
```

Đồng thời xem so sánh giữa "replay hiện tại" và "đầu ra lưu trữ gốc của tác vụ":

```bash
python backend/scripts/devtools/promptfoo/run_eval.py --compare
```

Nếu chỉ muốn xác minh trước fixture và quy trình assertion mà không gọi mô hình:

```bash
python backend/scripts/devtools/promptfoo/run_eval.py --saved-only
```

Thực tế bên dưới thực thi:

```bash
npx promptfoo@latest eval -c backend/scripts/devtools/promptfoo/promptfooconfig.yaml
```

`run_eval.py` sẽ tự động:

- Check if the fixture is empty
- Point `PROMPTFOO_PYTHON` to the current Python
- Inject the fixture path into `PROMPTFOO_TRANSLATION_FIXTURES`

## Assertion Rules

The current fixture supports several hard rules by default:

- Minimum output length
- Whether Chinese must appear
- Required translation phrases
- Terms that must be preserved
- Forbidden dirty output segments
- Whether the count of `$...$` / `$$...$$` matches the source text

These rules are all located in:

- `backend/scripts/devtools/promptfoo/assertions.py`

## GitHub CI

The current repository can directly connect with GitHub Actions to run `current-replay`.

Corresponding workflow:

- `.github/workflows/translation-replay.yml`

Design is divided into two layers:

- First run pure local unit tests
  - `test_promptfoo_case_tools.py`
  - `test_promptfoo_harness_regressions.py`
  - `test_translation_debug_tools.py`
- Then run the actual promptfoo current-replay
  - `python backend/scripts/devtools/promptfoo/run_eval.py`

### Why GitHub CI Does Not Depend on `data/jobs/`

After the GitHub runner checks out, it cannot access your local working directory `data/jobs/...` by default, so the current case artifact will additionally freeze:

- Main parameters of the translate spec
- The entire translated payload of the corresponding page

Thus, even without the job directory on the runner, CI can still directly replay the current replay path from:

- `backend/scripts/devtools/promptfoo/fixtures/cases/*.json`

### Required GitHub Secrets

Need to configure:

- `RETAIN_TRANSLATION_API_KEY`

Purpose:

- For the provider current-replay to call the model

PRs from forks cannot access secrets by default, so the workflow will:

- Still run local unit tests
- Skip current-replay eval that requires secrets

### Artifacts

The workflow will upload:

- Current replay promptfoo JSON results
- Current fixture CSV
- Case JSON artifacts
- `~/.promptfoo/logs/*.log`

## Application Boundaries

This toolkit prioritizes solving issues related to "translation strategy / fallback / keep-origin / prompt / abnormal provider output".

It does not directly address:

- OCR block extraction errors
- Continuation merging errors
- Typst layout errors

However, you can use this toolkit to quickly determine: whether the issue occurs "before translation" or "after translation".
