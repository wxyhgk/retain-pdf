# RetainPDF API Wiki

Tài liệu này dành cho frontend, desktop và bên thứ ba tích hợp, mô tả các hợp đồng HTTP API ổn định của backend RetainPDF.

`backend/rust_api/API_SPEC.md` được giữ lại như đặc tả kỹ thuật và ghi chú triển khai cho backend; thư mục này được chia theo các tình huống sử dụng và nên là Wiki chính được đọc trong quá trình gỡ lỗi và tích hợp chung.

## Thông tin cơ bản

- URL cơ sở: `/api/v1`
- Kiểm tra sức khỏe: `GET /health`
- Ngoại trừ `/health`, các giao diện mặc định yêu cầu `X-API-Key`
- Ngoại trừ các giao diện tải xuống tệp, các giao diện mặc định trả về đối tượng JSON được bao bọc

## Liên kết nhanh

- [Định dạng phản hồi](00-quy-uoc/01-dinh-dang-phan-hoi.md)
- [Xác thực & Lỗi](00-quy-uoc/02-xac-thuc-va-loi.md)
- [Tạo Job](01-tac-vu/01-tao-tac-vu.md)
- [Truy vấn chi tiết Job](01-tac-vu/02-truy-van-chi-tiet-tac-vu.md)
- [Danh sách Job](01-tac-vu/03-danh-sach-tac-vu.md)
- [Tổng quan sự kiện](02-su-kien-tien-do/01-tong-quan-su-kien.md)
- [display_stage và lane](02-su-kien-tien-do/02-display-stage-va-lane.md)
- [Danh sách OCR Provider](03-OCR/01-danh-sach-provider.md)
- [Job chỉ OCR](03-OCR/02-ocr-only-tac-vu.md)
- [Plugin local_command](03-OCR/04-local-command-plugin.md)
- [Plugin remote_command](03-OCR/05-remote-command-plugin.md)
- [Tham số dịch thuật](04-dich/01-tham-so-dich.md)
- [Đồng thời & Lô dịch](04-dich/02-dong-thoi-va-batch.md)
- [Bảng thuật ngữ](04-dich/03-thuat-ngu.md)
- [Chế độ ghi nhớ thuật ngữ theo ngữ cảnh](04-dich/04-ngu-canh-thuat-ngu-ghi-nho.md)
- [translate.stage.v1](04-dich/05-translate-stage-spec.md)
- [Quy trình dịch thuật](04-dich/06-luong-cong-viec-dich.md)
- [Sự kiện dịch thuật](04-dich/07-su-kien-dich.md)
- [Tổng quan hành động giai đoạn](06-thao-tac-giai-doan/01-stage-actions.md)
- [Thử lại giai đoạn](06-thao-tac-giai-doan/02-retry-stage.md)
- [Tổng quan tải xuống](07-tai-artifact/01-tong-quan-tai.md)
- [Cấu trúc thất bại](08-chan-doan-go-loi/01-cau-truc-that-bai.md)
- [API gỡ lỗi dịch thuật](08-chan-doan-go-loi/02-translation-debug.md)

## Phân vùng API hiện tại

### Jobs

- `POST /api/v1/jobs`
- `GET /api/v1/jobs`
- `GET /api/v1/jobs/{job_id}`
- `POST /api/v1/jobs/{job_id}/cancel`
- `POST /api/v1/jobs/{job_id}/rerun`

### OCR

- `POST /api/v1/ocr/jobs`
- `GET /api/v1/ocr/jobs/{job_id}`
- `GET /api/v1/ocr/jobs/{job_id}/events`
- `GET /api/v1/ocr/jobs/{job_id}/artifacts`
- `GET /api/v1/ocr/jobs/{job_id}/artifacts-manifest`
- `GET /api/v1/ocr/jobs/{job_id}/normalized-document`
- `GET /api/v1/ocr/jobs/{job_id}/normalization-report`
- `POST /api/v1/ocr/jobs/{job_id}/cancel`
- `GET /api/v1/providers/ocr`

### Sự kiện & Chẩn đoán

- `GET /api/v1/jobs/{job_id}/events`
- `GET /api/v1/jobs/{job_id}/diagnostics`
- `GET /api/v1/jobs/{job_id}/translation/diagnostics`
- `GET /api/v1/jobs/{job_id}/translation/items`
- `GET /api/v1/jobs/{job_id}/translation/items/{item_id}`
- `POST /api/v1/jobs/{job_id}/translation/items/{item_id}/replay`

### Hành động giai đoạn

- `GET /api/v1/jobs/{job_id}/resume-plan`
- `POST /api/v1/jobs/{job_id}/resume`
- `GET /api/v1/jobs/{job_id}/stage-actions`
- `POST /api/v1/jobs/{job_id}/retry-stage`

### Tải xuống sản phẩm

- `GET /api/v1/jobs/{job_id}/artifacts`
- `GET /api/v1/jobs/{job_id}/artifacts-manifest`
- `GET /api/v1/jobs/{job_id}/artifacts/{artifact_key}`
- `GET /api/v1/jobs/{job_id}/pdf`
- `GET /api/v1/jobs/{job_id}/pdf/side-by-side`
- `GET /api/v1/jobs/{job_id}/cover`
- `GET /api/v1/jobs/{job_id}/thumbnail`
- `GET /api/v1/jobs/{job_id}/preview/pages/{page}`
- `GET /api/v1/jobs/{job_id}/markdown`
- `GET /api/v1/jobs/{job_id}/markdown/document`
- `GET /api/v1/jobs/{job_id}/markdown/images/{path}`
- `GET /api/v1/jobs/{job_id}/download`

## Nguyên tắc đọc Frontend

- Ưu tiên đọc `display_stage` cho trạng thái chính; không đoán giai đoạn bằng regex trên `message` hoặc `stage_detail`.
- Ưu tiên đọc `substage` cho các giai đoạn phụ.
- Chỉ đọc các sự kiện hoặc ảnh chụp chi tiết với `lane=main` cho tiến trình chính.
- `lane=background` chỉ được sử dụng cho các trạng thái phụ như tiền xử lý nền, làm nóng trước, bộ nhớ đệm, v.v.
- `message` và `stage_detail` chỉ dành cho văn bản đọc được của con người và không nên được sử dụng cho logic nghiệp vụ.
- Ưu tiên sử dụng URL do API trả về để hiển thị tệp và hình ảnh; không xây dựng đường dẫn tệp cục bộ trực tiếp.
