# Translation Promptfoo 调试

这套脚手架的目标不是重跑整本书，而是把“某个翻译 item 为什么没翻 / 降级 / 输出脏了”收敛成可复现、可对比、可自动回归的最小闭环。

当前链路分成三层：

- Rust API 调试接口
  - `GET /api/v1/jobs/{job_id}/translation/diagnostics`
  - `GET /api/v1/jobs/{job_id}/translation/items`
  - `GET /api/v1/jobs/{job_id}/translation/items/{item_id}`
  - `POST /api/v1/jobs/{job_id}/translation/items/{item_id}/replay`
- Python 单 item replay
  - `backend/scripts/devtools/replay_translation_item.py`
- Promptfoo fixture/eval
  - 当前目录下的 `scan_drift.py`、`capture_case.py`、`run_eval.py`、`promptfooconfig*.yaml`

## 1. 先定位具体 item

本地 API 起着时，可以先看：

```bash
curl -H 'X-API-Key: retain-pdf-desktop' \
  'http://127.0.0.1:41000/api/v1/jobs/<job_id>/translation/items?final_status=kept_origin&q=protocol'
```

或者直接看单个 item：

```bash
curl -H 'X-API-Key: retain-pdf-desktop' \
  'http://127.0.0.1:41000/api/v1/jobs/<job_id>/translation/items/<item_id>'
```

## 2. 先扫一遍 saved vs replay 的策略漂移

```bash
python backend/scripts/devtools/promptfoo/scan_drift.py \
  --job-root 20260415003317-c856fe \
  --saved-final-status kept_origin \
  --limit 10
```

默认会：

- 先按 saved 侧 `final_status=kept_origin` 过滤
- 对候选 item 逐个 replay
- 输出发生策略漂移的项

如果想把 replay 过的候选全部打出来：

```bash
python backend/scripts/devtools/promptfoo/scan_drift.py \
  --job-root 20260415003317-c856fe \
  --saved-final-status kept_origin \
  --all
```

## 3. 把坏例子记成 fixture

```bash
python backend/scripts/devtools/promptfoo/capture_case.py \
  --job-root 20260416034152-d12925 \
  --item-id p006-b014 \
  --description 'page6 red-shift paragraph untranslated' \
  --expected-contains 红移 \
  --expected-contains 荧光 \
  --required-term 551\ nm
```

默认会写入：

- `backend/scripts/devtools/promptfoo/fixtures/cases.csv`
- `backend/scripts/devtools/promptfoo/fixtures/cases/<job>--<item>.json`

这个 JSON case artifact 会把以下信息一起固化下来：

- saved item 快照
- 当前 replay 结果
- policy_before / policy_after
- drift 摘要

如果这次只想记 saved 侧，不想触发 replay：

```bash
python backend/scripts/devtools/promptfoo/capture_case.py \
  --job-root 20260416034152-d12925 \
  --item-id p006-b014 \
  --description 'page6 red-shift paragraph untranslated' \
  --skip-replay
```

CSV 里多值字段用 `||` 分隔，便于多人直接改表：

- `expected_contains`
- `required_terms`
- `forbidden_substrings`

## 4. 跑 promptfoo

前置条件：

- Python 直接用当前仓库环境即可
- `promptfoo` 需要 `Node 20.20+` 或 `22.22+`

`run_eval.py` 会优先使用当前 shell 的 `node`；如果当前版本不够，但 `~/.nvm/versions/node` 里已经装了兼容版本，它会自动切过去，不需要你手动 `nvm use`。

只评估当前 replay 输出：

```bash
python backend/scripts/devtools/promptfoo/run_eval.py
```

同时看“当前 replay”对比“任务原始落盘输出”：

```bash
python backend/scripts/devtools/promptfoo/run_eval.py --compare
```

如果只想先验证 fixture 和断言链路，不调用模型：

```bash
python backend/scripts/devtools/promptfoo/run_eval.py --saved-only
```

底层实际执行的是：

```bash
npx promptfoo@latest eval -c backend/scripts/devtools/promptfoo/promptfooconfig.yaml
```

`run_eval.py` 会自动：

- 检查 fixture 是否为空
- 把 `PROMPTFOO_PYTHON` 指到当前 Python
- 把 fixture 路径注入 `PROMPTFOO_TRANSLATION_FIXTURES`

## 断言规则

当前 fixture 默认支持几类硬规则：

- 输出最小长度
- 是否必须出现中文
- 必须包含的翻译短语
- 必须保留的术语
- 禁止出现的脏输出片段
- `$...$` / `$$...$$` 数量是否和源文本一致

这些规则都在：

- `backend/scripts/devtools/promptfoo/assertions.py`

## GitHub CI

仓库现在可以直接接 GitHub Actions 跑 `current-replay`。

对应 workflow：

- `.github/workflows/translation-replay.yml`

设计上分两层：

- 先跑纯本地单元测试
  - `test_promptfoo_case_tools.py`
  - `test_promptfoo_harness_regressions.py`
  - `test_translation_debug_tools.py`
- 再跑真正的 promptfoo current-replay
  - `python backend/scripts/devtools/promptfoo/run_eval.py`

### 为什么 GitHub CI 不依赖 `data/jobs/`

GitHub runner checkout 后默认拿不到你本地的 `data/jobs/...` 工作目录，所以 case artifact 现在会额外冻结：

- translate spec 的关键参数
- 对应页的完整 translated payload

这样 CI 在 runner 上即使没有 job 目录，也能直接从：

- `backend/scripts/devtools/promptfoo/fixtures/cases/*.json`

复跑当前 replay 路径。

### 需要的 GitHub Secret

必须配置：

- `RETAIN_TRANSLATION_API_KEY`

用途：

- 给 current-replay provider 调模型

fork PR 默认拿不到 secret，所以 workflow 会：

- 仍然跑本地单元测试
- 跳过需要 secret 的 current-replay eval

### Artifact

workflow 会上传：

- current replay 的 promptfoo JSON 结果
- 当前 fixture CSV
- case artifact JSON
- `~/.promptfoo/logs/*.log`

## 适用边界

这套工具优先解决“翻译策略 / fallback / keep-origin / prompt / provider 输出异常”的问题。

它不直接解决：

- OCR 抽块错误
- continuation 拼接错误
- Typst 排版错误

但你可以先用这套东西快速判断：问题发生在“翻译前”还是“翻译后”。
