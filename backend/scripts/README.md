# Tổng quan Scripts

`scripts/` là thư mục dự án script của toàn bộ pipeline "PDF -> OCR -> Dịch -> Kết xuất giữ nguyên bố cục".

Hiện tại, cấp cao nhất được chia thành năm lớp theo trách nhiệm:

- `runtime/`
  Lớp điều phối runtime, chỉ chứa pipeline.
- `services/`
  Lớp triển khai cụ thể cho OCR, MinerU, dịch, kết xuất, v.v.
- `foundation/`
  Cấu hình, công cụ chia sẻ và tài nguyên prompt.
- `entrypoints/`
  Điểm vào thực thi thủ công.
- `devtools/`
  Thử nghiệm, di chuyển, ví dụ, công cụ kiểm tra, script chẩn đoán.

Trong đó, bên trong `services/` hiện được chia rõ ràng thành hai loại:

- Các mô-đun năng lực như provider / translation / rendering
- Mô-đun giao thức chia sẻ xuyên giai đoạn như `services/pipeline_shared/`

## Đường ống chính

Quy trình cốt lõi có thể tóm tắt là:

`PDF -> OCR provider -> document_schema -> services/translation -> services/rendering -> PDF`

Cụ thể hơn:

1. `normalize.stage.v1`
   Kết quả raw của OCR provider đi vào `document_schema`, tạo ra `ocr/normalized/document.v1.json` và `document.v1.report.json`
2. `translate.stage.v1`
   Chuỗi dịch chỉ đọc `document.v1.json`, trích xuất các block body được cho phép, bổ sung metadata continuation / orchestration, xuất ra `translated/`
3. `render.stage.v1`
   Chuỗi kết xuất chỉ đọc sản phẩm dịch và PDF nguồn, xuất ra `rendered/*.pdf`
4. `book.stage.v1`
   Quy trình sách toàn bộ cấp cao nhất, chỉ chịu trách nhiệm điều phối `normalize -> translate -> render`, không để hạ lưu tự suy đoán cấu trúc raw của provider

Hợp đồng block chính thức hiện tại là:

- `geometry`
- `content`
- `layout_role`
- `semantic_role`
- `structure_role`
- `policy`
- `provenance`

Giải thích:

- `type/sub_type/bbox/text/lines/segments` vẫn được giữ, nhưng đã được hạ xuống thành các trường tương thích
- Translation / rendering mainline không nên dựa vào trường raw OCR hoặc `derived/sub_type` để suy đoán văn bản
- Việc có vào dịch hay không, lấy `policy.translate` làm điểm vào duy nhất
- Quy tắc tiêu thụ payload dịch cũng đã được cố định là strict top-level contract, không còn phụ thuộc vào `metadata` mirror

## Điểm vào được khuyến nghị

Sử dụng hàng ngày ưu tiên các điểm vào sau:

- `scripts/entrypoints/run_book.py`
  Điểm vào đầy đủ cấp cao nhất hiện tại. Thông qua `book.stage.v1` kết nối `normalize -> translate -> render`, phù hợp để chạy toàn bộ đường ống chính thủ công tại local.
- `scripts/entrypoints/run_provider_case.py`
  Tên điểm vào chung để chạy "provider -> normalize -> translate -> render" bằng một lệnh tại local. Tầng phân phối provider quyết định triển khai OCR cụ thể, tên điểm vào không lộ provider.
- `scripts/entrypoints/run_document_flow.py`
  Khi đã có OCR JSON và PDF, ưu tiên dùng tên điểm vào trung lập này để chạy toàn bộ quy trình.
- `scripts/entrypoints/run_normalize_ocr.py`
  Worker normalize cấp cao. Thu gọn JSON OCR raw thành `document.v1.json`.
- `scripts/entrypoints/run_provider_ocr.py`
  Tên điểm vào chung OCR-only tại local. Chỉ chạy provider -> unpack -> normalize.
- `scripts/entrypoints/run_translate_only.py`
  Worker translate cấp cao. Chỉ nhận `document.v1.json` đã chuẩn hóa.
- `scripts/entrypoints/run_render_only.py`
  Worker render cấp cao. Chỉ nhận sản phẩm dịch và PDF.
- `scripts/entrypoints/translate_book.py`
  Chỉ dịch, không kết xuất.
- `scripts/entrypoints/build_book.py`
  Chỉ kết xuất, không dịch lại.
- `scripts/entrypoints/build_page.py`
  Điểm vào gỡ lỗi kết xuất một trang.
- `scripts/entrypoints/translate_page.py`
  Điểm vào gỡ lỗi dịch một trang.
- `scripts/entrypoints/validate_document_schema.py`
  Điểm vào kiểm tra hợp đồng. Chỉ dùng để kiểm tra `document.v1` hoặc hành vi adapter, không phải điểm vào hàng ngày cho toàn bộ đường ống.
- `scripts/devtools/tests/document_schema/regression_check.py`
  Công cụ hồi quy dài hạn, không phải điểm vào quy trình chính.

Đừng dùng script kiểm thử làm điểm vào chính. Khi xác thực toàn bộ đường ống, ưu tiên chạy:

1. `run_book.py --spec <job_root>/specs/book.spec.json`
2. Hoặc gửi job qua Rust API, để Rust điều khiển ba worker qua spec

Nếu cần sửa chuỗi dịch, thứ tự đọc khuyến nghị là:

1. `services/translation/README.md`
2. `services/translation/llm/README.md`
3. Sau đó tùy nhu cầu vào `services/translation/llm/providers/` hoặc `services/translation/llm/shared/orchestration/`

## Thứ tự tích hợp Provider mới

Nếu sau này cần tích hợp OCR provider mới, hãy làm theo thứ tự này, đừng sửa trực tiếp translation/rendering mainline:

1. Xem `scripts/services/ocr_provider/README.md` trước
   Xác định rõ ranh giới API provider, trạng thái, trách nhiệm sản phẩm raw.
2. Xem `scripts/services/document_schema/README.md`
   Xác định rõ trường nên rơi vào lớp nào của `geometry/content/layout_role/semantic_role/structure_role/policy/provenance`.
3. Chuẩn bị fixture raw tối thiểu
   Đặt vào `scripts/devtools/tests/document_schema/fixtures/`.
4. Thêm triển khai provider và adapter mới
   Kết nối vào schema thống nhất qua `scripts/services/document_schema/adapters.py`.
5. Đăng ký fixture vào `scripts/devtools/tests/document_schema/fixtures/registry.py`
   Không sửa mainline để tương thích với JSON raw provider.
6. Chạy `scripts/devtools/tests/document_schema/regression_check.py`
   Ít nhất xác nhận detector, adapt, validation, extractor smoke đều thành công.

## Mô tả thư mục cấp cao

- `services/mineru`
  Tích hợp MinerU, tải xuống, giải nén, tổ chức job.
- `services/pipeline_shared`
  Giao thức giai đoạn dùng chung cho provider / translate / render, summary và JSON IO.
- `services/translation`
  OCR payload -> JSON dịch.
- `services/rendering`
  JSON dịch -> PDF.
- `runtime/pipeline`
  Lớp điều phối tổng thể cho dịch và kết xuất.
- `services/README.md`
  Tổng quan lớp triển khai năng lực cụ thể.
- `foundation/config`
  Đường dẫn, phông chữ, bố cục và cấu hình mặc định runtime.
- `foundation/shared`
  Các năng lực dùng chung như phân tích đầu vào, thư mục job, biến môi trường, tải prompt.
- `foundation/prompts`
  Mẫu prompt có thể chỉnh sửa.
- `devtools/experiments`
  Quy trình thử nghiệm, không thuộc đường ống chính ổn định.
- `devtools/tests`
  Công cụ kiểm tra và thử nghiệm bố cục.
- `devtools/tools`
  Script mẫu, công cụ di chuyển và script chẩn đoán.

## Đầu ra có cấu trúc

Đầu ra tác vụ được đặt thống nhất dưới job root chuẩn. Rust API mặc định:

- `DATA_ROOT/jobs/<job-id>/source`
- `DATA_ROOT/jobs/<job-id>/ocr`
- `DATA_ROOT/jobs/<job-id>/translated`
- `DATA_ROOT/jobs/<job-id>/rendered`
- `DATA_ROOT/jobs/<job-id>/artifacts`
- `DATA_ROOT/jobs/<job-id>/logs`

Trong đó:

- `ocr/unpacked/` hoặc thư mục raw provider giữ sản phẩm raw OCR provider; MinerU thường là `layout.json`, Paddle thường là `paddle_result.json` / `paddle_raw`
- `ocr/normalized/document.v1.json` là đầu vào OCR thống nhất mà translation/rendering mainline sử dụng
- `ocr/normalized/document.v1.report.json` ghi lại phát hiện adapter/provider, bổ sung mặc định và tóm tắt kiểm tra schema
- `translated/translation-manifest.json` và các payload từng trang mà nó tham chiếu là sản phẩm chính thức của giai đoạn dịch
- `rendered/*.pdf` là PDF đầu ra cuối cùng
- `rendered/typst/` giữ sản phẩm trung gian Typst, tiện cho kiểm tra lỗi và truy xuất
- `artifacts/` chứa summary, chỉ mục bundle, v.v.
- `logs/` chứa nhật ký giai đoạn và đầu ra sự kiện có cấu trúc

Quy ước hiện tại:

- Mainline ưu tiên tiêu thụ `document.v1.json`
- Quy tắc tiêu thụ chính thức của `document.v1.json` là `geometry/content/layout_role/semantic_role/structure_role/policy/provenance`
- Nếu đầu vào là `layout.json` raw, sẽ được chuẩn hóa rõ ràng trước khi vào translation mainline
- Cấu trúc raw MinerU được giữ cho adapter, gỡ lỗi và truy xuất, không còn là hợp đồng dữ liệu ngầm của mainline
- Nếu chỉ cần kiểm tra lỗi, hiển thị trạng thái hoặc tóm tắt đầu ra API, ưu tiên tiêu thụ `document.v1.report.json`
- Python side thống nhất đọc report và tạo normalization summary qua `services/document_schema/reporting.py`
- `specs/` lưu JSON spec giai đoạn, hiện đã bao gồm:
  - `normalize.spec.json` -> `normalize.stage.v1`
  - `translate.spec.json` -> `translate.stage.v1`
  - `render.spec.json` -> `render.stage.v1`
  - `provider.spec.json` -> `provider.stage.v1`
  - `book.spec.json` -> `book.stage.v1`

## Quy ước Stage Spec

Giao thức ổn định từ Rust API đến Python worker hiện đã được cố định là:

`python -u <entrypoint> --spec DATA_ROOT/jobs/<job-id>/specs/<stage>.spec.json`

Quy ước:

- Spec chỉ lưu đầu vào giai đoạn, tham số và tham chiếu job, không lộ chi tiết triển khai Python nội bộ cho Rust
- `job.job_root` là điểm neo suy luận đường dẫn; các giai đoạn nội bộ suy ra `source/ocr/translated/rendered/artifacts/logs` qua `job_dirs.py`
- Khóa không được ghi dưới dạng plaintext trong spec
  - Key dịch qua `credential_ref=env:RETAIN_TRANSLATION_API_KEY`
  - Nếu provider là `mineru`, token tương ứng qua `credential_ref=env:RETAIN_MINERU_API_TOKEN`
  - Runtime Rust tiêm biến môi trường, Python đọc qua `stage_specs.resolve_credential_ref(...)`
- Rust workflow chính và local book/translate entry đều đã chuyển sang spec-only
  - `run_normalize_ocr.py`
  - `run_provider_ocr.py`
  - `run_translate_only.py`
  - `run_render_only.py`
  - `run_translate_from_ocr.py`
  - `run_document_flow.py`
  - `run_provider_case.py`
  - `run_book.py`
  - `translate_book.py`

Các điểm vào phát triển local hiện cũng đã thống nhất vào đường dẫn chính stage spec:

- `entrypoints/run_provider_case.py` -> tên điểm vào chung local cho provider-backed full workflow hiện tại
- `entrypoints/run_document_flow.py` -> tên điểm vào chung local cho normalized-document full flow hiện tại
- `entrypoints/run_provider_ocr.py` -> tên điểm vào chung local cho OCR-only provider flow hiện tại
- `services/document_schema/normalize_pipeline.py` -> `normalize.stage.v1`
- `services/translation/translate_only_pipeline.py` -> `translate.stage.v1`
- `services/rendering/workflow/render_only.py` -> `render.stage.v1`
- `services/translation/from_ocr_pipeline.py` -> `book.stage.v1`
- `entrypoints/run_book.py` -> `book.stage.v1`

Nghĩa là, quy tắc thực thi thực tế của "toàn bộ quy trình cấp cao nhất" hiện tại là:

- Local: `run_book.py --spec .../book.spec.json`
- Rust API: tạo job, Rust tạo `specs/*.spec.json` và khởi động worker tuần tự
- Script kiểm thử: chỉ dùng cho hồi quy, không đại diện cho đường dẫn thực thi chính

## Nguồn thật của phụ thuộc Python

Phụ thuộc Python hiện đã được thu gọn về [`pyproject.toml`](/home/wxyhgk/tmp/Code/pyproject.toml) ở thư mục gốc.

Không sửa trực tiếp các file requirements sau:

- [`docker/requirements-app.txt`](/home/wxyhgk/tmp/Code/docker/requirements-app.txt)
- [`docker/requirements-test.txt`](/home/wxyhgk/tmp/Code/docker/requirements-test.txt)
- [`desktop/requirements-desktop-posix.txt`](/home/wxyhgk/tmp/Code/desktop/requirements-desktop-posix.txt)
- [`desktop/requirements-desktop-windows.txt`](/home/wxyhgk/tmp/Code/desktop/requirements-desktop-windows.txt)
- [`desktop/requirements-desktop-macos.txt`](/home/wxyhgk/tmp/Code/desktop/requirements-desktop-macos.txt)

Sau khi sửa phụ thuộc, chạy thống nhất:

```bash
python backend/scripts/devtools/sync_python_requirements.py --repo-root .
```

Chỉ kiểm tra độ lệch:

```bash
python backend/scripts/devtools/sync_python_requirements.py --repo-root . --check
```

Lưu ý tương thích:

- Nếu thư mục tác vụ cũ vẫn là `originPDF/jsonPDF/transPDF/typstPDF`, backend hiện tại sẽ từ chối trực tiếp giao diện detail/download, hãy chạy lại tác vụ để tạo schema chuẩn
- Chế độ quét trực tiếp JSON dịch theo trang cũ đã thoát khỏi mainline; render-only phải cung cấp `translation-manifest.json`

## Tài liệu thư mục con

- [PIPELINE_DIRECTORY_MAP.md](./PIPELINE_DIRECTORY_MAP.md)
- [foundation/config/README.md](./foundation/config/README.md)
- [foundation/shared/README.md](./foundation/shared/README.md)
- [runtime/pipeline/README.md](./runtime/pipeline/README.md)
- [services/README.md](./services/README.md)
- [services/ocr_provider/README.md](./services/ocr_provider/README.md)
- [services/translation/README.md](./services/translation/README.md)
- [services/translation/orchestration/README.md](./services/translation/orchestration/README.md)
- [services/translation/continuation/README.md](./services/translation/continuation/README.md)
- [services/translation/policy/README.md](./services/translation/policy/README.md)
- [services/rendering/README.md](./services/rendering/README.md)
- [services/mineru/README.md](./services/mineru/README.md)

## Ranh giới thiết kế

- `services/translation` không trực tiếp thao tác PDF
- `services/rendering` không trực tiếp quyết định chiến lược dịch
- `runtime/pipeline` chịu trách nhiệm điều phối, không đi sâu vào chi tiết triển khai
- `foundation/` không chứa quy trình nghiệp vụ cụ thể
- `entrypoints/` chỉ là điểm vào, không chứa triển khai cốt lõi
- `devtools/` không thể trở thành phụ thuộc ngược của mainline

## Kiểm tra kiến trúc

Khi sửa đổi hàng ngày, ít nhất nên chạy hai lệnh:

- `python3 backend/rust_api/scripts/check_architecture.py`
- `python3 backend/scripts/devtools/check_pipeline_architecture.py`

Lệnh thứ hai chịu trách nhiệm ngăn các ranh giới dễ bị phá vỡ nhất trong Python mainline:

- `runtime/pipeline` import trực tiếp lại `services.ocr_provider` / `services.mineru`
- `runtime/pipeline` lại hiểu token raw provider, ví dụ `layoutParsingResults`
- `services/translation` / `services/rendering` lại chạm vào adapter raw provider
- `entrypoints/*` bỏ qua điểm vào ổn định, kết nối trực tiếp với triển khai sâu
- `services/ocr_provider/__init__.py` mất bề mặt export công khai rõ ràng
- `services/ocr_provider/provider_pipeline.py` mất compat symbol ổn định hoặc không còn đảm nhận handoff mainline
- `services/ocr_provider/paddle_*` phụ thuộc ngược vào `runtime/pipeline` / `services/translation` / `services/rendering`