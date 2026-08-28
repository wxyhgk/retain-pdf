# Bản đồ thư mục Python Pipeline

Tài liệu này chỉ trả lời một câu hỏi:

**Khi sửa `backend/scripts`, nên vào thư mục nào trước.**

## Điểm vào phổ biến nhất

- Sửa điểm vào thực thi thủ công:
  [`entrypoints/`](/home/wxyhgk/tmp/Code/backend/scripts/entrypoints)
- Sửa bus điều phối giai đoạn:
  [`runtime/pipeline/`](/home/wxyhgk/tmp/Code/backend/scripts/runtime/pipeline)
- Sửa tích hợp OCR provider:
  [`services/ocr_provider/`](/home/wxyhgk/tmp/Code/backend/scripts/services/ocr_provider)
- Sửa hợp đồng OCR thống nhất:
  [`services/document_schema/`](/home/wxyhgk/tmp/Code/backend/scripts/services/document_schema)
- Sửa chuỗi chính dịch:
  [`services/translation/`](/home/wxyhgk/tmp/Code/backend/scripts/services/translation)
- Sửa chuỗi chính kết xuất:
  [`services/rendering/`](/home/wxyhgk/tmp/Code/backend/scripts/services/rendering)

## Nhìn một cái hiểu ngay chuỗi chính

### Toàn bộ quy trình provider-backed

```text
entrypoints/run_provider_case.py
  -> services/ocr_provider/provider_pipeline.py
     -> services/mineru/*  hoặc services/ocr_provider/paddle_api.py
     -> services/document_schema/*
     -> runtime/pipeline/book_pipeline.py
        -> runtime/pipeline/translation_stage.py
           -> services/translation/*
        -> runtime/pipeline/render_stage.py
           -> services/rendering/*
```

### OCR đã chuẩn hóa -> dịch -> kết xuất

```text
entrypoints/run_book.py
  -> services/translation/from_ocr_pipeline.py
     -> runtime/pipeline/book_pipeline.py
        -> translation_stage.py
        -> render_stage.py
```

### Chỉ dịch

```text
entrypoints/run_translate_only.py
  -> services/translation/translate_only_pipeline.py
     -> runtime/pipeline/translation_stage.py
        -> services/translation/*
```

### Chỉ kết xuất

```text
entrypoints/run_render_only.py
  -> services/rendering/workflow/render_only.py
     -> runtime/pipeline/render_stage.py
        -> services/rendering/*
```

## Bản đồ thư mục cấp cao

### `entrypoints/`

- Vai trò:
  Điểm vào ngoài cùng, chỉ nhận tham số, gói gọn ngoại lệ, hướng lệnh gọi vào điểm vào ổn định.
- Không nên làm:
  Không tự ghép quy trình provider, không trực tiếp chạm vào triển khai sâu của dịch/kết xuất.
- Tệp điển hình:
  - [`run_provider_case.py`](/home/wxyhgk/tmp/Code/backend/scripts/entrypoints/run_provider_case.py)
    Điểm vào tổng thể cho full flow provider-backed.
  - [`run_book.py`](/home/wxyhgk/tmp/Code/backend/scripts/entrypoints/run_book.py)
    Điểm vào tổng thể cho OCR đã chuẩn hóa -> dịch -> kết xuất.
  - [`run_translate_only.py`](/home/wxyhgk/tmp/Code/backend/scripts/entrypoints/run_translate_only.py)
    Điểm vào chỉ dịch.
  - [`run_render_only.py`](/home/wxyhgk/tmp/Code/backend/scripts/entrypoints/run_render_only.py)
    Điểm vào chỉ kết xuất.

### `runtime/pipeline/`

- Vai trò:
  Bus điều phối giai đoạn, chỉ chịu trách nhiệm tổ chức thứ tự, đầu vào/đầu ra giai đoạn và tổng hợp kết quả.
- Không nên làm:
  Không hiểu JSON raw của provider, không hấp thụ chi tiết chiến lược dịch, không triển khai kết xuất PDF cấp thấp.
- Tệp chính:
  - [`book_pipeline.py`](/home/wxyhgk/tmp/Code/backend/scripts/runtime/pipeline/book_pipeline.py)
    Điều phối cấp cao `dịch -> kết xuất`.
  - [`translation_stage.py`](/home/wxyhgk/tmp/Code/backend/scripts/runtime/pipeline/translation_stage.py)
    Điểm vào giai đoạn chỉ dịch.
  - [`render_stage.py`](/home/wxyhgk/tmp/Code/backend/scripts/runtime/pipeline/render_stage.py)
    Điểm vào giai đoạn chỉ kết xuất.
  - [`translation_loader.py`](/home/wxyhgk/tmp/Code/backend/scripts/runtime/pipeline/translation_loader.py)
    Đọc `translation-manifest.json` và payload từng trang.
  - [`render_inputs.py`](/home/wxyhgk/tmp/Code/backend/scripts/runtime/pipeline/render_inputs.py)
    Thu gọn giao thức đầu vào render-only.

### `services/document_schema/`

- Vai trò:
  Tầng hợp đồng trung gian OCR thống nhất.
- Điều kiện vào:
  Sửa adapter raw OCR -> `document.v1.json`, giá trị mặc định trường, kiểm tra schema thì vào đây.
- Tệp chính:
  - [`normalize_pipeline.py`](/home/wxyhgk/tmp/Code/backend/scripts/services/document_schema/normalize_pipeline.py)
    Điểm vào normalize worker.
  - [`adapters.py`](/home/wxyhgk/tmp/Code/backend/scripts/services/document_schema/adapters.py)
    Cổng adapter tổng thể raw provider -> normalized document.
  - [`reporting.py`](/home/wxyhgk/tmp/Code/backend/scripts/services/document_schema/reporting.py)
    Đọc normalization summary/report.

### `services/ocr_provider/`

- Vai trò:
  Điểm vào tổng thể OCR provider-backed và thu gọn giao thức provider.
- Điều kiện vào:
  Sửa phân phối provider, gọi Paddle API, mainline provider-backed worker thì vào đây.
- Tệp chính:
  - [`provider_pipeline.py`](/home/wxyhgk/tmp/Code/backend/scripts/services/ocr_provider/provider_pipeline.py)
    Điểm vào ổn định cho full flow provider-backed hiện tại, cũng là bề mặt tương thích cho script/test phụ thuộc.
  - [`paddle_api.py`](/home/wxyhgk/tmp/Code/backend/scripts/services/ocr_provider/paddle_api.py)
    Tích hợp Paddle API không đồng bộ.
  - [`paddle_markdown.py`](/home/wxyhgk/tmp/Code/backend/scripts/services/ocr_provider/paddle_markdown.py)
    Ghi Paddle Markdown và sản phẩm ảnh.
  - [`paddle_normalize.py`](/home/wxyhgk/tmp/Code/backend/scripts/services/ocr_provider/paddle_normalize.py)
    Triển khai thuần túy như hiệu chỉnh hình học của Paddle normalized document.

### `services/mineru/`

- Vai trò:
  Triển khai cụ thể của provider MinerU.
- Điều kiện vào:
  Chỉ vào đây khi sửa transport, tải xuống, giải nén và sắp xếp sản phẩm của MinerU provider.
- Lưu ý:
  Đây là triển khai provider, không phải bus OCR, cũng không phải mainline dịch/kết xuất.

### `services/translation/`

- Vai trò:
  Biến `document.v1.json` thành sản phẩm dịch ổn định.
- Điều kiện vào:
  Sửa chiến lược dịch, điều phối LLM, continuation, ghi payload, diagnostics thì vào đây.
- Tệp chính:
  - [`from_ocr_pipeline.py`](/home/wxyhgk/tmp/Code/backend/scripts/services/translation/from_ocr_pipeline.py)
    Điểm vào wrapper worker cho normalized OCR -> translate -> render.
  - [`translate_only_pipeline.py`](/home/wxyhgk/tmp/Code/backend/scripts/services/translation/translate_only_pipeline.py)
    Điểm vào wrapper worker translate-only.
  - [`workflow/translation_workflow.py`](/home/wxyhgk/tmp/Code/backend/scripts/services/translation/workflow/translation_workflow.py)
    Quy trình dịch một trang.
  - [`llm/README.md`](/home/wxyhgk/tmp/Code/backend/scripts/services/translation/llm/README.md)
    Giải thích ranh giới thư mục LLM.

### `services/rendering/`

- Vai trò:
  Biến sản phẩm dịch và PDF nguồn thành PDF cuối cùng.
- Điều kiện vào:
  Sửa overlay, Typst, sửa nền, nén, giao thức render-only thì vào đây.
- Tệp chính:
  - [`workflow/render_only.py`](/home/wxyhgk/tmp/Code/backend/scripts/services/rendering/workflow/render_only.py)
    Điểm vào wrapper worker render-only.
  - [`workflow/`](/home/wxyhgk/tmp/Code/backend/scripts/services/rendering/workflow)
    Điểm vào điều phối quy trình kết xuất.
  - [`output/typst/`](/home/wxyhgk/tmp/Code/backend/scripts/services/rendering/output/typst)
    Chuỗi chính đầu ra Typst.

### `services/pipeline_shared/`

- Vai trò:
  Hợp đồng stdout, summary, events, JSON IO được chia sẻ giữa provider / translate / render.
- Không nên làm:
  Không đặt logic riêng của provider, cũng không đặt chi tiết thuật toán dịch/kết xuất.

### `foundation/`

- Vai trò:
  Cấu hình, đường dẫn, stage spec, công cụ chia sẻ, prompt loader.
- Điều kiện vào:
  Sửa cấu hình chia sẻ xuyên module hoặc giao thức stage spec thì vào đây.

### `devtools/`

- Vai trò:
  Gỡ lỗi, hồi quy, thăm dò, script thí nghiệm.
- Không nên làm:
  Không được trở thành phụ thuộc ngược của mainline.

## Xác định nhanh

- "Đây có phải là thay đổi tham số đầu vào hoặc cách khởi động worker không?"
  Xem `entrypoints/` trước
- "Đây có phải là thay đổi thứ tự giai đoạn hoặc giao thức đầu vào/đầu ra không?"
  Xem `runtime/pipeline/` trước
- "Đây có phải là thay đổi adapter raw OCR hoặc schema không?"
  Xem `services/document_schema/` trước
- "Đây có phải là vấn đề tích hợp provider không?"
  Xem `services/ocr_provider/` hoặc `services/mineru/` trước
- "Đây có phải là kết quả dịch không đúng không?"
  Xem `services/translation/` trước
- "Đây có phải là PDF kết xuất không đúng không?"
  Xem `services/rendering/` trước

## Ba ranh giới đỏ

- `runtime/pipeline/` không hiểu JSON raw của provider, cũng không import trực tiếp triển khai riêng của provider.
- `services/translation/` và `services/rendering/` không tiêu thụ cấu trúc raw của provider, chỉ tiêu thụ vật giao tiếp ổn định.
- `entrypoints/` chỉ kết nối điểm vào ổn định, không bypass `*_pipeline.py` hoặc `runtime/pipeline/*` để kết nối trực tiếp triển khai sâu.

## Thứ tự đọc cho người mới

1. [`README.md`](/home/wxyhgk/tmp/Code/backend/scripts/README.md)
   Biết tổng thể thư mục và điểm vào chính thức trước.
2. [`PIPELINE_DIRECTORY_MAP.md`](/home/wxyhgk/tmp/Code/backend/scripts/PIPELINE_DIRECTORY_MAP.md)
   Sau đó biết sửa ở đâu.
3. [`runtime/pipeline/README.md`](/home/wxyhgk/tmp/Code/backend/scripts/runtime/pipeline/README.md)
   Xem ranh giới giai đoạn.
4. [`services/README.md`](/home/wxyhgk/tmp/Code/backend/scripts/services/README.md)
   Xem phân công tổng thể của services.
5. Sau đó theo module vào README của `translation/`, `rendering/`, `ocr_provider/`.