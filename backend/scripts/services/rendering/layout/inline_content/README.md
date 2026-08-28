# Hướng dẫn Inline Content Rendering

`services/rendering/layout/inline_content/` chịu trách nhiệm một việc:

Chuyển đổi "văn bản dịch có chứa công thức, Markdown, nội dung inline Typst" thành dạng văn bản sẵn sàng cho giai đoạn bố cục.

Nơi đây không chịu trách nhiệm:

- Phát hiện công thức OCR
- Gọi mô hình dịch
- Bố cục trang PDF
- Biên dịch toàn bộ trang Typst

Nó chỉ là một module nhỏ trong chuỗi kết xuất, chịu trách nhiệm "cách văn bản công thức đi vào chuỗi chính kết xuất".

## Nguyên tắc thiết kế hiện tại

Phần này hiện đã được tách thành hai luồng:

- `core/`
  Chuỗi chính. Chứa logic mà kết xuất bình thường sẽ luôn đi qua.
- `fallback/`
  Chuỗi dự phòng. Chứa tương thích lịch sử, đường dẫn placeholder, sửa chữa LaTeX-ish, kết xuất công thức PNG.

Không sử dụng lại các tên thư mục mơ hồ như `shared/`, `modes/`.

## Thư mục hiện tại

```text
layout/inline_content/
  README.md
  __init__.py
  mode_router.py
  core/
    __init__.py
    inline_math.py
    markdown.py
  fallback/
    __init__.py
    latex_normalizer.py
    placeholder_markdown.py
    png_renderer.py
```

## Chuỗi chính đi như thế nào

Luồng mặc định hiện tại:

1. Thượng nguồn cung cấp `protected_text`, `formula_map`, `math_mode`
2. `mode_router.py` quyết định đi đường nào
3. Nếu là `direct_typst`
   Đi trực tiếp qua `core/inline_math.py` + `core/markdown.py`
4. Nếu là `placeholder`
   Đi qua `fallback/placeholder_markdown.py`
5. Đầu ra cuối cùng là markdown/văn bản thuần, giao cho layout / typst / redaction

Nghĩa là:

- `mode_router.py` chỉ chịu trách nhiệm phân phối
- `core/` chịu trách nhiệm xử lý văn bản chuỗi chính
- `fallback/` chịu trách nhiệm đường dẫn cũ và khả năng dự phòng

## Trách nhiệm các tệp

### `mode_router.py`

Trách nhiệm duy nhất: chọn đường dẫn theo `math_mode`.

Hiện chỉ nên làm:

- `item_render_math_mode`
- `is_direct_typst_math_mode`
- `build_render_markdown`
- `build_item_render_markdown`

Không nên chất chi tiết làm sạch công thức ở đây.

### `core/inline_math.py`

Chịu trách nhiệm xử lý nhẹ cấp inline math.

Chủ yếu:

- Nhận diện `$...$` hiện có
- Chỉ thay thế văn bản trên các đoạn không phải toán học
- Làm sạch tương thích tối thiểu ở chế độ `direct_typst`
- Bổ sung khoảng trắng cần thiết cho công thức nội tuyến

Nên giữ nhẹ, không nhét logic placeholder vào đây.

### `core/markdown.py`

Chịu trách nhiệm xây dựng văn bản markdown chuỗi chính.

Chủ yếu:

- Xây dựng markdown có thể kết xuất từ văn bản thông thường
- Nâng cấp inline math
- Xử lý văn bản dạng trích dẫn
- Cung cấp hỗ trợ xây dựng văn bản thuần

Đây đại diện cho "quy tắc văn bản công thức mà đường dẫn chính thực sự muốn giữ".

### `fallback/placeholder_markdown.py`

Chịu trách nhiệm đường dẫn công thức placeholder.

Đầu vào thường là:

- `protected_text`
- `formula_map`

Trách nhiệm:

- Cắt văn bản theo token
- Điền công thức bằng `formula_map`
- Khôi phục trích dẫn thành văn bản thông thường khi cần
- Cuối cùng gọi xử lý văn bản markdown của chuỗi chính

Nếu sau này loại bỏ hoàn toàn placeholder, tệp này sẽ tiếp tục thu nhỏ.

### `fallback/latex_normalizer.py`

Chịu trách nhiệm sửa chữa công thức LaTeX-ish cũ.

Đây không phải khả năng cốt lõi của chuỗi chính, mà là lớp tương thích:

- Sửa lỗi OCR phổ biến
- Xử lý định dạng lịch sử
- Cung cấp đầu vào ổn định hơn cho placeholder / PNG fallback

Nếu một quy tắc chỉ phục vụ dữ liệu cũ, đừng đưa vào `core/`, đặt ở đây.

### `fallback/png_renderer.py`

Chịu trách nhiệm chuyển đổi một công thức đơn lẻ thành PNG.

Khả năng này chủ yếu dùng cho:

- Đường dẫn redaction
- Đường dẫn dự phòng khi một số công thức không thể kết xuất dạng văn bản

Nó không đại diện cho chuỗi chính.

Chuỗi chính hiện tại vẫn ưu tiên văn bản / direct typst, thay vì chuyển tất cả công thức thành hình ảnh.

## Hướng phụ thuộc

Tầng này phải tuân thủ hướng phụ thuộc sau:

- `mode_router -> core`
- `mode_router -> fallback`
- `fallback -> core`
- `core` không phụ thuộc ngược vào `fallback`

Nghĩa là:

- `core` chỉ chứa những thứ thực sự cấp thấp, ổn định, thuộc chuỗi chính
- `fallback` có thể gọi `core`
- Không để `core` import ngược vào `fallback`

Nếu không, dù đã tách thư mục nhưng thực tế vẫn bị ràng buộc.

## Xuất những gì ra bên ngoài

Module bên ngoài thường chỉ nên phụ thuộc vào các giao diện ổn định này:

- `services.rendering.layout.inline_content.mode_router`
- `services.rendering.layout.inline_content.core.markdown`
- `services.rendering.layout.inline_content.core.inline_math`
- `services.rendering.layout.inline_content.fallback.placeholder_markdown`
- `services.rendering.layout.inline_content.fallback.latex_normalizer`
- `services.rendering.layout.inline_content.fallback.png_renderer`

Không tham chiếu các đường dẫn lịch sử đã xóa, ví dụ:

- `services.rendering.formula.*` đã xóa, không sử dụng lại.
- `services.rendering.layout.inline_content.math_utils`
- `services.rendering.layout.inline_content.normalizer`
- `services.rendering.layout.inline_content.typst_formula_renderer`
- `services.rendering.layout.inline_content.shared.*`
- `services.rendering.layout.inline_content.modes.*`

## Gợi ý sửa đổi

Nếu sau này sửa phần này, đánh giá theo thứ tự:

1. Đây có phải logic bắt buộc trong chuỗi chính không?
   Nếu có, ưu tiên đặt trong `core/`
2. Đây có phải placeholder / LaTeX cũ / PNG fallback / tương thích lịch sử không?
   Nếu có, đặt trong `fallback/`
3. Đây có phải chọn đường dẫn không?
   Đặt trong `mode_router.py`
4. Đây có phải lỗi kiểm thử không?
   Đặt vào
   [`devtools/tests/translation/test_formula_math_markers.py`](/home/wxyhgk/tmp/Code/backend/scripts/devtools/tests/translation/test_formula_math_markers.py)

## Các tệp bạn nên xem nhất

Để nhanh chóng hiểu phần này, thứ tự đọc khuyến nghị:

1. [`mode_router.py`](/home/wxyhgk/tmp/Code/backend/scripts/services/rendering/layout/inline_content/mode_router.py)
2. [`core/markdown.py`](/home/wxyhgk/tmp/Code/backend/scripts/services/rendering/layout/inline_content/core/markdown.py)
3. [`core/inline_math.py`](/home/wxyhgk/tmp/Code/backend/scripts/services/rendering/layout/inline_content/core/inline_math.py)
4. [`fallback/placeholder_markdown.py`](/home/wxyhgk/tmp/Code/backend/scripts/services/rendering/layout/inline_content/fallback/placeholder_markdown.py)
5. [`fallback/latex_normalizer.py`](/home/wxyhgk/tmp/Code/backend/scripts/services/rendering/layout/inline_content/fallback/latex_normalizer.py)
6. [`fallback/png_renderer.py`](/home/wxyhgk/tmp/Code/backend/scripts/services/rendering/layout/inline_content/fallback/png_renderer.py)

## Trạng thái hiện tại

Công việc đã hoàn thành ở phần này:

- Tách chuỗi chính `direct_typst` và chuỗi dự phòng placeholder
- Đã loại bỏ các ranh giới giả như `shared/`, `modes/`
- Đã phá bỏ import vòng lặp giữa `core` và `fallback`

Các vấn đề phi logic còn lại:

- Thư mục có `.ipynb_checkpoints`
- Thư mục có `__pycache__`

Những thứ này không ảnh hưởng đến hoạt động, nhưng ảnh hưởng đến trải nghiệm đọc, có thể xóa sau.