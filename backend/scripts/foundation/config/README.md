# Mô tả phân tầng Config

`scripts/foundation/config` dùng để quản lý tập trung cấu hình, tránh tầng chia sẻ tiếp tục gánh tất cả trách nhiệm.

## Kết quả tách

- `paths.py`
  Chỉ chứa cấu hình liên quan đường dẫn, ví dụ `ROOT_DIR`, `DATA_DIR`, `OUTPUT_DIR`, `SOURCE_PDF`.
- `fonts.py`
  Chỉ chứa cấu hình liên quan font và kích thước chữ, ví dụ đường dẫn font mặc định, kích thước chữ mặc định, họ font Typst mặc định.
- `runtime.py`
  Chỉ chứa mục mặc định runtime, ví dụ số trang mặc định, tên đầu ra mặc định, DPI nén PDF.
- `layout.py`
  Chỉ chứa cấu hình tinh chỉnh bố cục, cùng `apply_layout_tuning(...)`.

## Chiến lược tương thích

Hiện vẫn giữ `scripts/foundation/shared/config.py` làm facade tương thích.

Cách viết cũ thường gặp trong mã lịch sử là:

```python
from foundation.config.paths import OUTPUT_DIR
from foundation.config.layout import apply_layout_tuning
```

Sau này nếu muốn dần giải ghép, có thể chuyển import các module sang nguồn rõ ràng hơn:

- Liên quan đường dẫn ưu tiên dùng `foundation.config.paths`
- Liên quan font ưu tiên dùng `foundation.config.fonts`
- Tinh chỉnh bố cục ưu tiên dùng `foundation.config.layout`
- Giá trị mặc định runtime ưu tiên dùng `foundation.config.runtime`
