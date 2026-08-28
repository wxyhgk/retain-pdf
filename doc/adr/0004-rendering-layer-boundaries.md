# 0004 Phân tầng lớp kết xuất theo workflow/analysis/source/layout/output

## Bối cảnh

Lớp kết xuất đồng thời xử lý chân dung trang, làm sạch PDF gốc, tái tạo nền, sắp chữ bản dịch, tạo Typst và ghi PDF. Cấu trúc cũ phát triển tự nhiên theo các tệp kỹ thuật, dẫn đến việc chồng chất logic cầu nối giữa `source`, `layout`, `output`, khi sửa font, chiến lược xóa hoặc overlay về sau dễ ảnh hưởng lẫn nhau.

Các vấn đề điển hình:

- `source/background` vừa xây dựng layout block, vừa redaction, vừa hợp nhất overlay.
- Khả năng lưu PDF chung đặt trong `output/pdf_writer.py`, khiến lớp source phụ thuộc ngược vào output.
- `layout/typography/measurement.py` đồng thời chứa đo lường bbox, dự đoán số dòng, độ gọn, ứng cử viên văn bản và cỡ chữ cơ sở trang.
- `RenderLayoutBlock` và `RenderBlock` tồn tại song song, tính toán trường lặp lại.

## Quyết định

Thư mục cấp một của lớp kết xuất được phân tầng theo trách nhiệm ổn định:

- `workflow`: Điều phối quy trình.
- `analysis`: Thông tin trang/tài liệu và đánh giá lộ trình.
- `document`: Khả năng chung cấp tài liệu, ví dụ metadata, page map, hỗ trợ lưu PDF.
- `source`: Chuẩn bị, làm sạch, tái tạo nền và nén PDF gốc.
- `layout`: Sắp chữ bản dịch, font, giãn dòng, fit bbox, mô hình khối kết xuất.
- `output`: Xuất Typst/PDF overlay.
- `legacy`: Tương thích với lối vào cũ, không chứa logic mới.

Lần tái cấu trúc này đã thực hiện một số ranh giới:

- `source/background/redaction_plan.py` chỉ tiêu thụ `RenderBlock`, không còn gọi `layout.payload.blocks`.
- `build_render_blocks` được chuyển lên lớp cầu nối `output/typst/source_page_overlay.py`.
- `save_optimized_pdf` và `strip_page_links` được đưa xuống `document/pdf_ops.py`.
- `layout/model/block_view.py` làm khung nhìn thống nhất `RenderLayoutBlock -> RenderBlock`.
- `output/typst/block_fields.py` thống nhất tính toán trường bbox/font/màu của Typst emitter.
- Đường dẫn overlay Typst sử dụng "vùng chứa văn bản có nền riêng", không còn xuất các khối `rect(...)` trắng độc lập cho các khối dịch thông thường.
- `layout/typography/measurement.py` giữ xuất khẩu tương thích, logic thực tế được tách sang các mô-đun đơn trách nhiệm.

## Hậu quả

- Mã mới không thể import xuyên lớp tùy tiện, phải thông qua `backend/scripts/devtools/check_pipeline_architecture.py`.
- `legacy/` chỉ có thể re-export hoặc tương thích với các caller cũ, không được chứa logic mới.
- `source` có thể thao tác đối tượng trang PDF, nhưng không được biết chi tiết xuất Typst, cũng không tự xây dựng layout payload.
- `layout` chỉ tạo ra mô hình sắp chữ, không trực tiếp làm sạch PDF hoặc tạo Typst.
- Lớp output có thể làm cầu nối, nhưng cần tránh đưa các phán đoán OCR/dịch vào.
- Che phủ trực quan và làm sạch lớp văn bản được xử lý riêng. Nền vùng chứa văn bản Typst/Word chỉ phụ trách lớp trực quan, lớp văn bản PDF gốc vẫn do chiến lược `source/cleanup` / redaction đảm nhiệm.

## Xác minh

Xác minh cơ bản hiện tại:

```bash
python3 -m pytest backend/scripts/devtools/tests/rendering -q
python3 -m pytest backend/scripts/devtools/tests/text_layout -q
python3 -m compileall -q backend/scripts
python3 backend/scripts/devtools/check_pipeline_architecture.py
```

Hồi quy render-only PDF thực tế:

```bash
python3 backend/scripts/devtools/run_golden_flow.py \
  --job-root data/jobs/golden-fullflow-book-20260511170519 \
  --render-only \
  --bbox-item p001-b013

python3 backend/scripts/devtools/run_golden_flow.py \
  --job-root data/jobs/golden-pseudo-20260512-full \
  --render-only \
  --bbox-item p001-b013
```

Hai mẫu này lần lượt bao phủ PDF bài báo có thể chỉnh sửa và PDF giả có thể chỉnh sửa.

## Phương án thay thế

- Tiếp tục phân chia theo tệp tự nhiên, không thêm kiểm tra ranh giới. Nhanh trong ngắn hạn, nhưng sẽ tiếp tục tích lũy các bản vá xuyên lớp.
- Trực tiếp đưa vào `tach` hoặc `import-linter`. Có hệ thống hơn, nhưng hiện tại `check_pipeline_architecture.py` đã đủ để giữ các ranh giới quan trọng trước.
- Hợp nhất một lần `RenderLayoutBlock` và `RenderBlock`. Lý thuyết sạch hơn, nhưng sẽ ảnh hưởng đồng thời đến xuất Typst, redaction và page spec, rủi ro cao; trước tiên sử dụng `block_view` để thống nhất dần dần.
