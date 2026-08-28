# Tài liệu Rust API

Đây là điểm vào tài liệu tương thích trong thư mục `backend/rust_api`.

API HTTP bên ngoài, giao diện thư viện, giao diện tác vụ, tải sản phẩm, luồng sự kiện và ngữ nghĩa xóa xem thống nhất tại:

- [Tổng lối vào API backend RetainPDF](../../../doc/core/api/index.md)

Triển khai backend và ranh giới cộng tác xem:

- [Lối vào kiến trúc Rust API](../../../doc/core/rust_api/README.md)
- [Chuỗi chính vận hành hiện tại](../CURRENT_API_MAP.md)
- [Hợp đồng thực thi Stage](../STAGE_EXECUTION_CONTRACT.md)
- [Hợp đồng OCR Provider](../OCR_PROVIDER_CONTRACT.md)
- [Hợp đồng tham số render](../RENDER_OPTIONS_CONTRACT.md)
- [Ranh giới thư mục](../RUST_API_DIRECTORY_MAP.md)

Nguyên tắc:

- `doc/core/api/index.md` là nguồn duy nhất cho API bên ngoài.
- `backend/rust_api/docs/*` không còn duy trì chi tiết giao diện thứ hai.
- `backend/rust_api/API_SPEC.md` được giữ lại làm tham khảo lịch sử/triển khai, không phải tài liệu đọc đầu tiên cho frontend.
