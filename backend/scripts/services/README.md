# Hướng dẫn Services

`scripts/services/` là lớp triển khai khả năng cụ thể.

Ở đây chứa các module thực sự thực thi công việc, không phải điều phối quy trình:

- `ocr_provider/`
  Quy ước độc lập cho lớp tích hợp API OCR provider. Ở đây chỉ định nghĩa "cách tích hợp dịch vụ OCR bên thứ ba", không ghép nối chi tiết API provider vào quy trình dịch/render.
- `document_schema/`
  Định nghĩa phiên bản cấu trúc tài liệu trung gian thống nhất, adapter registry, thu gọn defaults, kiểm tra schema và normalization report.
- `mineru/`
  Triển khai cụ thể cho provider MinerU: gửi, thăm dò, tải xuống, giải nén, sắp xếp sản phẩm tác vụ.
- `pipeline_shared/`
  Giao thức giai đoạn, summary, luồng sự kiện `pipeline_events.jsonl` thống nhất và JSON IO dùng chung cho luồng chính provider / translate / render, không ràng buộc với bất kỳ provider đơn lẻ nào.
- `translation/`
  Phân tích OCR, điều phối metadata dịch, lọc chiến lược, gọi LLM, điền lại kết quả.
- `rendering/`
  Xóa PDF, xử lý nền, tạo Typst, điều chỉnh công thức, render và nén cuối cùng.

Nguyên tắc thiết kế:

- `services/*` chịu trách nhiệm hoàn thiện từng khả năng riêng lẻ
- `ocr_provider/` chỉ định nghĩa quy ước tích hợp provider, không đảm nhận triển khai provider cụ thể
- `document_schema/` chịu trách nhiệm định nghĩa lớp trung gian thống nhất, không chứa chi tiết provider
- JSON gốc của OCR provider phải được chuyển thành `document.v1` thông qua `document_schema/adapters.py` trước
- Khi cần kiểm tra chuyển đổi raw -> normalized, ưu tiên xem `document.v1.report.json` hoặc `validate_document_schema.py --adapt`
- Nếu chỉ cần tiêu thụ tóm tắt provider / defaults / validation, ưu tiên đi qua `document_schema/reporting.py`
- `mineru/` là một triển khai provider, không phải chính quy trình làm việc OCR tổng thể
- `pipeline_shared/` là lớp chia sẻ trung lập, không nên chứa logic riêng của provider nữa
- Luồng chính `translation/ocr` ưu tiên đọc tài liệu đã normalized, thay vì phụ thuộc trực tiếp vào JSON gốc của một OCR provider nào đó
- `runtime/pipeline` chỉ chịu trách nhiệm xâu chuỗi các khả năng này lại với nhau
- Điểm vào tầng trên ưu tiên phụ thuộc vào `runtime/pipeline`, không trực tiếp ghép quy trình giữa các service
- Cấu hình chung và công cụ chia sẻ tiếp tục được chuyển xuống `foundation/`

## Đường dẫn ngắn nhất cho OCR Provider mới

Khi tích hợp provider mới, đường dẫn ngắn nhất được khuyến nghị là:

1. Đọc trước `ocr_provider/README.md`
2. Đọc tiếp `document_schema/README.md`
3. Chuẩn bị fixture raw tối thiểu
4. Viết lớp tích hợp API provider và adapter
5. Thêm fixture vào `devtools/tests/document_schema/fixtures/registry.py`
6. Chạy `devtools/tests/document_schema/regression_check.py`

Chỉ khi chuỗi này chạy thông suốt, provider mới nên tiến vào luồng chính translation/rendering.

## Quy tắc phối hợp

Hiện có thể phân chia người chịu trách nhiệm theo module, nhưng phải tuân thủ ranh giới theo giao thức:

- Người chịu trách nhiệm OCR / provider chủ yếu duy trì `ocr_provider/`, `mineru/`, `document_schema/`
- Người chịu trách nhiệm dịch chủ yếu duy trì `translation/`
- Người chịu trách nhiệm render chủ yếu duy trì `rendering/`
- Người chịu trách nhiệm điều phối chủ yếu duy trì `runtime/pipeline/`

Nguyên tắc mặc định:

- Mỗi người chịu trách nhiệm ưu tiên giải quyết vấn đề trong module của mình, không phát tán phán đoán đặc biệt tạm thời sang module khác
- `document.v1.json`, `translation-manifest.json`, giao thức đầu vào render-only là các điểm giao tiếp ổn định, không được sửa đổi đơn phương
- Nếu phải thay đổi giao thức giao tiếp, phải đồng thời cập nhật README, điểm vào gọi, logic tương thích và kiểm thử ở cả thượng nguồn và hạ nguồn
- Luồng chính translation / rendering cấm phụ thuộc lại vào JSON gốc của provider
- pipeline chỉ chịu trách nhiệm điều phối, không chịu trách nhiệm hấp thụ phán đoán đặc biệt của provider, chi tiết dịch hoặc bản vá render
