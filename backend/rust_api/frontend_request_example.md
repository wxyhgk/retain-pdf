# Ví dụ yêu cầu từ frontend

Tài liệu này dành cho frontend, đưa ra thứ tự gọi phổ biến nhất, header, body và mã mẫu.

Kết hợp với tài liệu chính:

- [RetainPDF Backend API Entry](/home/wxyhgk/tmp/Code/doc/core/api/index.md)
- [Rust API README](/home/wxyhgk/tmp/Code/backend/rust_api/README.md)
- [CURRENT_API_MAP](/home/wxyhgk/tmp/Code/backend/rust_api/CURRENT_API_MAP.md)

Quy ước tài liệu:

- Đây là ví dụ cho frontend, không phải nguồn đặc tả giao thức chính thức; các quy tắc chính thức lấy theo `doc/core/api/index.md`
- Các ví dụ yêu cầu frontend đều dựa trên cấu trúc yêu cầu chính thức đã được nhóm lại
- Các trường phẳng cũ đã bị loại bỏ, không còn được chấp nhận
- Frontend chỉ cần quan tâm đến hợp đồng giao diện, không cần phụ thuộc vào tên module nội bộ Rust

## 1. Năm giá trị bạn phải chuẩn bị

Khi gọi Rust API, frontend ít nhất phải chuẩn bị các giá trị sau:

1. `X-API-Key`
2. `mineru_token`
3. `base_url`
4. `api_key`
5. `model`

Ý nghĩa:

- `X-API-Key`: Khóa truy cập backend Rust của bạn
- `mineru_token`: API Key của MinerU
- `base_url`: URL tương thích OpenAI của dịch vụ mô hình
- `api_key`: API Key của dịch vụ mô hình
- `model`: Tên mô hình

Các trường tùy chọn nhưng nên hỗ trợ:

- `translation.math_mode`: Chế độ dịch công thức
  - `direct_typst`: Mặc định, cho mô hình xuất trực tiếp văn bản + `$...$`
  - `placeholder`: Chế độ bảo toàn cũ (cho chuỗi bảo vệ công thức cũ)

## 2. Thứ tự gọi

Thứ tự khuyến nghị cho frontend:

1. Tải lên PDF
2. Dùng `upload_id` trả về để tạo tác vụ
3. Polling trạng thái tác vụ
4. Sau khi thành công, tải PDF / Markdown / Bundle

## 3. Tải lên PDF

Yêu cầu:

```http
POST /api/v1/uploads
X-API-Key: your-rust-api-key
Content-Type: multipart/form-data
```

Ví dụ frontend:

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

Thành công sẽ nhận được:

```json
{
  "upload_id": "20260327-abc123",
  "filename": "paper.pdf",
  "bytes": 1832451,
  "page_count": 18,
  "uploaded_at": "2026-03-27T18:20:31+08:00"
}
```

Giới hạn tải lên:

- Mặc định backend không giới hạn kích thước và số trang PDF
- Nếu triển khai có cấu hình `RUST_API_UPLOAD_MAX_BYTES` / `RUST_API_UPLOAD_MAX_PAGES`, lấy theo lỗi thực tế trả về

## 4. Tạo tác vụ

Yêu cầu:

```http
POST /api/v1/jobs
X-API-Key: your-rust-api-key
Content-Type: application/json
```

Lưu ý:

- `workflow: "book"` mới là giá trị chính thức cho luồng đầy đủ
- Chọn OCR provider qua `ocr.provider`, không qua `workflow`
- Nếu chỉ chạy OCR-only, hãy dùng `POST /api/v1/ocr/jobs`, không dùng `workflow="ocr"` với `/api/v1/jobs`
- Khi gỡ lỗi thủ công local, có thể dùng legacy wrapper `run_provider_case.py`; luồng sản xuất chính do Rust job_runner điều phối
- Nếu đầu vào đã có OCR JSON + PDF, ưu tiên dùng `run_document_flow.py`
- Nếu chỉ chạy OCR-only, ưu tiên dùng `run_provider_ocr.py`

### 4.1 Ví dụ DeepSeek

Body khuyến nghị:

```json
{
  "workflow": "book",
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
    "model": "deepseek-v4-flash",
    "mode": "sci",
    "math_mode": "direct_typst",
    "workers": 50,
    "batch_size": 1,
    "glossary_id": "glossary-20260411-abc123",
    "glossary_entries": [
      {"source": "band gap", "target": "khe năng lượng", "note": "materials"}
    ]
  },
  "render": {
    "render_mode": "auto"
  }
}
```

### 4.2 Ví dụ giao diện tương thích OpenAI

```json
{
  "workflow": "book",
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
    "math_mode": "direct_typst",
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

Ví dụ frontend:

```ts
type CreateJobPayload = {
  workflow?: "book" | "translate" | "render";
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

### 4.3 Kiểm tra bắt buộc hiện tại

`POST /api/v1/jobs` hiện đang kiểm tra bắt buộc:

- `source.upload_id`
- `ocr.mineru_token`
- `translation.base_url`
- `translation.api_key`
- `translation.model`

Thêm vào đó:

- `base_url` phải bắt đầu bằng `http://` hoặc `https://`

`translation.math_mode` quy ước hiện tại:

- Mặc định là `direct_typst` nếu không truyền
- Nếu frontend muốn cung cấp công tắc thử nghiệm, khuyến nghị đặt tên là "Chế độ thử nghiệm công thức trực tiếp"
- `direct_typst` chỉ ảnh hưởng đến cách xử lý công thức trong giai đoạn dịch, không thay đổi cách gọi giao diện kết xuất

### 4.4 Cách truyền bảng thuật ngữ

Cách làm được khuyến nghị:

- Khi frontend quản lý danh sách thuật ngữ, gọi `POST /api/v1/glossaries` để lưu trước, sau đó trong tác vụ chỉ truyền `translation.glossary_id`
- Nếu chỉ là thuật ngữ tạm cho một tác vụ, truyền trực tiếp `translation.glossary_entries`
- Nếu người dùng tải lên Excel, frontend tự phân tích thành JSON; backend không phân tích Excel trực tiếp
- Nếu frontend chỉ có CSV, có thể gọi `POST /api/v1/glossaries/parse-csv` để chuyển thành danh sách chuẩn

Quy tắc hợp nhất:

- Bảng thuật ngữ có tên là lớp cơ sở
- `glossary_entries` trong tác vụ là lớp ghi đè
- Cùng `source` thì lấy entry trong tác vụ

Ranh giới hành vi hiện tại:

- Bảng thuật ngữ v1 chỉ tham gia vào gợi ý prompt và thống kê kết quả
- Không thực hiện thay thế văn bản bắt buộc sau dịch

## 5. Polling trạng thái tác vụ

Yêu cầu:

```http
GET /api/v1/jobs/{job_id}
X-API-Key: your-rust-api-key
```

Ví dụ frontend:

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

Danh sách tác vụ gần đây cũng trả về tổng hợp giao thức:

- `items[].invocation`
- `invocation_summary.stage_spec_count`
- `invocation_summary.unknown_count`

Lưu ý:

- Không dùng `progress.percent >= 90` để xác định hoàn thành
- Phải dùng `status` để xác định kết thúc
- `queued` nghĩa là tác vụ đã tạo, nhưng có thể đang chờ vị trí thực thi
- `invocation` trong chi tiết tác vụ có thể dùng để hiển thị giao thức stage spec đang dùng
  - `invocation.input_protocol`
  - `invocation.stage_spec_schema_version`

## 6. Tải xuống kết quả

Các giao diện thường dùng:

- PDF: `GET /api/v1/jobs/{job_id}/pdf`
- Markdown(JSON): `GET /api/v1/jobs/{job_id}/markdown`
- Markdown(raw): `GET /api/v1/jobs/{job_id}/markdown?raw=true`
- Bundle(zip): `GET /api/v1/jobs/{job_id}/download`

Khuyến nghị frontend lấy chi tiết tác vụ hoặc chi tiết sản phẩm trước, sau đó dùng `actions` do server trả về:

- `actions.download_pdf.url`
- `actions.open_markdown.url`
- `actions.open_markdown_raw.url`
- `actions.download_bundle.url`

## 7. Ví dụ frontend đầy đủ

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
    workflow: "book",
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
      math_mode: config.mathMode ?? "direct_typst",
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

## 8. Gợi ý đặt tên biến frontend

Nên phân biệt rõ các biến, không trộn lẫn:

- `backendKey`: `X-API-Key` của Rust API
- `mineruToken`: key của MinerU
- `modelBaseUrl`: URL dịch vụ mô hình
- `modelApiKey`: key của dịch vụ mô hình
- `model`: tên mô hình
- `mathMode`: chế độ dịch công thức, mặc định `direct_typst`

## 9. Khi nào nên bật `math_mode`

Hiện tại mặc định khuyến nghị là `direct_typst`. Nếu frontend muốn hiển thị công tắc, có thể đặt trong tùy chọn nâng cao, nhưng đừng đặt `placeholder` làm mặc định.

- Tác vụ thông thường: không truyền, hoặc truyền rõ `direct_typst`
- Chỉ khi muốn quay lại chuỗi bảo vệ công thức cũ thì mới truyền `placeholder`
- Nếu sau này có công tắc, khuyến nghị truyền thẳng chuỗi, không tự suy đoán xem tài liệu có nhiều công thức hay không

Như vậy khi kết nối với nhiều nhà cung cấp sẽ không bị lộn xộn.