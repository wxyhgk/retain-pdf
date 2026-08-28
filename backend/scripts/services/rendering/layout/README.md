# rendering/layout

## Trách nhiệm

Tầng dàn trang. Chuyển payload đã dịch thành khối có thể render, tính toán font, khoảng cách dòng, thích ứng bbox và bố cục khối văn bản.

## Lối vào công khai

- `page_specs.py`
- `font_fit.py`
- `chinese_body_fit.py`
- `fit_decision/`
- `title_fit.py`
- `payload/`
- `typography/`
- `typography_memory/`
  Thư viện kinh nghiệm font/khoảng cách dòng xuyên sách. Chỉ cache giá trị thống kê `font_size_pt`, `leading_em` tương ứng với đặc trưng hình học lượng tử hóa, dùng làm tiên nghiệm nhanh cho seed render.

## Không nên làm gì

- Không thao tác trang PDF gốc.
- Không xóa văn bản tiếng Anh gốc.
- Không gọi OCR provider hoặc mô hình dịch.
- Không quyết định tuyến redaction/background toàn trang.

## typography memory

`typography_memory/` là thư viện scalar dàn trang toàn cục, học tăng dần, mặc định lưu tại `data/_render_typography_memory/typography_memory.sqlite3`.

Ranh giới:

- Chỉ cho phép ghi nhận quyết định scalar như kích thước font, khoảng cách dòng.
- Key chỉ được tạo từ đặc trưng cấu trúc đã lượng tử hóa như bbox, kích thước trang, vai trò, số dòng, tỷ lệ công thức, mật độ bản dịch.
- Không cache nội dung gốc, bản dịch, công thức, màu sắc, chiến lược xóa, page spec hoặc đối tượng PDF.
- Điều kiện khớp phải bảo thủ; khi số mẫu không đủ hoặc phương sai quá lớn thì lùi về thuật toán gốc.

Công tắc:

- `RETAIN_RENDER_TYPOGRAPHY_MEMORY=0` tắt đọc/ghi.
- `RETAIN_RENDER_TYPOGRAPHY_MEMORY_MIN_OBS` điều chỉnh số mẫu tối thiểu cần thiết để khớp.
