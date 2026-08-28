# resources

Thư mục này dùng để chứa tài nguyên cấp kho, tránh việc logo, hoạt hình, file mẫu và runtime cục bộ tiếp tục bị rải rác vào các thư mục mã nguồn như `backend/`, `frontend/`, `desktop/`.

## Phân loại

- `brand/`: logo, mã QR, hình ảnh thương hiệu, ảnh giới thiệu phát hành.
- `animations/`: tài nguyên hiệu ứng động, hoạt hình trình diễn, file nguồn hoạt hình tải.
- `samples/`: PDF mẫu, file đầu vào kiểm thử, mẫu nhỏ có thể công khai.
- `runtime/`: cổng lưu trữ runtime cục bộ hoặc nhị phân nền tảng. Trước khi di chuyển chính thức, không di chuyển trực tiếp các đường dẫn như `backend/python`, `backend/typst-win32`; phải đồng bộ cập nhật script đóng gói.
- `misc/`: tài nguyên tạm thời chưa phân loại. Dọn dẹp định kỳ, tránh tích tụ lâu dài.

## Không khuyến nghị đặt ở đây

- Mã nguồn: tiếp tục để ở `backend/`, `frontend/`, `desktop/`.
- Dữ liệu nhiệm vụ: tiếp tục để ở `data/jobs`, `data/uploads`, `data/downloads`.
- File khóa: không đưa vào kho.
- Sản phẩm xây dựng dung lượng lớn: ưu tiên bỏ qua hoặc đưa vào artifact phát hành, không commit.

## Gợi ý sắp xếp backend

Trong `backend/`, thứ thực sự đáng ngờ không phải mã nguồn, mà là runtime cục bộ và sản phẩm xây dựng:

- `backend/rust_api/target/` là sản phẩm xây dựng Rust, có thể xóa và biên dịch lại.
- `backend/python/` là runtime Python cho Windows desktop, hiện đang được script đóng gói tham chiếu; trước khi di chuyển cần sửa `desktop/scripts/prepare-app.mjs`.
- `backend/typst-win32/` là runtime Typst cho Windows, trước khi di chuyển cũng cần đồng bộ logic đóng gói desktop.

Vì vậy trong ngắn hạn chỉ thêm cổng vào `resources/`, không di chuyển trực tiếp `backend/scripts` hoặc `backend/rust_api`.
