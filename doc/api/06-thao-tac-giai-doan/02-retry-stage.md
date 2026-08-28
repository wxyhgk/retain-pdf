# retry-stage

## Giao diện

```http
POST /api/v1/jobs/{job_id}/retry-stage
```

Được sử dụng để người dùng chủ động thực thi lại quy trình từ một giai đoạn nào đó.

## Ví dụ yêu cầu

```json
{
  "stage": "translation",
  "mode": "from_stage",
  "create_new_job": true,
  "overrides": {
    "translation": {
      "model": "deepseek-v4-flash",
      "workers": 100
    },
    "render": {
      "compile_workers": 8
    }
  }
}
```

## Ngữ nghĩa giai đoạn

- `ocr`: Tái sử dụng source PDF, chạy lại OCR -> dịch -> kết xuất.
- `translation`: Tái sử dụng source PDF + kết quả OCR, chạy lại dịch -> kết xuất.
- `render`: Tái sử dụng source PDF + kết quả OCR + kết quả dịch, chỉ chạy lại kết xuất.

## Ví dụ phản hồi

```json
{
  "job_id": "new-job-id",
  "source_job_id": "old-job-id",
  "status": "queued",
  "workflow": "book",
  "rerun_from_stage": "translation",
  "reused_artifacts": ["source_pdf", "ocr_result"],
  "rerun_stages": ["translation", "render"]
}
```

Sau khi frontend nhận được `job_id` mới, chuyển thẳng vào vòng lặp polling thông thường.

## Sự khác biệt với resume

- `resume` thiên về khôi phục sau thất bại.
- `retry-stage` là người dùng chủ động chạy lại từ giai đoạn chỉ định, có thể dùng cả với tác vụ thành công.
