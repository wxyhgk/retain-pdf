# 0003 Sử dụng kiểm tra kiến trúc để bảo vệ ranh giới mô-đun Python

## Bối cảnh

Với sự tăng trưởng liên tục của OCR, dịch thuật, kết xuất, máy tính để bàn và Rust API, việc chỉ dựa vào trí nhớ con người không thể duy trì ranh giới mô-đun lâu dài. Số lượng tệp không phải là vấn đề, vấn đề thực sự là import xuyên lớp, phụ thuộc vòng và rò rỉ trường riêng của nhà cung cấp.

## Quyết định

Trong ngắn hạn, sử dụng `backend/scripts/devtools/check_pipeline_architecture.py` đã có trong kho lưu trữ để củng cố ranh giới cốt lõi của backend Python và tích hợp vào CI.

Về lâu dài, có thể đánh giá việc đưa vào `tach`, `import-linter` hoặc `grimp`, nhưng sẽ không thêm phụ thuộc mới trước khi xác minh lợi ích.

Các hướng phải bảo vệ hiện tại:

- `runtime/pipeline` chỉ điều phối, không phụ thuộc trực tiếp vào raw provider, translation internals, rendering internals.
- `translation` và `rendering` không tiêu thụ JSON thô của provider.
- `typst` không import ngược `redaction`.
- `layout` không import `source_pdf`, `typst`, `redaction`.
- `ocr_provider` không phụ thuộc vào translation/rendering.

## Hậu quả

- Các vi phạm cấu trúc sẽ thất bại trong kiểm tra kiến trúc.
- Các mô-đun mới phải nằm trong ranh giới hiện có hoặc cập nhật tài liệu kiến trúc và quy tắc kiểm tra.
- Không phải tất cả ranh giới đều bị chặn cùng lúc, trước tiên chặn các hướng dễ bị ăn mòn nhất.

## Phương án thay thế

- Chỉ viết README và dựa vào quy ước. Phương án này chi phí thấp, nhưng sẽ mất hiệu lực lâu dài.
- Ngay lập tức đưa vào công cụ quản lý phụ thuộc của bên thứ ba đầy đủ. Phương án này có hệ thống hơn, nhưng cần đánh giá chi phí cấu hình và độ ổn định CI.
