# 前端状态 Smoke 检查

这套检查的目标不是“把前端页面截图出来”，而是自动验证：

- 上传是否成功
- `/api/v1/jobs` 是否成功提交
- 任务详情轮询里，前端会显示的状态标签是否按预期推进

当前脚本位置：

- `frontend/scripts/frontend-status-smoke.mjs`

当前 npm 入口：

```bash
cd frontend
npm run smoke:status -- --file ../data/temPDF/test1.pdf
```

仓库级固定入口：

```bash
./.github/scripts/smoke_frontend_status.sh
```

默认会把最新结果写到：

```text
doc/ops/reports/frontend-status-smoke-latest.json
```

## 默认行为

脚本会按下面的顺序自动取配置：

1. 命令行参数
2. 环境变量
3. `frontend/runtime-config.local.js`
4. `backend/scripts/.env/*.env`

默认读取：

- API Base: `frontend/runtime-config.local.js` / `frontend/runtime-config.js`
- `X-API-Key`: `frontend/runtime-config.local.js`
- Paddle token: `backend/scripts/.env/paddle.env`
- MinerU token: `backend/scripts/.env/mineru.env`
- 翻译 API key: `backend/scripts/.env/deepseek.env`

## 常用示例

跑完整 `book` 流程：

```bash
cd frontend
npm run smoke:status -- --file ../data/temPDF/test1.pdf
```

指定 Paddle：

```bash
cd frontend
npm run smoke:status -- \
  --file ../data/temPDF/test1.pdf \
  --ocr-provider paddle
```

仓库根目录直接跑：

```bash
./.github/scripts/smoke_frontend_status.sh data/temPDF/test1.pdf --ocr-provider paddle
```

只跑翻译不渲染：

```bash
cd frontend
npm run smoke:status -- \
  --file ../data/temPDF/test1.pdf \
  --workflow translate \
  --expect-labels "OCR 中,翻译中,处理完成"
```

指定接口地址与超时时间：

```bash
cd frontend
npm run smoke:status -- \
  --file ../data/temPDF/test1.pdf \
  --api-base http://127.0.0.1:41000 \
  --max-wait-ms 3600000
```

输出 JSON：

```bash
cd frontend
npm run smoke:status -- \
  --file ../data/temPDF/test1.pdf \
  --json
```

## 输出重点

脚本会打印每次状态变化，例如：

```text
2026-04-25T14:00:00.000Z | running | OCR 中 | 已完成第 3/12 页 OCR
2026-04-25T14:00:20.000Z | running | 翻译中 | 已完成第 5/18 批翻译
2026-04-25T14:01:10.000Z | running | 渲染中 | 已完成第 9/12 页渲染
2026-04-25T14:01:30.000Z | succeeded | 处理完成 | 处理完成
```

结尾会汇总：

- `job_id`
- `final_status`
- `observed_labels`
- `missing_labels`
- `event_count`

如果缺少预期标签，或任务最终不是 `succeeded`，脚本会返回非 0 退出码。

## 固定报告

仓库级脚本会固定写出：

- `doc/ops/reports/frontend-status-smoke-latest.json`

报告里包含：

- `jobId`
- `finalStatus`
- `observedLabels`
- `missingLabels`
- `observations`
- `eventSamples`

## 适用边界

这套 smoke 主要验证“前端状态映射链路”：

- 后端是否产出 job detail
- 前端状态归一化逻辑会得到什么标签
- 实际流程里这些标签是否真的出现

它不验证浏览器布局、组件动画、按钮显隐这类纯 UI 细节。那部分如果后面要补，再单独上 Playwright。
