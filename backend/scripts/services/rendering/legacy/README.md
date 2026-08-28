# rendering/legacy

## Trách nhiệm

Đây là lối vào tương thích cho bên gọi cũ của tầng render. Nó giữ hình dạng API lịch sử, nhưng tính năng mới không nên viết tiếp vào đây.

## Lối vào công khai

- `pdf_overlay.py`
- `typst_page_renderer.py`
- `background_image_route.py`
- `pdf_compress.py`
- `render_payloads.py`

## Không nên làm gì

- Không thêm logic nghiệp vụ phức tạp mới.
- Không trực tiếp thực hiện chi tiết redaction, layout, biên dịch Typst.
- Không bỏ qua `workflow/` để ghép một luồng render chính mới.

## Quy ước đặt tên

Mã mới ưu tiên import thư mục cài đặt cụ thể, ví dụ:

- `services.rendering.output.typst.*`
- `services.rendering.source.cleanup.*`
- `services.rendering.source.background.*`
- `services.rendering.source.compression.*`

Chỉ thêm wrapper ở đây khi cần tương thích bên gọi cũ.
