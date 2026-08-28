# Ranh giới kiến trúc backend Python

Tài liệu này mô tả ranh giới bảo trì lâu dài của `backend/scripts`. Mục tiêu không phải là giảm số lượng tệp, mà là đảm bảo sau khi mã phát triển vẫn có thể định vị, kiểm thử và sửa đổi.

## Phân tầng tổng thể

```text
entrypoints
  -> runtime/pipeline
    -> services/*
      -> foundation
```

Trách nhiệm:

- `entrypoints/`
  Đầu vào dòng lệnh, chỉ phân tích tham số và gọi đầu vào dịch vụ ổn định.
- `runtime/pipeline/`
  Tầng điều phối giai đoạn, chịu trách nhiệm thứ tự OCR, dịch thuật, kết xuất, stage spec, sự kiện và bàn giao sản phẩm.
- `services/`
  Tầng năng lực cụ thể, bao gồm các năng lực nghiệp vụ như OCR provider, document schema, dịch thuật, kết xuất.
- `foundation/`
  Cấu hình, công cụ nền tảng dùng chung và năng lực cơ sở xuyên dịch vụ.

## Hệ thống con ổn định

```text
services/document_schema
services/ocr_provider
services/mineru
services/translation
services/rendering
services/pipeline_shared
runtime/pipeline
```

Quy tắc cốt lõi:

- Raw payload của OCR provider trước tiên phải vào `document_schema`, tạo `document.v1`.
- Luồng chính dịch thuật chỉ tiêu thụ `document.v1` và translation stage spec.
- Luồng chính kết xuất chỉ tiêu thụ PDF nguồn, translation manifest, payload dịch từng trang và render stage spec.
- `runtime/pipeline` chỉ chịu trách nhiệm điều phối, không hấp thụ chi tiết provider, LLM, Typst, redaction.

## Ranh giới tầng kết xuất

```text
services/rendering/workflow
  -> document / analysis
  -> source
  -> layout
  -> output
```

Trách nhiệm:

- `workflow/`
  Kết nối các chế độ kết xuất, chọn đường dẫn overlay, dual, background typst, v.v.
- `analysis/`
  Chân dung trang, phân loại trang và quyết định đường dẫn kết xuất trang.
- `document/`
  Ánh xạ số trang, sao chép mục lục/dấu trang và hỗ trợ cấp tài liệu.
- `source/background/`
  Tạo PDF nền đã làm sạch.
- `source/cleanup/`
  Thao tác trực tiếp trên trang PDF, xóa hoặc ghi đè vùng văn bản gốc.
- `layout/`
  Chuyển các mục đã dịch thành `RenderBlock` / page specs.
- `output/typst/`
  Tạo mã nguồn Typst, biên dịch overlay PDF, thực hiện hợp nhất overlay.
- `source/compression/`
  Nén PDF.
- `layout/model/`
  Mô hình dữ liệu chung cho kết xuất.

Hướng cấm:

- `output/typst` không import `source/cleanup`.
- `layout` không import `output/typst`, `source/cleanup`, `source/prepare`.
- `source/cleanup` không import `output/typst` hoặc logic layout cấp cao.
- `runtime/pipeline` không trực tiếp import `services.rendering.output.typst`, `services.rendering.source.cleanup`, `services.rendering.layout`.

## Ranh giới tầng dịch thuật

```text
services/translation/workflow
  -> context
  -> policy
  -> memory
  -> llm
  -> payload
```

Trách nhiệm:

- `workflow/`
  Đầu vào yêu cầu dịch và facade thực thi.
- `context/`
  Kết hợp domain guidance, memory guidance.
- `policy/`
  Chiến lược như có dịch hay không, cách xử lý giữ nguyên bố cục.
- `memory/`
  Ghi nhớ thuật ngữ cấp job và giữ nguyên bố cục.
- `llm/`
  Gọi provider, thử lại, xác thực và dự phòng.
- `payload/`
  Giao thức sản phẩm dịch.

Hướng cấm:

- `runtime/pipeline/translation_stage.py` không trực tiếp import chi tiết nội bộ `policy`, `llm`, `diagnostics`.
- `translation` không import `services.rendering`.
- `translation` không tiêu thụ raw JSON của provider.

## Ranh giới OCR

```text
ocr_provider / mineru
  -> document_schema
  -> document.v1
```

Hướng cấm:

- `ocr_provider` không import `services.translation`.
- `ocr_provider` không import `services.rendering`.
- `translation` và `rendering` không import `services.ocr_provider` hoặc `services.mineru`.

## Đầu vào công khai

Tầng trên ưu tiên chỉ gọi các đầu vào sau:

- `services.ocr_provider.provider_pipeline`
- `services.document_schema.normalize_pipeline`
- `services.translation.workflow`
- `services.rendering.workflow.execute_render_plan`
- `runtime.pipeline.book_pipeline`

Nếu thêm đầu vào mới, phải đồng thời cập nhật:

- Tài liệu này.
- README thư mục tương ứng.
- `backend/scripts/devtools/check_pipeline_architecture.py`.

## Khi nào mới tiếp tục tách tệp

Tách khi đáp ứng bất kỳ điều kiện nào sau:

- Một tệp vượt quá 300 dòng và chứa hơn 3 loại trách nhiệm.
- Sửa một chức năng nhỏ cần qua hơn 5 thư mục.
- Xuất hiện phụ thuộc vòng.
- Cùng một logic lặp lại trong nhiều module.
- Khó viết kiểm thử vì IO, chiến lược, cấu trúc dữ liệu trộn lẫn trong một hàm.

Không đáp ứng các điều kiện này, ưu tiên bổ sung kiểm thử, tài liệu, kiểm tra kiến trúc thay vì tiếp tục tách tệp.
