# 快速使用说明

## 1. 本地 OCR JSON + PDF

如果你已经有 OCR 输出的 `.json` 和原始 `.pdf`，推荐直接使用：

```bash
python scripts/run_case.py \
  --source-json Data/test1/test1.json \
  --source-pdf Data/test1/test1.pdf \
  --mode sci \
  --model deepseek-chat \
  --base-url https://api.deepseek.com/v1 \
  --api-key "$DEEPSEEK_API_KEY"
```

## 2. 原始 PDF 直接走 MinerU

如果你只有原始 PDF，推荐使用：

```bash
python scripts/run_mineru_case.py \
  --file-path Data/test1/test1.pdf \
  --mineru-token "$MINERU_API_TOKEN" \
  --mode sci \
  --model deepseek-chat \
  --base-url https://api.deepseek.com/v1 \
  --api-key "$DEEPSEEK_API_KEY"
```

## 3. 启动后端 API

```bash
python -m uvicorn Fast_API.main:app --host 0.0.0.0 --port 40000
```

启动后可访问：

- `GET /health`
- `POST /v1/run-case`
- `POST /v1/run-mineru-case`
- `POST /v1/uploads/pdf`
- `POST /v1/run-uploaded-mineru-case`
- `GET /v1/jobs/{job_id}`
- `GET /v1/jobs/{job_id}/download`

## 4. 启动前端

```bash
cd front
python -m http.server 40001 --bind 0.0.0.0
```

## 5. 当前推荐使用方式

如果是正式使用，建议：

- 学术论文优先用 `sci`
- API 场景优先走 FastAPI
- 浏览器上传场景优先走前端 + FastAPI

## 6. 常见模式

- `sci`
  面向学术论文的稳定模式
- `fast`
  更快的通用模式
- `precise`
  更强调复杂页面处理的模式

## 7. 模型与接口

当前支持：

- DeepSeek 官方接口
- OpenAI 兼容接口
- 本地自部署模型接口

## 8. 使用建议

- 日常翻译优先使用稳定接口
- 大批量任务建议通过 API 方式接入
- 最终交付优先查看 `transPDF/` 下的结果
