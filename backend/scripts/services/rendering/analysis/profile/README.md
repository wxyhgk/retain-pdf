# rendering/analysis/profile

## Trách nhiệm

Tầng hồ sơ sự thật đơn trang. Chỉ thu thập sự thật, ví dụ kích thước trang, tầng văn bản, ảnh nền, đối tượng vector và tóm tắt OCR bbox.

PDF giả chỉnh sửa, PDF dạng ảnh, trang phức tạp hỗn hợp, trang nặng vector đều phải chuẩn hóa về
`RenderPageProfile.kind` tại đây trước. Tầng thực thi không được tái tổ hợp phán đoán kiểu "ảnh nền + tầng chữ + đối tượng vector",
nếu không source cleanup, hidden text strip, overlay route sau đó sẽ lại phân nhánh.

## Lối vào công khai

- `builder.py`
- `models.py`
- `registry.py`

## Không nên làm gì

- Không quyết định chiến lược redaction.
- Không thao tác nội dung trang PDF.
- Không sinh Typst hoặc khối bố cục.
- Không thay đổi phân loại của cùng một trang tùy ngữ cảnh gọi.

Khi thêm chiều hồ sơ mới, ưu tiên thêm một tệp `.py` độc lập, rồi để `builder.py` tổng hợp.
