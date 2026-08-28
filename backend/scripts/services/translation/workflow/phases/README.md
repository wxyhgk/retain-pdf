# Giai đoạn dịch

Thư mục này dùng để chứa cài đặt giai đoạn dịch cấp độ toàn sách.

Kế hoạch tách:

- `continuation.py`
  Sắp xếp đoạn liên tục ban đầu, và rà soát đoạn liên tục xuyên cột/xuyên trang có provider hỗ trợ.
- `policy.py`
  Giai đoạn chiến lược trang và phân loại khối.
- `batch_translation.py`
  Tầng thích ứng giai đoạn dịch hàng loạt. Nó nên gọi mã scheduling, không tự quản lý chi tiết hàng đợi.
- `repair.py`
  Tái tạo văn bản lỗi, sửa chữa agent và thu gom phần chưa dịch cuối cùng.
- `events.py`
  Nếu định dạng sự kiện tiếp tục tăng, helper sự kiện giai đoạn ổn định đặt tại đây.

Không đưa provider HTTP client, render prewarm hoặc logic khám phá tệp trang vào đây.
