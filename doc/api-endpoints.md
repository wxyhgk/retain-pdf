# 接口说明

## 1. 上传 PDF

`POST /api/v1/uploads`

表单字段：

- `file`：必填，PDF 文件

示例：

```bash
curl -X POST http://127.0.0.1:41000/api/v1/uploads \
  -H "X-API-Key: your-rust-api-key" \
  -F "file=@/path/to/paper.pdf"
```

## 2. 创建主任务

`POST /api/v1/jobs`

最常用请求体：

```json
{
  "workflow": "mineru",
  "upload_id": "20260402073151-a80618",
  "mode": "sci",
  "model": "deepseek-chat",
  "base_url": "https://api.deepseek.com/v1",
  "api_key": "sk-xxxx",
  "mineru_token": "mineru-xxxx",
  "model_version": "vlm",
  "language": "ch",
  "render_mode": "auto",
  "skip_title_translation": false,
  "batch_size": 1,
  "workers": 100,
  "classify_batch_size": 12,
  "compile_workers": 8,
  "rule_profile_name": "general_sci",
  "custom_rules_text": ""
}
```

补充说明：

- `skip_title_translation=false`：翻译标题
- `skip_title_translation=true`：跳过标题翻译，保留原文标题

## 3. 查询任务详情

`GET /api/v1/jobs/{job_id}`

返回重点字段：

- `status`
- `stage`
- `stage_detail`
- `progress`
- `artifacts`
- `ocr_job`
- `failure_diagnostic`
- `log_tail`

## 4. 查询事件流

`GET /api/v1/jobs/{job_id}/events`

用于前端进度展示和排错。

## 5. 下载产物

- `GET /api/v1/jobs/{job_id}/pdf`
- `GET /api/v1/jobs/{job_id}/markdown`
- `GET /api/v1/jobs/{job_id}/markdown?raw=true`
- `GET /api/v1/jobs/{job_id}/download`
- `GET /api/v1/jobs/{job_id}/normalized-document`
- `GET /api/v1/jobs/{job_id}/normalization-report`

## 6. 取消任务

`POST /api/v1/jobs/{job_id}/cancel`

## 7. 常见状态

`status`：

- `queued`
- `running`
- `succeeded`
- `failed`
- `canceled`

常见 `stage`：

- `queued`
- `ocr_submitting`
- `ocr_upload`
- `mineru_upload`
- `mineru_processing`
- `translation_prepare`
- `normalizing`
- `domain_inference`
- `continuation_review`
- `page_policies`
- `translating`
- `rendering`
- `saving`
- `finished`
- `failed`
