# Sản phẩm và tải xuống

Bài viết này nói về cách phát hiện và tải xuống sản phẩm của nhiệm vụ.

## Danh sách sản phẩm

Giao diện chính:

- `GET /api/v1/jobs/{job_id}/artifacts-manifest`
- `GET /api/v1/ocr/jobs/{job_id}/artifacts-manifest`

Đây là cổng vào phát hiện chính thức của máy.

Các trường phổ biến mỗi mục:

- `artifact_key`
- `artifact_group`
- `artifact_kind`
- `ready`
- `file_name`
- `content_type`
- `size_bytes`
- `relative_path`
- `checksum`
- `source_stage`
- `updated_at`
- `resource_path`
- `resource_url`

Quy trình khuyến nghị:

1. Truy vấn manifest trước
2. Tìm `artifact_key` mục tiêu
3. Xác nhận `ready=true`
4. Sau đó dùng `resource_path` hoặc `resource_url`

## Artifact phổ biến

- `source_pdf`
- `translated_pdf`
- `typst_source`
- `typst_render_pdf`
- `markdown_raw`
- `markdown_bundle_zip`
- `markdown_images_dir`
- `normalized_document_json`
- `normalization_report_json`
- `translation_manifest_json`
- `provider_result_json`
- `provider_bundle_zip`
- `pipeline_summary`
- `events_jsonl`

## Cổng tải xuống

Các giao diện tải xuống phổ biến:

- `/pdf`
- `/markdown`
- `/normalized-document`
- `/normalization-report`
- `/download`
- `/artifacts/{artifact_key}`
- `/preview/pages/{page}?kind=source|translated&width=1200`

Lưu ý liên quan đến Markdown:

- `/markdown` mặc định trả về JSON được đóng gói
- `/markdown?raw=true` trả về Markdown gốc
- `markdown_bundle_zip` là gói phù hợp nhất để frontend tải trực tiếp

Hình ảnh xem trước cấp trang dùng để dự phòng màn hình đầu của trình đọc:

- Trả về `image/jpeg`
- Sử dụng bộ nhớ đệm mạnh: `Cache-Control: public, max-age=31536000, immutable`
- Trả về `ETag` ổn định
- Được lưu trong bộ nhớ đệm theo job trong `artifacts/`

## Bốn ranh giới

Backend nhìn ra bốn lớp:

- `provider raw`
- `normalized`
- `published artifact`
- `download API`

Không coi cấu trúc thư mục là hợp đồng công khai.

## Cổng vào gỡ lỗi

Nếu nút không thể nhấn, xem trước:

- `actions.*.enabled`
- `artifacts.*.ready`
- `artifacts-manifest.items[].ready`

Nếu tải xuống thất bại, ưu tiên xem:

- `failure`
- `runtime`
- `log_tail`
- `/events`
