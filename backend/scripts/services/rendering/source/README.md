# rendering/source

## Trách nhiệm

Tầng chuyển đổi PDF nguồn. Module này chịu trách nhiệm chuyển đổi PDF nguồn thành nền tảng có thể mang nội dung đã dịch.

## Điểm vào công khai

- `render_source.py`
- `rects.py`
- `items.py`
- `document_ops.py`
- `redaction.py`
- `text_redaction.py`
- `vector_profile.py`
- `vector_text.py`
- `preparation/`
- `cleanup/`
- `background/`
- `compression/`
- `dev_overlay/`

## Ngoài phạm vi

- Không tạo Typst.
- Không tính toán bố cục nội dung đã dịch.
- Không gọi mô hình dịch.
- Không xử lý điều phối quy trình.

## Quy ước ranh giới

- `rects.py` chứa các tiện ích hình chữ nhật chung cho tầng nguồn; `background/`, `cleanup/`, và `preparation/` có thể phụ thuộc vào nó.
- `items.py` chứa các helper đọc mục đã dịch, tách token và chuẩn hóa văn bản.
- `document_ops.py` chứa các nguyên thủy thao tác tài liệu PDF chung.
- `redaction.py` là facade cho các chiến lược redaction dọn dẹp trong tầng nguồn; các subpackage bên ngoài không nên import trực tiếp `cleanup.redaction`.
- `text_redaction.py` chứa các nguyên thủy xóa tầng văn bản chung.
- `vector_profile.py` chứa các nguyên thủy thống kê vẽ vector trang chung.
- `vector_text.py` chứa các nguyên thủy phát hiện văn bản vector chung; việc xóa thực tế và sửa nền được quyết định bởi tầng thực thi cleanup/background.
- `dev_overlay/` là đường dẫn dịch vẽ trực tiếp PyMuPDF cũ, chỉ sử dụng cho overlay trực tiếp và gỡ lỗi trang đơn; không mở rộng các quy tắc bố cục đường dẫn kết xuất chính tại đây.
- Các subpackage không nên import lẫn nhau cho các hình học cơ bản chung; di chuyển các tiện ích chung vào `rects.py` trước.
