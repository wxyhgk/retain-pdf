# Hướng dẫn Kết xuất

`scripts/services/rendering` chịu trách nhiệm chuyển đổi dữ liệu trang đã dịch thành PDF cuối cùng.

Module này không xử lý dịch thuật hoặc phân tích OCR, chỉ tập trung vào "cách kết xuất, cách bố trí, cách xuất ra".

## Ranh giới giai đoạn

Đầu vào và đầu ra chính thức của giai đoạn Kết xuất được cố định như sau:

- Đầu vào:
  PDF nguồn, sản phẩm dịch, tham số kết xuất
- Đầu ra:
  PDF cuối cùng, cùng với các sản phẩm trung gian cần thiết như overlay / typst / nén

Ngoài phạm vi:

- Tiêu thụ trực tiếp JSON OCR thô của provider
- Chịu trách nhiệm chuẩn hóa OCR thô thành `document.v1.json`
- Chịu trách nhiệm gửi yêu cầu đến mô hình dịch hoặc tạo văn bản đã dịch

Các điểm chuyển giao ổn định hiện tại:

- Mainline kết xuất chỉ chấp nhận tập đầu vào "PDF nguồn + sản phẩm dịch"
- Giai đoạn kết xuất đọc cố định `translation-manifest.json`; các thư mục dịch cũ không có manifest sẽ không còn được hỗ trợ để kết xuất trực tiếp
- Giao thức gọi render-only được cố định là: `source_pdf_path + translations_dir` hoặc `source_pdf_path + translation_manifest_path`
- Điểm vào render-only hiện hỗ trợ `job_root/specs/render.spec.json` (`render.stage.v1`)
- Nếu đầu vào không đáp ứng giao thức, điểm vào sẽ ném lỗi `Render-only input error` thống nhất thay vì lỗi mơ hồ trong các giai đoạn Typst/PDF sau
- Nếu nghi ngờ cấu trúc OCR có vấn đề, nên quay lại kiểm tra `document.v1.json` / `document.v1.report.json`
- Nếu nghi ngờ nội dung dịch hoặc chiến lược thuật ngữ có vấn đề, nên quay lại kiểm tra payload dịch thay vì thêm logic dịch tại tầng kết xuất
- Thông tin xác thực API không được ghi vào đặc tả giai đoạn kết xuất; đặc tả sử dụng `credential_ref`, runtime sẽ tiêm khóa thực tế

## Cấu trúc thư mục hiện tại

```text
scripts/services/rendering/
  __init__.py
  README.md
  legacy/          Cổng tương thích cho caller cũ; logic mới không đặt tại đây
  workflow/        Điều phối giai đoạn kết xuất, chỉ điều phối, không xử lý chi tiết PDF/Typst cụ thể
  analysis/        Hồ sơ trang, phân loại trang và quyết định lộ trình trang
  document/        PDF nguồn, ánh xạ số trang, bookmark/mục lục và các hỗ trợ cấp tài liệu
  source/          Chuẩn bị PDF gốc, làm sạch, tái tạo nền và nén
  layout/          Tính toán bố cục từ khối dịch sang khối kết xuất
  output/          Tạo mã nguồn Typst, biên dịch, tổng hợp overlay và ghi PDF
```

Thứ tự đọc hiểu được khuyến nghị:

`workflow -> document/analysis -> source/layout -> output`

`legacy/` là cổng tương thích cho caller cũ, không nên tiếp tục thêm logic nghiệp vụ vào đây.

## Đường dẫn kết xuất chính

Đường dẫn chính hiện tại có thể tóm tắt như sau:

`translation JSON -> layout/payload -> output/typst -> PDF`

Tầng trên thường gọi khả năng này thông qua [render_stage.py](/home/wxyhgk/tmp/Code/backend/scripts/runtime/pipeline/render_stage.py).

Ranh giới đầu vào:

- Mainline kết xuất tiêu thụ page payload đã dịch và PDF nguồn
- Translation payload theo trang và `translation-manifest.json` là sản phẩm mặc định từ upstream; tầng kết xuất chỉ đọc, không chịu trách nhiệm định nghĩa giao thức giai đoạn OCR/dịch
- Nếu upstream chỉ muốn chạy lại kết xuất, có thể truyền rõ `translation_manifest_path`, không cần phụ thuộc vào việc quét thư mục cố định
- JSON thô của OCR provider không nên chảy trực tiếp vào đây
- Nếu cấu trúc OCR upstream có vấn đề, nên quay lại kiểm tra `document.v1.json` / `document.v1.report.json`, thay vì bổ sung xử lý đặc biệt cho provider ở tầng kết xuất

## Phân công module

- `legacy/`
  Cổng tương thích cho caller cũ. Logic nghiệp vụ mới không được viết tại đây, chỉ chuyển tiếp đến module cụ thể.
- `workflow/`
  Điều phối quy trình kết xuất, chịu trách nhiệm chọn chế độ, kết nối Typst/nền/redaction, không trực tiếp viết thuật toán phức tạp.
- `workflow/render_only.py`
  Điểm vào wrapper cho worker render-only.
- `analysis/profile/`
  Tầng thu thập thông tin thực tế của từng trang. Chỉ trả lời "trang này như thế nào", không quyết định cách kết xuất.
- `analysis/route/`
  Tầng quyết định lộ trình cho từng trang. Chỉ quyết định lộ trình dựa trên profile, không trực tiếp thao tác PDF.
- `layout/payload/`
  Chuyển đổi OCR payload đã dịch thành khối có thể kết xuất.
- `layout/typography/`
  Tầng đo lường bố cục và công cụ hình học.
- `layout/inline_content/`
  Chuẩn hóa văn bản nội tuyến cho công thức, Markdown, Typst.
- `source/render_source.py`
  Chuẩn bị PDF nguồn trước khi kết xuất, bao gồm tách văn bản ẩn và chọn bản sao nén.
- `source/cleanup/`
  Trực tiếp thao tác đối tượng trang PDF, chịu trách nhiệm xóa chữ, phủ nền và ghi lại.
- `source/background/`
  Tái tạo nền cục bộ cho các trang có hình nền lớn.
- `source/compression/`
  Nén PDF dạng ảnh.
- `output/typst/`
  Chịu trách nhiệm chuyển đổi khối kết xuất thành mã nguồn Typst và biên dịch thành PDF.
- `output/pdf_writer.py`
  Re-export tương thích cho import cũ; mã mới ưu tiên sử dụng `document/pdf_ops.py`.
- `document/pdf_ops.py`
  Hỗ trợ chung cho lưu PDF và xử lý liên kết trang. Đây là khả năng cơ bản cấp tài liệu, không thuộc tầng đầu ra Typst.
- `document/pikepdf_overlay.py` / `document/pikepdf_pages.py`
  Điểm vào ưu tiên cho cấu trúc PDF chính thức. Dùng để hợp nhất overlay cấp luồng nội dung, sao chép toàn bộ/chọn trang và tối ưu hóa cấp đường dẫn.
- `layout/model/`
  Cấu trúc dữ liệu chung cho tầng kết xuất và helper văn bản bố cục.
- `layout/page_specs.py`
  Lắp ráp đặc tả kết xuất cấp trang, kết nối translation payload, hình học trang và tầng đầu ra.

## Chiến lược phủ nền

Đường dẫn Typst overlay ưu tiên sử dụng "khối văn bản tự mang nền":

```typst
place(...,
  block(width: ..., height: ..., fill: ...)[
    Nội dung đã dịch
  ]
)
```

Không còn xuất riêng một lớp `rect(...)` trắng rồi mới xuất văn bản cho các khối dịch thông thường. Khối văn bản tự mang nền giúp nền trắng và văn bản gắn kết tự nhiên, giảm số lớp, lệch vị trí và các vấn đề về thứ tự phủ.

Cần phân biệt hai việc:

- Phủ thị giác: được thực hiện bởi `fill` của khối Typst hoặc khung văn bản nền trắng Word.
- Làm sạch tầng văn bản: vẫn do `source/cleanup` và chiến lược redaction thực hiện, không thể chỉ dùng phủ thị giác để thay thế.

## Nguyên tắc ghi PDF

Việc sửa đổi cấu trúc PDF của sản phẩm chính thức ưu tiên sử dụng `pikepdf`:

- Xóa text-op trong content stream
- Xóa văn bản ẩn
- Hợp nhất toàn bộ Typst overlay
- Hợp nhất overlay Typst fallback từng trang khi không cần sửa trang nguồn
- Hợp nhất overlay PDF đơn khi không cần sửa trang nguồn
- Xóa text-op dạng rect theo đường dẫn
- Sao chép PDF, trích xuất chọn trang và viết lại cấu trúc
- Nén/thay thế đối tượng ảnh

PyMuPDF chủ yếu được giữ lại cho các tình huống đọc và phân tích:

- Phân tích kích thước trang, văn bản, bbox, hình vẽ
- Chụp màn hình và xem trước gỡ lỗi
- Lấy mẫu màu, phát hiện thụt đầu dòng, v.v.

Không thêm các thao tác ghi phá hủy mới bằng PyMuPDF vào mainline mới:

- Không thêm `apply_redactions`
- Không thêm `show_pdf_page` để làm hợp nhất overlay chính thức
- Không thêm `insert_pdf + doc.save` để làm đường dẫn sao chép cấu trúc

Các thao tác ghi PyMuPDF hiện tại chỉ được giữ lại cho legacy/fallback. Khi di chuyển, ưu tiên sử dụng `document/pikepdf_*` hoặc các công cụ cấp đường dẫn trong `source_cleanup`.
`remove_text_under_rects_with_pymupdf_redaction` trong trang thuộc phạm vi legacy redaction; việc làm sạch tầng văn bản mới ưu tiên sử dụng khả năng rect-strip pikepdf cấp đường dẫn từ gói `source_cleanup`. Pikepdf text strip chỉ xóa các khối văn bản có thể dịch, bbox `formula` / `display_formula` được giữ lại làm vùng bảo vệ để giữ nguyên công thức PDF gốc; các văn bản/chú thích khác trên trang có công thức vẫn có thể bị xóa, không vì một trang có công thức mà bỏ qua toàn bộ trang.
Quá trình tiền xử lý trước khi kết xuất sẽ truyền `source_text_precleaned_page_indices` đến workflow, bao gồm các trang đã thực sự xóa text-op và các trang phát hiện không có chồng lấn văn bản gốc; giai đoạn overlay sử dụng thông tin này để quyết định có thể bỏ qua visual cover/redaction cũ trong trang hay không.
`source_cleanup_strategy=pikepdf_text_strip` là tên chiến lược chính thức, các cấu hình mới sau này nên sử dụng tên này.
Render diagnostics sẽ ghi lại `legacy_pymupdf_redaction_pages`, `legacy_pymupdf_overlay_pages` và `legacy_pdf_write_reasons`; khi hồi quy với mẫu thực tế, ưu tiên quan sát các giá trị này còn khác 0 hay không.

## Tốc độ biên dịch Typst thuần

Đường dẫn overlay cho tài liệu lớn không nên suy biến thành biên dịch Typst theo từng trang. PDF theo từng trang sẽ nhúng font và tài nguyên lặp lại, khiến dung lượng file cuối dễ bị phình to.

Phân mảnh hiện tại là chiến lược opt-in rõ ràng, không phải đường dẫn mặc định. Mặc định vẫn ưu tiên biên dịch Typst toàn bộ vì thường có dung lượng nhỏ nhất và nhiều tài liệu lớn biên dịch toàn bộ không chậm.

Sau khi bật rõ ràng, chiến lược là phân mảnh khối lớn có kiểm soát dung lượng:

- Chỉ bật khi đặt `RETAIN_TYPST_OVERLAY_CHUNKED=1` và có thể dùng `pikepdf` để hợp nhất overlay cho tài liệu lớn.
- Mặc định bật phân mảnh cho tài liệu > `256` trang, mỗi mảnh `128` trang.
- Mỗi mảnh tạo một overlay PDF nhiều trang, sau đó `pikepdf` hợp nhất một lần trở lại PDF nguồn.
- Tài liệu nhỏ tiếp tục sử dụng biên dịch Typst toàn bộ để giữ dung lượng tối ưu.

Các biến môi trường có thể điều chỉnh:

- `RETAIN_TYPST_OVERLAY_CHUNKED=1` bật biên dịch phân mảnh.
- `RETAIN_TYPST_OVERLAY_CHUNK_MIN_PAGES` điều chỉnh ngưỡng bật phân mảnh.
- `RETAIN_TYPST_OVERLAY_CHUNK_PAGES` điều chỉnh số trang mỗi mảnh. Không nên đặt quá nhỏ trừ khi đã xác nhận dung lượng file có thể chấp nhận được.

## Tái sử dụng Render Prewarm

`render_prewarm` đồng thời cung cấp hai loại sản phẩm:

- Sản phẩm source: PDF nguồn đã tiền xử lý, ứng viên bbox text-strip.
- Sản phẩm payload: thụt đầu dòng, effective inner bbox, hồ sơ màu, page specs chế độ nền.

Giai đoạn render-only phải tái sử dụng cả hai loại sản phẩm. Lưu ý đặc biệt: khi làm mới source manifest đồng bộ, không được xóa `payload_prewarm` hiện có, nếu không overlay rendering sẽ chạy lại payload prepare và lấy mẫu màu.

Trong mẫu 635 trang thực tế, sau khi payload prewarm được kích hoạt:

- `color_adapt_elapsed_seconds` giảm từ khoảng `14.1s` xuống còn khoảng `0.1s`.
- `payload_prepare_elapsed_seconds` giảm từ khoảng `22.3s` xuống còn khoảng `9.9s`.
- Tổng thời gian render-only giảm từ khoảng `49s` xuống còn khoảng `23s`.

## Hồi quy PDF thực

Các mẫu thực tế được đặt tại [resources/samples/golden-pdfs](/home/wxyhgk/tmp/Code/resources/samples/golden-pdfs).

Các lệnh thường dùng:

```bash
python3 backend/scripts/devtools/run_golden_flow.py --check-manifest
python3 backend/scripts/devtools/run_golden_flow.py --list-samples
python3 backend/scripts/devtools/run_golden_flow.py \
  --job-root data/jobs/golden-fullflow-book-20260511170519 \
  --render-only \
  --bbox-item p001-b013
python3 backend/scripts/devtools/run_golden_flow.py \
  --job-root data/jobs/golden-pseudo-20260512-full \
  --render-only \
  --bbox-item p001-b013
```

Tập hồi quy tối thiểu hiện tại:

- `editable-paper-formula`: PDF bài báo có thể chỉnh sửa, bao phủ tầng văn bản, công thức và kết xuất nền Typst thông thường.
- `pseudo-editable`: PDF giả có thể chỉnh sửa, bao phủ rủi ro nền ảnh/scan và rủi ro giữ lại tầng văn bản.

Script hồi quy sẽ kiểm tra:

- Danh sách mẫu hợp lệ.
- Số trang PDF cuối cùng khớp với PDF nguồn.
- Không có mục unresolved trong chẩn đoán dịch.
- Tọa độ đặt Typst của block mẫu khớp với góc trên bên trái của OCR bbox.

## Ranh giới Import

- `runtime/pipeline` chỉ nên gọi các điểm vào ổn định của `workflow/`.
- `analysis/route/` có thể phụ thuộc vào `analysis/profile/`, nhưng `analysis/profile/` không được phụ thuộc ngược vào `analysis/route/`.
- `layout/` không nên gọi source cleanup trực tiếp; nó chỉ tạo khối bố cục/kết xuất.
- `output/typst/` không nên thực hiện lại các phán đoán OCR/dịch; khi cần thông tin trang thực tế, truyền từ profile/route vào.
- `source/cleanup/` có thể thao tác đối tượng trang PDF, nhưng không được tạo mã nguồn Typst.
- Mã mới ưu tiên import module cụ thể, không phụ thuộc vào re-export của `__init__.py` ở gốc package.

## Điểm vào được khuyến nghị

- [render_stage.py](/home/wxyhgk/tmp/Code/backend/scripts/runtime/pipeline/render_stage.py)
- [services/rendering/workflow](/home/wxyhgk/tmp/Code/backend/scripts/services/rendering/workflow)

## Hồi quy công thức

Nếu thêm một quy tắc chuẩn hóa công thức mới, hãy thêm ví dụ không tốt vào bài kiểm tra hồi quy tham số hóa trong
[`devtools/tests/translation/test_formula_math_markers.py`](/home/wxyhgk/tmp/Code/backend/scripts/devtools/tests/translation/test_formula_math_markers.py).

## Quy tắc hợp tác

Nếu module kết xuất được duy trì riêng bởi một người, module này chỉ chịu trách nhiệm "đọc sản phẩm dịch và tạo PDF cuối cùng".

- Cho phép sửa overlay, Typst, xử lý nền, nén, xóa vùng đỏ và điền lại bố cục tại đây
- Không bổ sung xử lý đặc biệt cho OCR provider tại đây, cũng không thêm yêu cầu dịch hoặc logic thay thế thuật ngữ
- Ranh giới đầu vào chính thức là `source_pdf_path + translations_dir/translation_manifest_path`
- Nếu thay đổi giao thức đầu vào kết xuất, cách đọc manifest hoặc cách đặt tên sản phẩm cuối, phải đồng bộ cập nhật `runtime/pipeline`, điểm vào, README và kiểm thử
- Khi gặp vấn đề OCR hoặc dịch từ upstream, ưu tiên đưa vấn đề về module tương ứng để sửa, không chất các bản vá vượt cấp tại tầng kết xuất