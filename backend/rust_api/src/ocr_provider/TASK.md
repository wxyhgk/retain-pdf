# Nhiệm vụ tái cấu trúc MinerU Provider Rust

Mục tiêu:

- Xây dựng tầng API OCR provider độc lập trong `rust_api`
- Trước tiên triển khai provider `MinerU`
- Không tiếp tục gắn chi tiết API MinerU vào quy trình làm việc dịch/kết xuất hiện tại
- Chuyển đổi trạng thái, lỗi và thông tin sản phẩm thô của provider thành cấu trúc Rust ổn định, thuận tiện cho việc gỡ lỗi và tích hợp các OCR API khác sau này

## Phạm vi

Lần này chỉ sửa `rust_api`.

Cho phép sửa:

- `rust_api/src/**`
- Cần thiết thì bổ sung `rust_api/api.md` / `rust_api/API_SPEC.md`

Không sửa:

- Luồng chính Python dịch
- Luồng chính Python kết xuất
- Hợp đồng chính `document_schema`

## Mục tiêu thư mục

Tạo tầng provider độc lập mới trong `rust_api/src/`, hình dạng khuyến nghị:

- `ocr_provider/mod.rs`
- `ocr_provider/types.rs`
- `ocr_provider/mineru/mod.rs`
- `ocr_provider/mineru/client.rs`
- `ocr_provider/mineru/models.rs`
- `ocr_provider/mineru/status.rs`
- `ocr_provider/mineru/errors.rs`

Có thể điều chỉnh theo triển khai, nhưng yêu cầu:

- Mã API MinerU được đặt trong thư mục riêng
- Ánh xạ trạng thái riêng
- Ánh xạ lỗi riêng
- Không tiếp tục chất các lệnh gọi HTTP MinerU trong `routes/` hoặc `job_runner.rs`

## Mục tiêu bắt buộc

### 1. Định nghĩa các kiểu cơ bản của tầng OCR provider

Ít nhất cần các kiểu:

- `OcrProviderKind`
- `OcrTaskState`
- `OcrTaskHandle`
- `OcrTaskStatus`
- `OcrArtifactSet`
- `OcrProviderCapabilities`

Yêu cầu:

- `OcrTaskState` là trạng thái thống nhất nội bộ, không lộ trực tiếp giá trị trạng thái thô của MinerU
- Nhưng `OcrTaskStatus` phải giữ trường trạng thái thô của provider để tiện gỡ lỗi

Trạng thái thống nhất khuyến nghị ít nhất bao gồm:

- `Queued`
- `WaitingUpload`
- `Running`
- `Converting`
- `Succeeded`
- `Failed`
- `Unknown`

### 2. Triển khai ánh xạ trạng thái thô MinerU -> trạng thái nội bộ

Cần bao phủ các trạng thái đã xuất hiện rõ ràng trong README:

- `waiting-file`
- `pending`
- `running`
- `converting`
- `done`
- `failed`

Yêu cầu:

- Giữ nguyên chuỗi trạng thái thô
- Đồng thời cung cấp trạng thái thống nhất nội bộ
- Cung cấp điểm vào tạo văn bản stage/detail có thể đọc được

### 3. Triển khai ánh xạ lỗi thô MinerU -> phân loại lỗi nội bộ

Ít nhất phải xử lý được:

- Lỗi HTTP status
- Lỗi xác thực
- Yêu cầu tạo liên kết tải lên thất bại
- Tải lên thất bại
- Polling timeout
- Provider trả về failed
- Tải kết quả thất bại
- Giải nén kết quả thất bại
- Cấu trúc provider trả về thiếu trường

Yêu cầu:

- Loại lỗi không chỉ là chuỗi
- Cần giữ lại message/code/trace_id thô của provider và các ngữ cảnh khác
- Dễ dàng để tầng API trả về lỗi rõ ràng

### 4. Tách các lệnh gọi API MinerU thành client độc lập

Ít nhất tổ chức được:

- Yêu cầu tạo liên kết tải lên
- Tải tệp lên
- Truy vấn trạng thái batch/task
- Tải kết quả

Yêu cầu:

- `job_runner.rs` không còn trực tiếp đảm nhận ngữ nghĩa API MinerU
- Tầng route chỉ tiếp nhận yêu cầu và trả về phản hồi
- Client provider chịu trách nhiệm gọi HTTP và phân tích phản hồi

### 5. Bổ sung đầu ra trạng thái và thông tin thô để gỡ lỗi

Đây là điểm quan trọng, không chỉ làm "chạy được".

Ít nhất phải có:

- Trạng thái thô của provider
- task_id / batch_id của provider
- trace_id
- Mã lỗi / thông báo lỗi thô
- full_zip_url có sẵn không
- Trạng thái các giai đoạn: yêu cầu tạo liên kết tải lên, tải lên, polling

Nếu phù hợp, có thể gắn vào:

- Trường mở rộng artifacts / diagnostics của job
- Hoặc cấu trúc provider diagnostics mới

Yêu cầu:

- Frontend và giao diện gỡ lỗi sau này có thể tiêu thụ trực tiếp
- Tránh phải đọc nhật ký dài để gỡ lỗi sau này

### 6. Bổ sung kiểm thử tối thiểu

Ít nhất bổ sung:

- Kiểm thử ánh xạ trạng thái
- Kiểm thử ánh xạ lỗi
- Kiểm thử phân tích phản hồi quan trọng

Nếu có thời gian, bổ sung thêm:

- Kiểm thử văn bản trạng thái provider

## Không phải mục tiêu

Lần này không làm:

- Không sửa Python `services/mineru/`
- Không sửa `document_schema`
- Không chuyển toàn bộ quy trình làm việc sang Rust
- Không bắt đầu tích hợp OCR provider thứ hai

## Nguyên tắc kỹ thuật

- Đây chỉ là tầng API provider, không phải tầng quy trình làm việc nghiệp vụ
- MinerU là một triển khai provider, không phải hợp đồng chính của hệ thống
- Các OCR API khác sau này cũng nên tái sử dụng được trừu tượng của tầng này
- Bạn không chỉ đang viết "hỗ trợ MinerU", bạn đang viết "bộ khung đa OCR provider đầu tiên"

## Yêu cầu bàn giao

Sau khi hoàn thành, vui lòng cung cấp:

1. Các tệp đã thêm/sửa
2. Các kiểu ổn định hiện có của tầng provider
3. Các trạng thái MinerU đã bao phủ
4. Các phân loại lỗi đã bao phủ
5. Đã chạy những kiểm thử nào / `cargo check`