# Điểm chuẩn kết xuất 533 trang RetainPDF

Thư mục này trừu tượng hóa job thực `20260514183142-dec42e` thành một benchmark kết xuất tài liệu lớn có thể tái tạo.

Đây không phải bài toán đồ chơi. Mẫu đến từ sách khoa học PDF 533 trang thực, bao gồm văn bản, tiêu đề, chú thích cuối trang, chú thích hình ảnh, công thức nội tuyến,
công thức hiển thị, nền PDF phức tạp, overlay Typst và hợp nhất PDF. Benchmark này dùng để đo lường thuật toán kết xuất dịch tài liệu thực, chứ không phải hiệu suất hàm riêng lẻ.

## Phù hợp để tối ưu hóa gì

- Chiến lược bố cục: phông chữ, dòng, bbox, mật độ thị giác, chiến lược văn bản/tiêu đề/chú thích cuối/chú thích hình
- Trình xây dựng nguồn Typst: tốc độ và cấu trúc tạo `.typ` từ JSON dịch
- Biên dịch Typst: thời gian biên dịch với đầu vào `.typ` cố định
- Chuẩn bị nguồn: xóa bbox text strip, làm nóng, chuẩn bị PDF nền
- Overlay PDF: hợp nhất overlay và lưu
- Hiệu suất end-to-end render-only

## Đường cơ sở hiện tại

Trên máy phát triển hiện tại, benchmark warm đã được xác minh:

```text
case: quantum_chem_533
pages: 533
render elapsed: 20.66s
overlay diagnostics total: 18.94s
payload prepare: 3.08s
Typst source prepare: 7.36s
Typst compile: 6.18s
PDF merge: 2.13s
source cleanup: 0.00s
```

Biên dịch riêng Typst case đã xuất:

```text
Typst compile only: 6.28s
```

Những con số này không phải mục tiêu cuối cùng, chỉ là đường cơ sở tham khảo trên mã hiện tại và máy hiện tại.

## Quy trình một phút

Nếu máy cục bộ đã có job nguồn:

```bash
python3 experiments/render-benchmark-533/scripts/materialize.py --overwrite
python3 experiments/render-benchmark-533/scripts/check_env.py
python3 experiments/render-benchmark-533/scripts/run_render_benchmark.py --run-id my-run --overwrite
```

Xem kết quả:

```bash
cat experiments/render-benchmark-533/runs/my-run/report.json
```

Xuất và kiểm thử Typst riêng:

```bash
python3 experiments/render-benchmark-533/scripts/export_typst_case.py --run-id my-run --overwrite
python3 experiments/render-benchmark-533/scripts/compile_typst_case.py --typst-case my-run --run-id compile-1 --overwrite
```

## Yêu cầu dữ liệu

Chỉ clone mã không thể chạy trực tiếp benchmark 533 trang này.

Lý do là benchmark phụ thuộc vào PDF thực, JSON OCR, JSON dịch và sản phẩm làm nóng. Dữ liệu này có dung lượng lớn và PDF gốc có thể liên quan đến quyền phân phối, vì vậy mặc định không đưa trực tiếp vào kho mã.

Người có thể chạy cần đáp ứng một trong các điều kiện sau:

1. Máy cục bộ đã có job nguồn:

   ```text
   data/jobs/20260514183142-dec42e/
   ```

2. Hoặc nhận được gói dữ liệu benchmark và giải nén thành:

   ```text
   experiments/render-benchmark-533/case-data/quantum_chem_533/job/
   ```

Các thư mục chính được sử dụng trong job nguồn:

```text
source/
translated/
ocr/normalized/
specs/
artifacts/render_prewarm/
```

Trong đó `translated/` khoảng 54MB, `ocr/normalized/` khoảng 87MB, `source/` khoảng 10MB,
`artifacts/render_prewarm/` khoảng 11MB. Job nguồn đầy đủ sẽ lớn hơn.

## Phụ thuộc môi trường

Môi trường khuyến nghị:

- Linux x86_64
- Python 3.10+
- Mã nguồn kho RetainPDF
- Các phụ thuộc Python backend đã cài
- Typst CLI có thể thực thi
- PyMuPDF / `fitz` có thể import
- Phông chữ Trung Quốc khả dụng, mặc định hiện tại `Source Han Serif SC`

Kiểm tra nhanh:

```bash
python3 experiments/render-benchmark-533/scripts/check_env.py
```

Ví dụ máy phát triển hiện tại:

```text
Python 3.10.12
Typst 0.14.2
PyMuPDF OK
```

Giải thích:

- Đường dẫn render-only thông thường không cần OCR API hoặc dịch API.
- Nếu biên dịch Typst thất bại và kích hoạt fallback sửa LLM, có thể đọc `RETAIN_TRANSLATION_API_KEY`.
- Khi tổ chức cuộc thi công khai, khuyến nghị tắt fallback mạng, hoặc quy định fallback kích hoạt là thất bại, tránh kết quả không so sánh được.
- Khi cung cấp cho người tham gia bên ngoài, nên cung cấp Docker image hoặc script cài đặt, nếu không phông chữ và phiên bản Typst sẽ ảnh hưởng đến kết quả.

## Cấu trúc thư mục

```text
experiments/render-benchmark-533/
  case.json                  # Thông tin case, hash, đường cơ sở tham khảo
  README.md
  scripts/
    materialize.py           # Tạo case-data cục bộ từ job nguồn
    check_env.py             # Kiểm tra phụ thuộc và dữ liệu case
    run_render_benchmark.py  # Chạy benchmark render-only đầy đủ
    export_typst_case.py     # Xuất vật liệu Typst từ một run
    compile_typst_case.py    # Chỉ biên dịch nguồn Typst đã xuất
  case-data/                 # Vật liệu cục bộ, mặc định git ignore
  runs/                      # Đầu ra của mỗi lần benchmark đầy đủ, mặc định git ignore
  typst-cases/               # Benchmark con Typst đã xuất, mặc định git ignore
```

## Chuẩn bị dữ liệu

Từ job nguồn materialize:

```bash
python3 experiments/render-benchmark-533/scripts/materialize.py
```

Ghi đè case hiện có:

```bash
python3 experiments/render-benchmark-533/scripts/materialize.py --overwrite
```

Đầu ra:

```text
experiments/render-benchmark-533/case-data/quantum_chem_533/job/
```

Script mặc định cố gắng sử dụng hard link, tránh chiếm dụng đĩa lặp lại; nếu hệ thống tệp không hỗ trợ hard link, sẽ chuyển sang sao chép.

Script cũng ghi lại đường dẫn source PDF và dấu vân tay mtime trong `artifacts/render_prewarm/render_source_prewarm_manifest.json`. Nếu không, làm nóng trong run cách ly sẽ bị miss, benchmark warm sẽ suy biến thành cold benchmark.

## Chạy Benchmark đầy đủ

Chạy mặc định:

```bash
python3 experiments/render-benchmark-533/scripts/run_render_benchmark.py
```

Chỉ định run id:

```bash
python3 experiments/render-benchmark-533/scripts/run_render_benchmark.py --run-id my-test --overwrite
```

Với cProfile:

```bash
python3 experiments/render-benchmark-533/scripts/run_render_benchmark.py --run-id prof-1 --profile
```

Mỗi run sẽ tạo thư mục cách ly:

```text
experiments/render-benchmark-533/runs/<run_id>/
```

Đầu ra cốt lõi:

```text
runs/<run_id>/report.json
runs/<run_id>/render.stdout.log
runs/<run_id>/render.stderr.log
runs/<run_id>/job/rendered/*.pdf
```

`report.json` ghi lại:

- `success`
- `wall_seconds`
- `render_elapsed_seconds`
- `effective_render_mode`
- `pages_processed`
- `render_diagnostics`
- Đường dẫn PDF đầu ra
- Đường dẫn stdout/stderr
- Hash đầu vào
- Lệnh thực tế

## Xem thời gian chính

Có thể dùng trực tiếp:

```bash
python3 - <<'PY'
import json
from pathlib import Path

report = json.loads(Path("experiments/render-benchmark-533/runs/my-test/report.json").read_text())
diag = report["render_diagnostics"]
print("success:", report["success"])
print("wall:", report["wall_seconds"])
print("render:", report["render_elapsed_seconds"])
print("prepare:", diag.get("payload_prepare_elapsed_seconds"))
print("typst source:", diag.get("typst_source_prepare_elapsed_seconds"))
print("typst compile:", diag.get("compile_elapsed_seconds"))
print("merge:", diag.get("overlay_merge_elapsed_seconds"))
print("source cleanup:", diag.get("source_overlay_elapsed_seconds"))
PY
```

## Kiểm thử Typst riêng

Benchmark render đầy đủ bao gồm source prepare, layout, tạo nguồn Typst, biên dịch Typst,
hợp nhất overlay PDF và lưu. Nếu chỉ muốn nghiên cứu biên dịch Typst, có thể xuất Typst case.

Xuất từ một run đầy đủ:

```bash
python3 experiments/render-benchmark-533/scripts/export_typst_case.py --run-id my-test --overwrite
```

Thư mục xuất:

```text
experiments/render-benchmark-533/typst-cases/my-test/
```

Bao gồm:

```text
book-overlay.typ
book-overlay.typ.prebuilt
book-overlay.pdf
typst-case.json
source-run-report.json
```

Chỉ biên dịch Typst:

```bash
python3 experiments/render-benchmark-533/scripts/compile_typst_case.py \
  --typst-case my-test \
  --run-id compile-1 \
  --overwrite
```

Đầu ra:

```text
typst-cases/my-test/compile-runs/compile-1/compile-report.json
typst-cases/my-test/compile-runs/compile-1/book-overlay.pdf
typst-cases/my-test/compile-runs/compile-1/typst.stderr.log
```

Quy trình này không chạy lại OCR, dịch, source prepare, layout hoặc PDF merge, chỉ đo biên dịch Typst CLI với đầu vào `.typ` cố định.

## warm và cold

Benchmark đầy đủ hiện tại mặc định ở chế độ warm-ish:

- Sao chép `artifacts/render_prewarm/`
- Tự động sửa dấu vân tay source PDF trong prewarm manifest
- PDF đã xóa bbox text và payload prewarm có thể được sử dụng

Nếu muốn kiểm tra chế độ cold, có thể xóa trong run job:

```text
artifacts/render_prewarm/
```

Đề xuất sau: biến cold/warm thành tham số rõ ràng, ví dụ:

```bash
--mode warm
--mode cold
```

## Đề xuất chấm điểm

Đừng chỉ xếp hạng theo tốc độ. Chỉ so tốc độ sẽ khuyến khích xử lý ít, hy sinh chất lượng, bỏ qua trang phức tạp.

Đề xuất quy tắc:

1. Phải tạo thành công PDF.
2. Phải vượt qua ngưỡng chất lượng.
3. Sau khi chất lượng đạt, mới xếp hạng theo thời gian.

Ngưỡng chất lượng đề xuất từng bước:

- Tràn chữ
- Chồng chéo chữ
- Bảo vệ công thức hiển thị
- Nhảy cỡ chữ
- Mật độ thị giác trang
- Kích thước file PDF
- So sánh ảnh chụp trang mẫu
- Đánh giá thủ công trang cố định

Phiên bản đầu có thể làm ngưỡng cứng:

```text
success == true
pages_processed == 533
output_pdf exists
Typst compile không có lỗi fatal
```

Sau đó mở rộng thêm điểm chất lượng thị giác.

## Đề xuất phát hành gói dữ liệu

Nếu muốn cung cấp cho nhà phát triển thuật toán bên ngoài, đề xuất phát hành hai gói:

1. Gói nhẹ: chỉ chứa `typst-cases/<case>/`, dùng để tối ưu nguồn/biên dịch Typst.
2. Gói đầy đủ: chứa `case-data/quantum_chem_533/job/`, dùng để tối ưu render-only đầy đủ.

Gói đầy đủ nên bao gồm:

```text
source/
translated/
ocr/normalized/
specs/
artifacts/render_prewarm/
case.json
README.md
scripts/
```

Không khuyến nghị phát hành toàn bộ `data/jobs/<job_id>/` vì nó chứa nhiều nhật ký, sản phẩm lịch sử và tệp gỡ lỗi, làm đầu vào benchmark không đủ sạch.

## Giới hạn hiện tại

- Chưa có điểm chất lượng thị giác tự động.
- Hiện tại cold/warm chưa phải tham số rõ ràng.
- Benchmark hiện tại phụ thuộc mã backend của kho này, không phải gói Python độc lập.
- Phông chữ, phiên bản Typst, môi trường hệ thống hiện tại ảnh hưởng đến thời gian tuyệt đối.
- Cần xác nhận riêng quyền phân phối cho PDF thực.
