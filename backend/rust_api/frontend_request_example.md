# 前端请求示例

这份文档面向前端接入，给出最常用的调用顺序、请求头、请求体和示例代码。

配合主文档使用：

- [api.md](/home/wxyhgk/tmp/Code/backend/rust_api/api.md)

## 1. 你必须准备的 5 个值

调用 Rust API 时，前端至少要准备下面这些值：

1. `X-API-Key`
2. `mineru_token`
3. `base_url`
4. `api_key`
5. `model`

含义：

- `X-API-Key`：你自己的 Rust 后端访问 key
- `mineru_token`：MinerU 的 API Key
- `base_url`：模型服务的 OpenAI 兼容 URL
- `api_key`：模型服务的 API Key
- `model`：模型名字

## 2. 调用顺序

前端推荐顺序：

1. 上传 PDF
2. 用上传返回的 `upload_id` 创建任务
3. 轮询任务状态
4. 成功后下载 PDF / Markdown / Bundle

## 3. 上传 PDF

请求：

```http
POST /api/v1/uploads
X-API-Key: your-rust-api-key
Content-Type: multipart/form-data
```

前端示例：

```ts
async function uploadPdf(file: File, backendKey: string, developerMode = false) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("developer_mode", String(developerMode));

  const resp = await fetch("http://127.0.0.1:41000/api/v1/uploads", {
    method: "POST",
    headers: {
      "X-API-Key": backendKey,
    },
    body: formData,
  });

  const data = await resp.json();
  if (!resp.ok || data.code !== 0) {
    throw new Error(data.message || "upload failed");
  }
  return data.data;
}
```

成功后会得到：

```json
{
  "upload_id": "20260327-abc123",
  "filename": "paper.pdf",
  "bytes": 1832451,
  "page_count": 18,
  "uploaded_at": "2026-03-27T18:20:31+08:00"
}
```

## 4. 创建任务

请求：

```http
POST /api/v1/jobs
X-API-Key: your-rust-api-key
Content-Type: application/json
```

### 4.1 DeepSeek 示例

```json
{
  "upload_id": "20260327-abc123",
  "mineru_token": "your-mineru-api-key",
  "base_url": "https://api.deepseek.com/v1",
  "api_key": "your-deepseek-api-key",
  "model": "deepseek-chat",
  "mode": "sci",
  "workers": 50,
  "batch_size": 1,
  "render_mode": "auto"
}
```

### 4.2 OpenAI 兼容接口示例

```json
{
  "upload_id": "20260327-abc123",
  "mineru_token": "your-mineru-api-key",
  "base_url": "http://127.0.0.1:10001/v1",
  "api_key": "your-openai-compatible-api-key",
  "model": "Q3.5-turbo",
  "mode": "precise",
  "workers": 4,
  "batch_size": 1,
  "render_mode": "auto"
}
```

前端示例：

```ts
type CreateJobPayload = {
  upload_id: string;
  mineru_token: string;
  base_url: string;
  api_key: string;
  model: string;
  mode?: "sci" | "precise";
  workers?: number;
  batch_size?: number;
  render_mode?: string;
  compile_workers?: number;
  page_ranges?: string;
  rule_profile_name?: string;
  custom_rules_text?: string;
};

async function createJob(payload: CreateJobPayload, backendKey: string) {
  const resp = await fetch("http://127.0.0.1:41000/api/v1/jobs", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": backendKey,
    },
    body: JSON.stringify(payload),
  });

  const data = await resp.json();
  if (!resp.ok || data.code !== 0) {
    throw new Error(data.message || "create job failed");
  }
  return data.data;
}
```

### 4.3 当前强制校验

`POST /api/v1/jobs` 目前会强制校验：

- `upload_id`
- `mineru_token`
- `base_url`
- `api_key`
- `model`

另外：

- `base_url` 必须以 `http://` 或 `https://` 开头

## 5. 轮询任务状态

请求：

```http
GET /api/v1/jobs/{job_id}
X-API-Key: your-rust-api-key
```

前端示例：

```ts
async function getJob(jobId: string, backendKey: string) {
  const resp = await fetch(`http://127.0.0.1:41000/api/v1/jobs/${jobId}`, {
    headers: {
      "X-API-Key": backendKey,
    },
  });

  const data = await resp.json();
  if (!resp.ok || data.code !== 0) {
    throw new Error(data.message || "get job failed");
  }
  return data.data;
}

async function pollJobUntilDone(jobId: string, backendKey: string) {
  while (true) {
    const job = await getJob(jobId, backendKey);
    const status = job.status;

    if (status === "succeeded" || status === "failed" || status === "canceled") {
      return job;
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}
```

注意：

- 不要用 `progress.percent >= 90` 判断完成
- 必须用 `status` 判断是否结束
- `queued` 表示任务已创建，但可能还在等待执行槽位

## 6. 下载结果

常用接口：

- PDF：`GET /api/v1/jobs/{job_id}/pdf`
- Markdown(JSON)：`GET /api/v1/jobs/{job_id}/markdown`
- Markdown(raw)：`GET /api/v1/jobs/{job_id}/markdown?raw=true`
- Bundle(zip)：`GET /api/v1/jobs/{job_id}/download`

更推荐前端先取任务详情或产物详情，再使用服务端返回的 `actions`：

- `actions.download_pdf.url`
- `actions.open_markdown.url`
- `actions.open_markdown_raw.url`
- `actions.download_bundle.url`

## 7. 完整前端示例

```ts
async function runPdfTranslateFlow(file: File, config: {
  backendKey: string;
  mineruToken: string;
  modelBaseUrl: string;
  modelApiKey: string;
  model: string;
  mode?: "sci" | "precise";
}) {
  const upload = await uploadPdf(file, config.backendKey, false);

  const job = await createJob({
    upload_id: upload.upload_id,
    mineru_token: config.mineruToken,
    base_url: config.modelBaseUrl,
    api_key: config.modelApiKey,
    model: config.model,
    mode: config.mode ?? "sci",
    workers: 50,
    batch_size: 1,
    render_mode: "auto",
  }, config.backendKey);

  const finalJob = await pollJobUntilDone(job.job_id, config.backendKey);

  if (finalJob.status !== "succeeded") {
    throw new Error(finalJob.stage_detail || "job failed");
  }

  return {
    jobId: finalJob.job_id,
    pdfUrl: finalJob.actions.download_pdf.url,
    markdownUrl: finalJob.actions.open_markdown.url,
    bundleUrl: finalJob.actions.download_bundle.url,
  };
}
```

## 8. 前端变量命名建议

建议前端内部把变量分清楚，不要混：

- `backendKey`：Rust API 的 `X-API-Key`
- `mineruToken`：MinerU 的 key
- `modelBaseUrl`：模型服务 URL
- `modelApiKey`：模型服务 key
- `model`：模型名

这样后面接多服务商时不会乱。
