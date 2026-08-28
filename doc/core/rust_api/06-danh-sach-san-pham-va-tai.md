# Danh sách sản phẩm và tải xuống

Trước tiên xem ranh giới:

- `provider raw`
- `normalized`
- `published artifact`
- `download API`

Ở đây tài liệu này chủ yếu đề cập đến hai lớp sau:

- `published artifact`
- `download API`

Trách nhiệm phía Rust của hai lớp trước được giải thích tại:

- [10-ranh-gioi-artifact-phia-rust.md](./10-ranh-gioi-artifact-phia-rust.md)

## 1. Tại sao cần danh sách sản phẩm

Thư mục nhiệm vụ là chi tiết triển khai nội bộ của backend, có thể tiếp tục được điều chỉnh sau.

Vì vậy frontend hoặc bên gọi bên ngoài không nên phụ thuộc vào:

- Dưới `rendered/` nhất định có gì đó
- Dưới `md/` nhất định có gì đó
- `ocr/unpacked/` nhất định không đổi

Hiện tại nguồn thực sự chính thức bên ngoài là danh sách sản phẩm ổn định trong cơ sở dữ liệu, sau đó được phơi bày qua API.

## 2. Giao diện chính

Nhiệm vụ chính:

`GET /api/v1/jobs/{job_id}/artifacts-manifest`

Nhiệm vụ con OCR:

`GET /api/v1/ocr/jobs/{job_id}/artifacts-manifest`

## 3. Nó trả về gì

Nó trả về các mục sản phẩm đã được đăng ký của nhiệm vụ này, mỗi mục có:

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

Frontend thực sự nên dùng:

- `artifact_key`
- `ready`
- `resource_path` / `resource_url`

`artifacts` trong giao diện chi tiết phù hợp để đánh giá nhanh trạng thái nút; việc đọc máy hoàn chỉnh lấy `artifacts-manifest` làm chuẩn.

## 4. Artifact_key phổ biến

Hiện tại bao gồm:

- `source_pdf`
  - Nếu yêu cầu đặt `ocr.page_ranges` và đi qua tải lên local, đây trỏ đến PDF tập con được tạo trong nhiệm vụ
- `translated_pdf`
- `typst_source`
- `typst_render_pdf`
- `markdown_raw`
- `markdown_images_dir`
- `markdown_bundle_zip`
- `normalized_document_json`
- `normalization_report_json`
- `layout_json`
- `translation_manifest_json`
- `provider_bundle_zip`
- `provider_result_json`
- `pipeline_summary`
- `events_jsonl`
  - Tương ứng với xuất luồng sự kiện được ghi trong thời gian chạy nhiệm vụ, phù hợp để tải xuống gỡ lỗi

Trong đó ngữ nghĩa phải phân biệt:

- `provider_result_json` / `provider_bundle_zip`
  thuộc `provider raw`
- `normalized_document_json` / `normalization_report_json`
  thuộc `normalized`
- `markdown_raw` / `markdown_bundle_zip` / `translated_pdf`
  thuộc `published artifact`

Còn `/pdf`, `/normalized-document`, `/artifacts/{artifact_key}` thuộc `download API`

PDF đối chiếu không yêu cầu frontend tổng hợp local, gọi trực tiếp:

- `GET /api/v1/jobs/{job_id}/pdf/side-by-side`
- Trả về `application/pdf`
- Backend sẽ đọc PDF nguồn và PDF dịch cuối cùng, tạo và lưu cache
  `jobs/{job_id}/artifacts/{job_id}-side-by-side.pdf`
- Mỗi trang bên trái là bản gốc, bên phải là bản dịch; nếu số trang hai bên không khớp, số trang xuất ra lấy giá trị lớn nhất, bên thiếu để trống
- Trả về `404` khi PDF nguồn hoặc PDF dịch chưa ready

## 5. Cách đọc khuyến nghị

Frontend hoặc script không nên đoán vị trí tệp theo cấu trúc thư mục nữa, mà nên:

1. Yêu cầu `artifacts-manifest` trước
2. Tìm `artifact_key` mục tiêu
3. Kiểm tra `ready`
4. Sử dụng `resource_path` hoặc `resource_url`

Trong đó `markdown_bundle_zip` là gói Markdown phù hợp nhất để frontend tải trực tiếp:

- Chỉ chứa `markdown/full.md`
- Chỉ chứa `markdown/images/**`
- Không chứa PDF gốc
- Không chứa PDF sau dịch
- Không chứa provider bundle
- Không chứa JSON gỡ lỗi khác

Nếu bạn muốn thư mục sau khi giải nén ZIP có mã nhiệm vụ, có thể thêm khi tải xuống trực tiếp:

`?include_job_dir=true`

Lúc đó thư mục gốc sẽ từ mặc định `markdown/` thành:

`{job_id}-markdown/`

Nếu bạn muốn tải xuống luồng sự kiện gốc của nhiệm vụ, cũng có thể tra trực tiếp:

- `artifact_key = events_jsonl`

Ngữ nghĩa của nó là:

- Một sản phẩm gỡ lỗi ổn định
- Nội dung từ `events.jsonl` trong thư mục nhật ký nhiệm vụ
- Phù hợp để gỡ lỗi, xuất, lưu trữ

Nhưng lưu ý:

- Tab "luồng sự kiện" của giao diện frontend vẫn nên ưu tiên đọc giao diện `/events`
- Không khuyến nghị frontend coi `events_jsonl` là nguồn thực sự cho giao diện hiển thị chính

## 6. Quan hệ với giao diện cũ

Giao diện cũ vẫn được giữ, ví dụ:

- `/pdf`
- `/markdown`
- `/normalized-document`

Nhưng bên trong đã bắt đầu hướng tới "tra danh sách sản phẩm trước, sau đó xác định vị trí tệp thực tế".

Có thể hiểu nó như:

- Giao diện cũ là cổng vào tải xuống ổn định
- `artifacts-manifest` là cổng vào phát hiện ổn định
- `artifacts.pdf` / `artifacts.markdown` / `artifacts.bundle` trong chi tiết là các trường trạng thái trang được khuyến nghị
- Các trường cũ cùng cấp như `pdf_url` / `markdown_url` / `bundle_url` chỉ là bí danh tương thích, không khuyến nghị code mới tiếp tục phụ thuộc

Nhưng cần lưu ý một ranh giới:

- "Giao diện cũ" ở đây là các cổng vào tài nguyên ổn định trong API hiện tại
- Không phải là tương thích bố cục thư mục nhiệm vụ cũ

Nếu bản thân nhiệm vụ vẫn đến từ bố cục cũ `originPDF/jsonPDF/transPDF/typstPDF`, hoặc artifact vẫn lưu đường dẫn tuyệt đối, thì các cổng vào tải xuống này cũng sẽ từ chối trực tiếp, phải chạy lại

## 7. Tại sao làm vậy ổn định hơn

Vì sau này dù backend chuyển tệp từ:

- `rendered/...`

sang:

- `outputs/render/...`

Chỉ cần backend cập nhật logic đăng ký cơ sở dữ liệu, giao diện bên ngoài không cần phải thay đổi theo.

Đây chính là mục đích của lần tái cấu trúc này: tách "cấu trúc thư mục" khỏi hợp đồng công khai.
