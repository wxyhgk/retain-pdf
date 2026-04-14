# 前端请求示例

这份文档面向前端接入，给出最常用的调用顺序、请求头、请求体和示例代码。

配合主文档使用：

- [API 文档总入口](/home/wxyhgk/tmp/Code/doc/API.md)

文档约定：

- 前端请求示例统一以分组后的正式请求结构为准
- 旧版扁平字段已经移除，不再接受
- Rust 侧内部已经拆成 `job_requests`、`job_helpers`、`job_factory`、`job_validation` 四类辅助模块；前端只需要关心接口契约，不需要依赖这些内部模块名

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

可选但建议前端同步支持的字段：

- `translation.math_mode`：公式翻译模式
  - `placeholder`：默认模式，沿用旧的公式保护链
  - `direct_typst`：实验模式，不做公式 placeholder 保护，直接让模型输出正文 + `$...$` 数学

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

上传限制说明：

- 当前后端默认不额外限制 PDF 大小和页数
- 如果部署方配置了 `RUST_API_UPLOAD_MAX_BYTES` / `RUST_API_UPLOAD_MAX_PAGES`，以前端实际收到的服务端报错为准

## 4. 创建任务

请求：

```http
POST /api/v1/jobs
X-API-Key: your-rust-api-key
Content-Type: application/json
```

### 4.1 DeepSeek 示例

推荐请求体：

```json
{
  "workflow": "mineru",
  "source": {
    "upload_id": "20260327-abc123"
  },
  "ocr": {
    "provider": "mineru",
    "mineru_token": "your-mineru-api-key"
  },
  "translation": {
    "base_url": "https://api.deepseek.com/v1",
    "api_key": "your-deepseek-api-key",
    "model": "deepseek-chat",
    "mode": "sci",
    "math_mode": "placeholder",
    "workers": 50,
    "batch_size": 1,
    "glossary_id": "glossary-20260411-abc123",
    "glossary_entries": [
      {"source": "band gap", "target": "带隙", "note": "materials"}
    ]
  },
  "render": {
    "render_mode": "auto"
  }
}
```

### 4.2 OpenAI 兼容接口示例

```json
{
  "workflow": "mineru",
  "source": {
    "upload_id": "20260327-abc123"
  },
  "ocr": {
    "provider": "mineru",
    "mineru_token": "your-mineru-api-key"
  },
  "translation": {
    "base_url": "http://127.0.0.1:10001/v1",
    "api_key": "your-openai-compatible-api-key",
    "model": "Q3.5-turbo",
    "mode": "precise",
    "math_mode": "placeholder",
    "workers": 4,
    "batch_size": 1,
    "glossary_id": "",
    "glossary_entries": []
  },
  "render": {
    "render_mode": "auto"
  }
}
```

前端示例：

```ts
type CreateJobPayload = {
  workflow?: "mineru";
  source: {
    upload_id: string;
  };
  ocr: {
    provider?: "mineru" | "paddle";
    mineru_token: string;
    page_ranges?: string;
  };
  translation: {
    base_url: string;
    api_key: string;
    model: string;
    mode?: "sci" | "precise";
    math_mode?: "placeholder" | "direct_typst";
    workers?: number;
    batch_size?: number;
    rule_profile_name?: string;
    custom_rules_text?: string;
    glossary_id?: string;
    glossary_entries?: Array<{
      source: string;
      target: string;
      note?: string;
    }>;
  };
  render?: {
    render_mode?: string;
    compile_workers?: number;
  };
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

- `source.upload_id`
- `ocr.mineru_token`
- `translation.base_url`
- `translation.api_key`
- `translation.model`

另外：

- `base_url` 必须以 `http://` 或 `https://` 开头

`translation.math_mode` 当前约定：

- 不传时默认 `placeholder`
- 前端若要开放实验开关，建议文案直接写成“公式直出实验模式”
- `direct_typst` 只影响翻译阶段的公式处理链路，不改变渲染接口调用方式

### 4.4 术语表怎么传

推荐做法：

- 前端维护“命名术语表”列表时，先调用 `POST /api/v1/glossaries` 保存，任务里只传 `translation.glossary_id`
- 如果只是单次任务临时术语，直接传 `translation.glossary_entries`
- 如果用户上传的是 Excel，前端先解析成 JSON；后端不直接解析 Excel
- 如果前端手里只有 CSV 文本，可以先调用 `POST /api/v1/glossaries/parse-csv` 转成标准条目

合并规则：

- 命名术语表是基础层
- 任务内 `glossary_entries` 是覆盖层
- 相同 `source` 以任务内条目为准

当前行为边界：

- 术语表 v1 只参与提示词注入和结果统计
- 不做翻译完成后的强制文本替换

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

最近任务列表接口同样会返回协议聚合：

- `items[].invocation`
- `invocation_summary.stage_spec_count`
- `invocation_summary.unknown_count`

注意：

- 不要用 `progress.percent >= 90` 判断完成
- 必须用 `status` 判断是否结束
- `queued` 表示任务已创建，但可能还在等待执行槽位
- 任务详情里的 `invocation` 可直接用于展示当前任务使用的 stage spec 协议
  - `invocation.input_protocol`
  - `invocation.stage_spec_schema_version`

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
  mathMode?: "placeholder" | "direct_typst";
}) {
  const upload = await uploadPdf(file, config.backendKey, false);

  const job = await createJob({
    workflow: "mineru",
    source: {
      upload_id: upload.upload_id,
    },
    ocr: {
      provider: "mineru",
      mineru_token: config.mineruToken,
    },
    translation: {
      base_url: config.modelBaseUrl,
      api_key: config.modelApiKey,
      model: config.model,
      mode: config.mode ?? "sci",
      math_mode: config.mathMode ?? "placeholder",
      workers: 50,
      batch_size: 1,
    },
    render: {
      render_mode: "auto",
    },
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
- `mathMode`：公式翻译模式，默认 `placeholder`

## 9. `math_mode` 什么时候该开

建议前端先按“高级选项 / 实验开关”处理，不要默认打开。

- 普通任务：传 `placeholder` 或干脆不传
- 高公式密度文档，且你想减少 placeholder 校验失败 / 长尾重试：可试 `direct_typst`
- 如果后续前端要做开关，推荐直接传字符串，不要自己在前端推断文档是否“公式很多”

这样后面接多服务商时不会乱。
