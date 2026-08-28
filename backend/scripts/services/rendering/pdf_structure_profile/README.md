# PDF Structure Profile

`pdf_structure_profile` ghi nhận khung cấu trúc có sẵn trong PDF gốc, không phải khung OCR, cũng không ghi màu sắc.

Nên sinh sau khi OCR normalized hoàn tất, trước khi bắt đầu dịch, vì nó chỉ phụ thuộc:

- PDF gốc
- `item_id/bbox` của normalized item, dùng để xây dựng ánh xạ từ OCR item sang text object nội tại PDF

Tệp đầu ra đề nghị đặt tên `pdf_structure_profile.v1.json`, giai đoạn xóa sau này có thể đọc trực tiếp:

- `text_objects`: Khung PDF text object từ `page.get_bboxlog()`.
- `text_spans`: Khung visible text span từ `page.get_text("dict")`.
- `path_objects`: Khung path/vector từ bboxlog, bao gồm marker chặn xóa vật lý.
- `image_objects`: Khung image từ bboxlog.
- `form_xobjects`: Khung XObject từ `page.get_xobjects()`.
- `item_hits`: Ánh xạ overlap tốt nhất giữa OCR item và PDF text object.

Profile này là tầng sự thật cho chiến lược xóa, không quyết định xóa hay không, cũng không sửa PDF.
