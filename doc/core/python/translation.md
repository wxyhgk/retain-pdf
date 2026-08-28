# Giải thích tầng dịch thuật

Tài liệu này ghi lại ranh giới ổn định, trách nhiệm thư mục và đầu vào gỡ lỗi của tầng dịch thuật Python hiện tại. Đây mô tả hợp đồng chính, không ghi lại quá trình di chuyển tạm thời.

## Vị trí và trách nhiệm

Tầng dịch thuật nằm tại:

```text
backend/scripts/services/translation/
```

Nó chỉ chịu trách nhiệm biến tài liệu OCR đã chuẩn hóa thành sản phẩm dịch có thể kết xuất:

```text
document.v1.json
-> per-page translation payload
-> translation-manifest.json
-> translation diagnostics/debug index
```

Tầng dịch thuật không chịu trách nhiệm:

- Gọi OCR provider, tải zip provider hoặc phân tích raw JSON provider.
- Sửa đổi PDF nguồn, xóa văn bản tiếng Anh, tạo Typst overlay hoặc viết PDF cuối cùng.
- Xử lý trực tiếp yêu cầu HTTP Rust API và máy trạng thái job.

Đầu vào thượng nguồn ổn định là `ocr/normalized/document.v1.json`. Đầu ra hạ nguồn ổn định là `translated/translation-manifest.json` cộng với payload JSON từng trang.

## Đầu vào chính

Bên ngoài và stage worker không nên ghép trực tiếp các module nội bộ dịch, ưu tiên các đầu vào này:

- `backend/scripts/services/translation/translate_only_pipeline.py`
  Worker `translate.stage.v1`, yêu cầu `--spec <job_root>/specs/translate.spec.json`.
- `backend/scripts/services/translation/from_ocr_pipeline.py`
  Một trong các đầu vào để tiếp tục dịch và kết xuất sau provider/normalize.
- `backend/scripts/services/translation/workflow`
  Facade nội bộ tầng dịch, `runtime/pipeline/translation_stage.py` đi qua đây để vào thực thi dịch.

`start_page` / `end_page` trong stage spec hiện tại là số trang 0 gốc, `end_page=0` có nghĩa chỉ xử lý trang đầu tiên, không được coi là giá trị chưa đặt.

## Phân tầng thư mục

Cấp thư mục hiện tại được chia theo trách nhiệm:

| Thư mục | Trách nhiệm |
| --- | --- |
| `workflow/` | Điều phối quy trình dịch: tải đầu vào, tạo kế hoạch thực thi, chạy continuation/policy/batch, ghi manifest và summary. |
| `ocr/` | Chỉ đọc `document.v1.json`, trích xuất block có thể dịch, chiếu thành translation payload item. |
| `payload/` | Giao thức payload, mẫu, bảo vệ công thức, điền kết quả, ghi manifest. |
| `policy/` | Có dịch hay không, hint cho khối kỹ thuật, lọc văn bản, cấu hình chế độ. |
| `context/` | Ngữ cảnh dịch, cửa sổ lân cận, mô hình ngữ cảnh thực thi. |
| `continuation/` | Ứng viên đoạn liên tục cùng trang/xuyên trang, quy tắc và xem xét. |
| `orchestration/` | Translation unit, layout zone, siêu dữ liệu điều phối cấp tài liệu. |
| `batching/` | Thu thập pending item, khử trùng, đường dẫn nhanh, phân chia batch, đầu vào hàng đợi đồng thời. |
| `results/` | Áp dụng kết quả dịch, mở rộng item trùng, cập nhật job memory, ghi định kỳ. |
| `llm/` | Runtime provider, giao thức prompt, bộ nhớ cache, phân tích phản hồi, thử lại và xác thực. |
| `memory/` | Ứng viên, lọc, tóm tắt và lưu trữ bộ nhớ dịch ổn định, thuật ngữ và từ viết tắt cấp job. |
| `terms/` | Chuẩn hóa bảng thuật ngữ, tiêm prompt và thống kê trúng thuật ngữ. |
| `diagnostics/` | Chẩn đoán dịch, debug index, thông tin định vị cấp item. |
| `classification/` | Phân loại khối đáng ngờ trong chế độ `precise`. |
| `fast_path/` | Đường dẫn nhanh keep-origin không cần model dịch. |
| `postprocess/` | Sửa chữa nhẹ sau dịch, ví dụ phục hồi ứng viên bị lỗi. |

Shim tương thích `backend/scripts/runtime/pipeline/book_translation_*.py` đã bị xóa. Mã mới không phụ thuộc `runtime.pipeline.book_translation_*`.

## Hợp đồng dữ liệu

### Đầu vào

Tầng dịch mặc định chỉ tiêu thụ các trường chính thức của `document.v1`:

- `geometry`
- `content`
- `layout_role`
- `semantic_role`
- `structure_role`
- `policy`
- `provenance`

Danh sách trắng văn bản:

```text
content.kind == "text"
policy.translate == true
```

Việc có dịch hay không nên được quyết định rõ ràng ở giai đoạn normalize/adapter. Tầng dịch không đoán lại văn bản từ trường raw provider, `sub_type` cũ hoặc `metadata`.

### Đầu ra

Đầu ra dịch cố định:

```text
translated/
  translation-manifest.json
  page-0001.json
  page-0002.json
  ...
artifacts/
  translation_diagnostics.json
  translation_debug_index.json
```

Các trường chính thức của payload từng trang ưu tiên đặt ở tầng trên cùng, ví dụ:

- `block_kind`
- `layout_role`
- `semantic_role`
- `structure_role`
- `policy_translate`
- `asset_id`
- `reading_order`
- `raw_block_type`
- `normalized_sub_type`

`metadata` chỉ dùng để gỡ lỗi, trace provider và thông tin cầu nối nhỏ, không dùng làm đầu vào ngữ nghĩa chính thức cho logic mới.

## Quy trình thực thi

Quy trình chính có thể đơn giản hóa:

```text
load document.v1
-> extract text items
-> ensure page payload templates
-> initial continuation pass
-> optional continuation review
-> page policy/classification
-> finalize orchestration metadata
-> annotate context windows
-> collect pending translation units
-> dedupe / fast path / queue split
-> LLM translate with cache/retry/validation
-> apply results and flush pages
-> garbled reconstruction
-> write manifest, diagnostics, debug index
```

Batch thực thi đã được tách khỏi pipeline runtime cũ:

- `batching/` quyết định item nào vào hàng đợi nào.
- `workflow/batch_runner.py` thực thi batch nối tiếp hoặc song song.
- `results/` chịu trách nhiệm điền và ghi.

## Thông tin xác thực và phạm vi trang

API key không ghi vào stage spec. Spec chỉ lưu:

```json
"credential_ref": "env:RETAIN_TRANSLATION_API_KEY"
```

Key thực được tiêm bởi biến môi trường khi chạy.

Trường phạm vi trang là khoảng đóng 0 gốc:

- `start_page=0, end_page=0`: Chỉ xử lý trang đầu tiên.
- `start_page=0, end_page=-1`: Xử lý từ trang đầu đến trang cuối.

Stage spec loader phải giữ nguyên `0` hợp lệ, không dùng `value or default` để phân tích số trang.

## Đầu vào gỡ lỗi

Khi gỡ lỗi vấn đề dịch của một job, ưu tiên xem:

```text
data/jobs/<job_id>/translated/translation-manifest.json
data/jobs/<job_id>/artifacts/translation_diagnostics.json
data/jobs/<job_id>/artifacts/translation_debug_index.json
data/jobs/<job_id>/logs/pipeline_events.jsonl
```

Để xác định tại sao một item không dịch, bị giảm cấp hoặc giữ nguyên:

1. Tìm item trong `translation_debug_index.json`.
2. Xem `route_path`, `output_mode_path`, `error_trace`, `fallback_to` trong `translation_diagnostics`.
3. Nếu cần tái hiện, sử dụng công cụ replay/debug hiện có, không sửa payload thủ công.

## Lệnh xác minh

Sau khi thay đổi tầng dịch, ít nhất chạy:

```bash
python3 -m compileall -q backend/scripts/services/translation
PYTHONPATH=backend/scripts python3 -m pytest backend/scripts/devtools/tests/translation -q
python3 backend/scripts/devtools/check_pipeline_architecture.py
```

Nếu thay đổi stage spec, phạm vi trang hoặc workflow dựa trên provider, còn chạy:

```bash
PYTHONPATH=backend/scripts python3 -m pytest backend/scripts/devtools/tests/document_schema/test_normalize_stage_spec.py -q
python3 backend/scripts/devtools/check_stage_specs_contract.py data/jobs
```

## Quy tắc ranh giới

Tầng dịch cấm phụ thuộc ngược:

- `services.rendering`
- Cấu trúc raw riêng của provider
- `runtime.pipeline.book_translation_*`

Mã mới nên đặt trong thư mục phân tầng hiện có. Ranh giới kiến trúc tuân theo:

```text
backend/scripts/devtools/check_pipeline_architecture.py
```
