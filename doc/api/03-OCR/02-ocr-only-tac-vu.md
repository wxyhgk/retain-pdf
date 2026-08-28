# Job chỉ OCR

## Endpoint tạo

```http
POST /api/v1/ocr/jobs
```

Được sử dụng để chạy chỉ nhà cung cấp OCR và tạo tài liệu chuẩn hóa, không chuyển sang dịch hoặc kết xuất.

## Endpoint truy vấn

```http
GET /api/v1/ocr/jobs/{job_id}
GET /api/v1/ocr/jobs/{job_id}/events
GET /api/v1/ocr/jobs/{job_id}/artifacts
GET /api/v1/ocr/jobs/{job_id}/artifacts-manifest
GET /api/v1/ocr/jobs/{job_id}/normalized-document
GET /api/v1/ocr/jobs/{job_id}/normalization-report
POST /api/v1/ocr/jobs/{job_id}/cancel
```

## Lưu ý yêu cầu

Đối với các job chỉ OCR, `workflow` luôn là `ocr`, trong khi nhà cung cấp OCR vẫn được xác định bởi `ocr.provider`.

## Sản phẩm

Các sản phẩm cốt lõi sau khi thành công:

- `source_pdf`
- `provider_result_json`
- `provider_raw_dir`
- `normalized_document_json`
- `normalization_report_json`

`normalized_document_json` là hợp đồng trung gian OCR duy nhất mà dịch và kết xuất sau này nên sử dụng.
