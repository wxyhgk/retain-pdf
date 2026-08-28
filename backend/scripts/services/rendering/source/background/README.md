# rendering/source/background

## Trách nhiệm

Tầng xử lý nền. Chịu trách nhiệm phát hiện ảnh nền lớn, trích xuất ảnh, tái tạo nền cục bộ và chồng trang nền.

## Lối vào công khai

- `detect.py`
- `extract.py`
- `fill.py`
- `patch.py`
- `config.py`
- `sampling.py`
- `stage.py`
- `redaction_items.py`

## Không nên làm gì

- Không quyết định cách dàn trang văn bản dịch.
- Không thực hiện chiến lược xóa tầng văn bản.
- Không gọi biên dịch Typst.
- Không thay thế `page_profile/` làm phân loại trang toàn cục.
- Không mượn tham số tái tạo nền hoặc helper lấy mẫu từ `source.cleanup`; tham số đường dẫn ảnh nền đặt trong
  thư mục này.
