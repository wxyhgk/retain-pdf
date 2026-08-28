# Render Options Contract

Tài liệu này quy định các tham số `render` mà Rust API nhận từ bên ngoài. Nguyên tắc:

- Rust API là điểm vào hợp đồng tham số, chịu trách nhiệm về giá trị mặc định, giá trị cho phép và xác thực cơ bản.
- Worker Python chỉ tiêu thụ stage spec do Rust ghi ra, không còn tự suy diễn ngữ nghĩa mặc định.
- Các tùy chọn render mới phải được cập nhật ở đây, `API_SPEC.md`, xác thực Rust và logic ghi stage spec.

## Trường hiện tại

| Trường | Kiểu | Giá trị mặc định | Giá trị cho phép / Phạm vi | Mô tả |
| --- | --- | --- | --- | --- |
| `render.render_mode` | string | `auto` | `auto`, `overlay`, `typst`, `typst_visual`, `dual` | Đường dẫn render chính. `auto` sẽ do Python chọn chế độ thực tế dựa trên khả năng chỉnh sửa PDF và đặc trưng trang. |
| `render.compile_workers` | integer | `0` | `>= 0` | Biên dịch Typst song song. `0` nghĩa là dùng chiến lược mặc định worker. |
| `render.typst_font_family` | string | `Source Han Serif SC` | Chuỗi phi cấu trúc | Họ font tiếng Trung mặc định Typst. |
| `render.pdf_compress_dpi` | integer | `0` | `>= 0` | DPI nén ảnh PDF. `0` nghĩa là không nén ảnh thêm. |
| `render.translated_pdf_name` | string | `""` | Chuỗi tên tệp bất kỳ | Tên tệp PDF đầu ra. Giá trị rỗng dùng đặt tên mặc định backend. |
| `render.body_font_size_factor` | number | `0.95` | `> 0` và finite | Hệ số nhân toàn cục kích thước chữ thân văn bản. |
| `render.body_leading_factor` | number | `1.08` | `> 0` và finite | Hệ số nhân toàn cục khoảng cách dòng thân văn bản. |
| `render.font_unify_mode` | string | `role_min` | `role_min`, `off` | Chiến lược thống nhất font. `role_min` thống nhất theo vai trò đến cận dưới ổn định, `off` tắt thống nhất nhưng không tắt quy tắc fit/va chạm/nền. |
| `render.source_cleanup_strategy` | string | `pikepdf_text_strip` | `typst_fill`, `pikepdf_text_strip`, `bbox_text_strip`, `legacy`, `redact_restore_formulas` | Chiến lược xử lý văn bản gốc. Mặc định trước làm xóa text-op cấp đường dẫn, sau đó khối nền Typst làm phủ che trực quan; `typst_fill` có thể tắt xóa rõ ràng. |
| `render.inner_bbox_shrink_x` | number | `0.0` | `>= 0` và finite | Co ngang bbox thông thường. |
| `render.inner_bbox_shrink_y` | number | `0.0` | `>= 0` và finite | Co dọc bbox thông thường. |
| `render.inner_bbox_dense_shrink_x` | number | `0.0` | `>= 0` và finite | Co ngang bbox dày đặc. |
| `render.inner_bbox_dense_shrink_y` | number | `0.0` | `>= 0` và finite | Co dọc bbox dày đặc. |

## `source_cleanup_strategy`

Đây là công tắc hành vi render quan trọng nhất hiện tại.

- `typst_fill`
  Giữ nguyên lớp văn bản PDF gốc, không chạy bbox text strip. Mỗi khối văn bản có thể dịch được Typst tạo khối dịch có màu nền phủ lên văn bản gốc.
- `pikepdf_text_strip`
  Chiến lược mặc định. Trước khi render, sử dụng pikepdf để xóa các thao tác hiển thị văn bản trong content stream PDF gốc theo bbox; khi gặp bbox `formula` / `display_formula` chỉ coi là vùng bảo vệ, không xóa văn bản bên trong công thức, không bỏ qua toàn bộ trang chỉ vì có công thức hiển thị. Giai đoạn overlay dựa trên `source_text_precleaned_page_indices` để bỏ qua PyMuPDF redaction/visual cover cũ trong trang, phủ che trực quan vẫn do nền khối văn bản Typst đảm nhận.
- `bbox_text_strip`
  Bí danh tương thích, hành vi hiện tại tương đương `pikepdf_text_strip`. Giữ lại cho cấu hình cũ và tác vụ lịch sử.
- `redact_restore_formulas`
  Tương thích với tên cũ, hành vi hiện tại tương đương `pikepdf_text_strip`. Tên được giữ lại để tác vụ lịch sử và spec cũ có thể phát lại; không mở rộng theo ngữ nghĩa "xóa rồi dán lại công thức".
- `legacy`
  Bí danh chiến lược cũ, hành vi hiện tại tương đương `pikepdf_text_strip`.

Lý do sử dụng mặc định `pikepdf_text_strip`:

- Giảm thiểu khả năng văn bản gốc lộ ra từ mép khối nền Typst.
- Xóa text-op ở cấp đường dẫn pikepdf phù hợp hơn với việc ghi PDF chính thức so với redaction PyMuPDF cũ.
- Bbox `formula` / `display_formula` được giữ lại làm vùng bảo vệ, phủ che trực quan vẫn do khối nền Typst đảm nhận.
- Nếu loại PDF nào có rủi ro xóa cao hơn, có thể thiết lập rõ ràng `typst_fill` để chỉ phủ.

## Ánh xạ Stage Spec

Stage spec do Rust ghi ra phải bao gồm các trường sau:

- `provider.spec.json.render.source_cleanup_strategy`
- `book.spec.json.render.source_cleanup_strategy`
- `render.spec.json.params.source_cleanup_strategy`
- `translate.spec.json.params.render_prewarm_source_cleanup_strategy`

Khi làm nóng render source trong giai đoạn dịch phải sử dụng `source_cleanup_strategy` nhất quán với render cuối cùng, nếu không manifest làm nóng sẽ không hiệu lực do fingerprint không khớp.

## Ảnh chụp nhanh Job

Khi mỗi tác vụ được tạo, Rust API sẽ ghi các tham số render đã giải quyết vào:

```text
DATA_ROOT/jobs/<job_id>/artifacts/render_config.json
```

Tệp này là ảnh chụp nhanh cấu hình render chính thức khi gỡ lỗi một tác vụ lịch sử, artifact key là `render_config_json`.
`pipeline_summary.json` của Python có thể bổ sung kết quả chạy và chẩn đoán, nhưng không thay thế ảnh chụp nhanh cấu hình phía Rust này.

## Quy tắc sửa đổi

Khi thêm hoặc sửa tham số render, phải hoàn thành đồng thời:

1. Cập nhật giá trị mặc định `RenderInput` của Rust.
2. Cập nhật xác thực Rust.
3. Cập nhật ghi stage spec và Python loader.
4. Cập nhật `API_SPEC.md` và tài liệu này.
5. Ít nhất thêm một bài kiểm tra xác thực Rust hoặc kiểm tra stage spec.

Đừng để Python âm thầm chấp nhận giá trị không xác định và quay về mặc định. Giá trị không xác định nên trả về `400` ngay tại lớp Rust API để vấn đề frontend có thể bộc lộ sớm.
