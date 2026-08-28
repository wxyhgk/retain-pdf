# Đặc tả Dịch

Lớp này chỉ thực hiện một việc duy nhất: chuyển đổi payload OCR thành kết quả dịch có thể lưu trữ, điền lại và kết xuất.

Module này không xử lý đọc/ghi PDF hoặc giải nén MinerU.

## Ranh giới giai đoạn

Đầu vào và đầu ra chính thức của giai đoạn dịch được cố định như sau:

- Đầu vào:
  `document.v1.json`, tham số chiến lược dịch, thư mục đầu ra dịch
- Đầu ra:
  Payload dịch theo trang, tóm tắt dịch, chẩn đoán dịch

Không chịu trách nhiệm rõ ràng về:

- Tiêu thụ trực tiếp JSON thô của provider, zip hoặc thư mục đã giải nén
- Ghi đè trang PDF nguồn, ghi đè bố cục, giao hàng PDF cuối cùng
- Tải lên, thăm dò, tải xuống, tạo artifact chuẩn hóa của OCR provider

## Chiến lược dịch mặc định

Chiến lược mặc định được thiết kế xoay quanh quy trình dịch của con người thay vì nhồi nhét toàn bộ thông tin trang vào mô hình:

1. Ưu tiên block hiện tại
   Mỗi bản dịch nhắm đến văn bản nguồn của mục hiện tại như đối tượng đầu ra duy nhất. Ngữ cảnh, thuật ngữ và bộ nhớ tài liệu hỗ trợ hiểu biết; không dịch vào block hiện tại.
2. Thuật ngữ được tiêm theo khớp
   Bảng thuật ngữ của người dùng và bộ nhớ tài liệu tự động không được đưa vào prompt đầy đủ. Chuỗi dịch chính khớp thuật ngữ với văn bản nguồn của mục hoặc batch hiện tại trước; chỉ tiêm các thuật ngữ `preferred` đã khớp như gợi ý dịch. Các ràng buộc cứng `preserve/canonical` được xử lý ưu tiên thông qua bảo vệ placeholder.
3. Ngữ cảnh được tiêm theo yêu cầu
   Các đoạn văn bản nội dung thông thường hoàn chỉnh mặc định không có ngữ cảnh xung quanh để giảm kích thước prompt và tránh các đoạn văn liền kề bị dịch sai vào block hiện tại. Ngữ cảnh theo thứ tự đọc chỉ được cung cấp cho tiếp nối cột/trang, ứng viên tiếp nối, chú thích, các đoạn bắt đầu bằng liên từ và các đoạn ngắn chưa hoàn chỉnh. Sử dụng `mode="all"` để giữ lại ngữ cảnh lân cận đầy đủ khi gỡ lỗi hành vi kế thừa.
4. Fallback chất lượng không thể tắt
   Các mục có `should_translate=true` không được kết thúc với bản dịch trống. Bản dịch thông thường, thử lại văn bản ngắn, sửa chữa văn bản bị lỗi và sửa chữa agent đều phải coi bản dịch trống là vấn đề có thể khắc phục. Các tùy chọn nâng cao có thể kiểm soát ngân sách ngữ cảnh/thuật ngữ/chất lượng nhưng không nên vô hiệu hóa đảm bảo sửa chữa bản dịch trống cuối cùng.

### Tùy chọn nâng cao

Yêu cầu dịch backend hỗ trợ ba tùy chọn nâng cao; Rust API ghi chúng vào đặc tả giai đoạn và chuyển đến lớp thực thi dịch Python:

| Trường | Mặc định | Tùy chọn | Ý nghĩa |
| --- | --- | --- | --- |
| `context_mode` | `needed` | `needed` / `all` / `off` | Kiểm soát ngữ cảnh theo thứ tự đọc. `needed` chỉ cung cấp ngữ cảnh cho các đoạn chưa hoàn chỉnh, đoạn tiếp nối, chú thích, v.v.; `all` quay lại hành vi ngữ cảnh lân cận cũ; `off` vô hiệu hóa ngữ cảnh hoàn toàn. |
| `glossary_mode` | `matched` | `matched` / `all` / `off` | Kiểm soát việc tiêm bảng thuật ngữ người dùng. `matched` chỉ tiêm các thuật ngữ khớp với mục/batch hiện tại; `all` chuyển toàn bộ bảng vào prompt; `off` không tiêm bảng thuật ngữ. |
| `memory_mode` | `matched` | `matched` / `broad` / `off` | Kiểm soát bộ nhớ tài liệu tự động. `matched` chỉ tiêm các thuật ngữ lịch sử khớp với mục/batch hiện tại; `broad` tiêm tóm tắt cấp tài liệu; `off` vô hiệu hóa việc tiêm bộ nhớ. |

Các tùy chọn này chỉ ảnh hưởng đến ngân sách ngữ cảnh prompt và phạm vi tiêm thuật ngữ/bộ nhớ; không ảnh hưởng đến fallback chất lượng cuối cùng. Bản dịch trống, residue tiếng Anh nghiêm trọng và lỗi placeholder vẫn phải đi vào quy trình sửa chữa tiếp theo.

Trong quá trình thực thi mặc định, bộ nhớ tài liệu tự động chỉ đọc `JobMemorySnapshot` một lần khi bắt đầu tác vụ; các worker không ghi lại vào `job-memory.json` trong thời gian thực trong quá trình dịch đồng thời. Điều này tránh khóa tệp lặp lại, làm mới bộ nhớ prompt và làm chậm batch đuôi dưới tải đồng thời cao cho các PDF lớn. Đặt `RETAIN_TRANSLATION_LIVE_MEMORY_UPDATES=1` để cho phép giai đoạn điền lại kết quả tiếp tục cập nhật bộ nhớ tác vụ trong thời gian thực khi gỡ lỗi hành vi kế thừa.

Các điểm chuyển giao ổn định hiện tại:

- Giai đoạn OCR upstream nên hội tụ kết quả provider vào `document.v1.json` trước
- Giai đoạn kết xuất downstream chỉ nên tiêu thụ các artifact dịch được lưu trữ tại đây; không nên xem lại các trường riêng của OCR provider

Giao thức artifact dịch mặc định hiện tại:

- `translation-manifest.json`
  Ghi lại ánh xạ ổn định từ chỉ mục trang đến các tệp payload dịch để giai đoạn kết xuất đọc ưu tiên.
  Cũng mang siêu dữ liệu nhẹ như tóm tắt bảng thuật ngữ, tóm tắt chẩn đoán và trường `invocation`.
  Hiện được đánh dấu chính thức là `stage_spec`.
- Payload dịch theo trang
  Hiện được lưu trữ dưới dạng một JSON cho mỗi trang; manifest khai báo cách giai đoạn kết xuất phát hiện các tệp này.
- Đặc tả giai đoạn
  Điểm vào `translate-only` hiện hỗ trợ `job_root/specs/translate.spec.json` (`translate.stage.v1`)
- Artifact gỡ lỗi
  - `artifacts/translation_diagnostics.json`
  - `artifacts/translation_debug_index.json`

## Đặc tả Payload Dịch

Payload dịch theo trang hiện được chia thành hai lớp:

1. Các trường hợp đồng cấp cao
2. Các trường `metadata` gỡ lỗi/cầu nối

Các trường hợp đồng cấp cao bao gồm:

- `block_kind`
- `layout_role`
- `semantic_role`
- `structure_role`
- `policy_translate`
- `asset_id`
- `reading_order`
- `raw_block_type`
- `normalized_sub_type`

Quy ước hiện tại:

- Phân loại dịch, gợi ý kiểu, chính sách, điền lại payload và chuỗi chẩn đoán chính nên đọc chỉ các trường hợp đồng cấp cao này ưu tiên
- `metadata` có thể tiếp tục tồn tại nhưng trách nhiệm giới hạn ở gỡ lỗi, theo dõi provider và cầu nối `continuation_hint/provider warning`
- Logic mới không nên coi `metadata.layout_role`, `metadata.semantic_role`, `metadata.structure_role` là điểm vào ngữ nghĩa chính thức
- Nếu ngữ nghĩa block thay đổi sau này, chỉ sửa đổi phép chiếu hợp đồng `document.v1 -> TextItem -> payload`; không để các module downstream tự ý lật qua `metadata`

Quy ước tương thích:

- Các thư mục tác vụ mới nên tạo `translation-manifest.json`
- Giao thức artifact dịch được cố định là `translation-manifest.json` + payload theo trang; giai đoạn kết xuất không còn tương thích với chế độ quét trực tiếp JSON theo trang cũ
- Đặc tả tải mặc định là hợp đồng nghiêm ngặt; các payload thiếu các trường hợp đồng cấp cao trên sẽ báo lỗi trực tiếp
- Worker `translate-only` của quy trình chính Rust hiện yêu cầu `--spec`
- `scripts/entrypoints/translate_book.py` hiện là điểm vào wrapper chỉ dành cho spec
- Thông tin xác thực API không còn được yêu cầu trong đặc tả giai đoạn; spec sử dụng `credential_ref`; môi trường runtime sẽ tiêm khóa thực tế

## Vòng lặp gỡ lỗi khép kín

Chuỗi tái tạo tối thiểu để xác định "tại sao một mục không được dịch / bị suy giảm / giữ nguyên bản gốc":

1. Kiểm tra các artifact gỡ lỗi trước
   - `translation_diagnostics.json` để xem thống kê toàn cục
   - `translation_debug_index.json` để xem chỉ mục cấp mục
2. Sau đó kiểm tra mục đơn
   - `backend/scripts/devtools/replay_translation_item.py`
3. Kết nối promptfoo cho hồi quy batch khi cần
   - `backend/scripts/devtools/promptfoo/`
   - Sử dụng `scan_drift.py` để tìm các mục drift giữa lưu và phát lại trước, sau đó dùng `capture_case.py` để đóng gói thành artifact trường hợp

Rust API cung cấp tương ứng:

- `GET /api/v1/jobs/{job_id}/translation/diagnostics`
- `GET /api/v1/jobs/{job_id}/translation/items`
- `GET /api/v1/jobs/{job_id}/translation/items/{item_id}`
- `POST /api/v1/jobs/{job_id}/translation/items/{item_id}/replay`

## Thư mục con và ranh giới

Các thư mục cấp một được phân chia theo trách nhiệm ổn định. Mã mới nên được đặt vào các thư mục này ưu tiên; không thêm các tệp lớn vào thư mục gốc.

Thư mục gốc chỉ giữ lại `README.md` và khởi tạo package. Không thêm các tệp `translation/*.py` lớn mới; các module bên ngoài cần khả năng dịch nên đi qua `public/` ưu tiên.

| Thư mục | Trách nhiệm | Không nên làm |
| --- | --- | --- |
| `entrypoints/` | Triển khai script worker Python, ví dụ: translate-only, quy trình dịch sách. Các tệp cùng tên ở gốc chỉ là shim tương thích. | Không chứa quy tắc nghiệp vụ; không bị workflow phụ thuộc ngược. |
| `workflow/` | Điều phối luồng dịch, lập lịch giai đoạn, phân bổ batch/worker, duy trì luồng chính. | Không lắp ráp trực tiếp payload HTTP provider; không viết các quy tắc chính sách cụ thể. |
| `core/` | Mô hình miền ổn định và giao thức dữ liệu: hợp đồng mục, đọc `document.v1`, payload dịch, manifest, điều phối. | Không gọi LLM; không quản lý vòng đời tác vụ. |
| `services/` | Khả năng nghiệp vụ dịch: chính sách, tiếp nối, phân loại, ngữ cảnh, thuật ngữ, bộ nhớ, chất lượng, tác nhân, hậu xử lý, kết quả. | Không phân tích cú pháp các mục nhập bên ngoài; không phụ thuộc trực tiếp vào quy trình runtime. |
| `llm/` | Nhà cung cấp LLM, giao thức prompt, bộ nhớ đệm, phân tích cú pháp phản hồi, thử lại, mục nhập xác thực. | Không đọc tệp OCR; không quyết định quy trình cấp trang. |
| `artifacts/` | Chẩn đoán có cấu trúc, chỉ mục gỡ lỗi, artifact đánh giá, đầu ra thống kê runtime. | Không đưa ra quyết định nghiệp vụ; không gọi provider. |
| `public/` | Facade ổn định cho mã sản xuất bên ngoài dịch (runtime, kết xuất, ocr_provider). | Không viết logic nghiệp vụ; không tùy tiện tiết lộ các helper tạm thời nội bộ. |

### Điểm vào công khai bên ngoài

Mã sản xuất tham chiếu đến module này từ bên ngoài dịch chỉ được sử dụng mặc định:

- `services.translation.public`
  Các hợp đồng ổn định được chia sẻ bởi runtime, kết xuất, ocr_provider, ví dụ: mục nhập bảng thuật ngữ, mặc định runtime provider, đọc manifest dịch, helper vai trò mục, helper bảo vệ công thức, trình ghi chẩn đoán.
- `services.translation.entrypoints.*`
  Được sử dụng bởi các script điểm vào CLI/worker.

Các thư mục sản xuất sau không nên import trực tiếp triển khai nội bộ của dịch:

- `runtime/pipeline/**`
- `services/rendering/**`
- `services/ocr_provider/**`
- `services/mineru/**`
- `services/document_schema/**`

Các thư mục này cấm tham chiếu trực tiếp đến:

- `services.translation.core`
- `services.translation.services`
- `services.translation.llm`
- `services.translation.workflow`
- `services.translation.artifacts`

Nếu các module bên ngoài thực sự cần khả năng dịch mới, hãy thiết kế dưới dạng hợp đồng ổn định và thêm vào `public/` trước, sau đó gọi từ bên ngoài.

`public/` phải duy trì facade lười: không viết `from services.translation... import ...` hoặc `from services.rendering... import ...` ở cấp cao nhất của `services/translation/public/__init__.py`. Chỉ đăng ký các export mới vào `_EXPORTS`; tải theo yêu cầu thông qua `__getattr__` để ngăn chặn việc tái tạo vòng lặp import giữa dịch và kết xuất.

### Ngoại lệ Devtools và Kiểm thử

`backend/scripts/devtools/**` và `backend/scripts/devtools/tests/**` có thể import trực tiếp các module nội bộ của dịch cho:

- Kiểm thử đơn vị các quy tắc nội bộ, helper payload, giao thức LLM, nhánh chính sách
- Công cụ gỡ lỗi chạy replay / promptfoo / sửa chữa
- Kiểm tra hồi quy golden flow hoặc schema

Đây là các ngoại lệ chỉ dành cho gỡ lỗi/kiểm thử; mã sản xuất không được sao chép. Khi thêm các chuỗi runtime thông thường, worker, OCR/normalize, kết xuất hoặc mã runtime, vẫn phải đi qua `services.translation.public` theo mặc định. Nếu một script devtools sẽ được gọi bởi sản xuất sau này, hãy hợp nhất khả năng dịch cần thiết vào `public/` trước khi kết nối với chuỗi chính.

### Hướng phụ thuộc

Hướng phụ thuộc mục tiêu:

```text
entrypoints
  -> workflow / pipeline_shared / foundation
workflow
  -> core / services / llm / artifacts
core
  -> core
services
  -> core / llm / artifacts
llm
  -> core / artifacts
artifacts
  -> core
public
  -> core / workflow / llm provider runtime / artifacts
```

Các ngoại lệ chuyển tiếp còn lại:

- `workflow/execution_runner.py` khởi động render source prewarm để làm nóng song song đầu vào kết xuất với dịch; ngoại lệ phải được giữ hẹp.

Ranh giới hợp nhất:

- `core` chỉ chứa các hợp đồng thuần túy, đọc dữ liệu, thao tác dữ liệu payload, quy tắc văn bản; không import `services`, `workflow` hoặc `llm`
- `llm` không còn đọc `services/context`, `services/memory`, `services/quality`, `services/terms`
- `artifacts` không còn đọc `services/agents` hoặc ngữ cảnh điều khiển LLM; xây dựng tóm tắt đánh giá trong `services/agents/review_artifact.py`
- `services` có thể kết hợp `core`, `llm`, `artifacts` nhưng không phụ thuộc ngược vào `workflow`

Các shim tương thích đã bị xóa:

- `translation/from_ocr_pipeline.py` -> `translation/entrypoints/from_ocr_pipeline.py`
- `translation/translate_only_pipeline.py` -> `translation/entrypoints/translate_only_pipeline.py`
- `translation/item_reader.py` -> `translation/core/item_reader.py`
- `translation/session_context.py` -> `translation/services/context/session_context.py`
- `translation/services/context/models.py` -> `translation/core/context/models.py`
- `translation/services/context/unit_context.py` -> `translation/core/context/unit_context.py`
- `translation/services/terms/glossary.py` -> `translation/core/terms/glossary.py`
- `translation/services/terms/abbreviations.py` -> `translation/core/terms/abbreviations.py`
- `translation/services/terms/injection.py` -> `translation/core/terms/injection.py`
- `translation/services/quality/checks.py` -> `translation/llm/validation/quality.py`

Các shim này đã thoát khỏi mainline. Các cổng kiến trúc từ chối các tham chiếu tiếp tục đến các đường dẫn cũ này; mã mới nên tham chiếu trực tiếp đến các đường dẫn thực.

### Ranh giới Payload/Parts

`core/payload/` chỉ giữ lại các hợp đồng payload và thao tác dữ liệu:

- `manifest.py` xử lý giao thức đọc/ghi manifest dịch.
- `ops.py` xử lý đọc/ghi trường payload chung.
- `translations.py` xử lý điền lại kết quả dịch và các trường trạng thái.
- `formula_protection.py` xử lý các marker bảo vệ công thức trong payload.
- `template_contract.py`, `template_records.py`, `template_sync.py` xử lý hợp đồng mẫu, bản ghi và đồng bộ hóa.
- `parts/` xử lý xử lý dữ liệu thuần túy sau khi phân rã payload nội bộ, ví dụ: áp dụng, mục kết quả, tách nhóm, trạng thái kết quả, tóm tắt, đơn vị dịch.

Các đột biến/kiểm tra/mặc định liên quan đến chính sách được chuyển đến `services/policy/payload_rules/`; việc ghi trạng thái chính sách thống nhất trong `core/payload/parts/policy_state.py`; phán quyết chính sách runtime trong `services/policy/verdict.py`:

- `policy_mutations.py`, `legacy_policy_mutations.py` xử lý việc ghi trường giai đoạn chính sách.
- `policy_defaults.py` xử lý xác định khả năng dịch mặc định/nền tảng trong giai đoạn đặt lại.
- `legacy_policy_checks.py` xử lý các kiểm tra chính sách cũ như CJK, mục trích dẫn, đánh giá thuần văn bản hỗn hợp.
- `core/payload/parts/policy_state.py` xử lý việc ghi thống nhất `classification_label`, `should_translate`, `skip_reason`, `final_status`.
- `services/policy/verdict.py` xử lý câu trả lời thống nhất về việc có gọi mô hình hay không, có cho phép giữ nguyên bản gốc hay không, có chặn xuất hay không.

Hướng bị cấm:

- `llm/providers/**` không được import `workflow`, `runtime.pipeline`, `rendering`.
- `policy/**` không được import `llm/providers` hoặc `runtime.pipeline`.
- `payload/**` không được import `llm/providers`, `workflow`, `rendering`.
- `memory/**` không được import `llm/providers`, `workflow`, `rendering`.
- Tổng thể `translation/**` không được import `services.rendering`.

Các quy tắc này được thực thi dần dần bởi `backend/scripts/devtools/check_pipeline_architecture.py`. Hiện tại chặn các phụ thuộc ngoài ranh giới mới; các mục tương thích lịch sử được di chuyển theo lô.

Current architecture gates cover:

- Translation root allows only package initialization and README; no new root large files
- Production external directories may use translation contracts only through `services.translation.public`
- `public/` must maintain lazy export to avoid eager import pulling workflow/rendering
- Deleted shim paths may not be referenced
- Translation internals may not import `runtime.pipeline` directly
- Translation overall may not import `services.rendering` directly; only narrow exception is `workflow/execution_runner.py` render source prewarm

## Luồng chính

1. `core/ocr/` đọc `document.v1.json` trung gian thống nhất và trích xuất các block trang
2. Nếu điểm vào cung cấp JSON thô của provider, `document_schema/adapters.py` chuyển đổi sang `document.v1` trước
3. `workflow/translation_workflow.py` tạo mẫu dịch theo trang và tải payload
4. `core/orchestration` hoàn thiện các vùng bố cục và metadata điều phối
5. `services/continuation` tiêu thụ `continuation_hint` từ upstream trước, sau đó fallback theo quy tắc, hợp nhất các đoạn liên tục thành đơn vị dịch thống nhất
6. `services/policy` quyết định các block nào sẽ bỏ qua dựa trên chế độ
7. `llm` gọi mô hình theo batch để dịch, caching, thử lại; xử lý đồng nhất kiểm soát placeholder/segment/fallback
8. `core/payload` điền lại kết quả dịch vào payload trang và lưu JSON cuối cùng

Các quy ước bổ sung:

- Luồng chính dịch không nên hiểu trực tiếp cấu trúc JSON thô của bất kỳ OCR provider nào
- Kết quả lưu trữ mặc định hiện tại của luồng chính dịch là "per-page translation payload + translation-manifest.json"; tầng này xử lý nội dung artifact và giao thức ánh xạ, không phải tên tệp PDF cuối cùng hoặc chế độ kết xuất
- Các block đã được gắn thẻ `skip_translation` trong `document.v1` phải bị chặn tại giai đoạn trích xuất `core/ocr/json_extractor.py`; không được rò rỉ vào các ứng viên dịch
- Ngữ nghĩa mở rộng body như `abstract` có thể tiếp tục vào dịch; các block được provider đánh dấu skip rõ ràng như `reference_entry`, `formula_number` không nên vào payload
- Giai đoạn trích xuất đọc ưu tiên các trường rõ ràng `content.kind / layout_role / semantic_role / structure_role / policy.translate`; luồng chính mặc định không còn suy luận văn bản body từ `derived.role / sub_type / raw_type / tags`
- Giai đoạn trích xuất mở rộng `continuation_hint` trên các block thành các trường `ocr_continuation_*` trong payload
- Tiếp nối hiện sử dụng chiến lược provider-first: ưu tiên tiêu thụ các gợi ý `intra_page` cùng trang của provider; các gợi ý `cross_page` giữa các trang chỉ được tiêu thụ có kiểm soát khi "các trang liền kề + thứ tự rõ ràng + vùng bố cục chạm ranh giới đọc trang-cuối/trang-đầu + đủ độ dài văn bản"; các trường hợp khác được giữ lại nhưng không trực tiếp thúc đẩy ghép nối
- Để khắc phục sự cố chuẩn hóa OCR, chỉ cần kiểm tra `document.v1.report.json` trước
- Khi phía Python đọc tóm tắt báo cáo, nên đi qua `document_schema/reporting.py` ưu tiên

Danh sách trắng body mặc định hiện được cố định như sau:

- `content.kind == "text"`
- Và `policy.translate == true`

Ý nghĩa:

- Việc body có vào chuỗi dịch hay không nên được quyết định tại giai đoạn normalize / adapter
- Luồng chính dịch mặc định không còn đoán lại `footer/header/page_number/table/image/code/reference_content`
- Các quy tắc skip / viết lại cục bộ cũ như `ref_text`, `mixed_literal`, `metadata_fragment` đã thoát khỏi luồng chính mặc định

## Bảng thuật ngữ v1

Chuỗi bảng thuật ngữ hiện tại có hai lớp đầu vào:

- Tài nguyên bảng thuật ngữ được đặt tên: được Rust API lưu trữ trước, tham chiếu thông qua `glossary_id`
- Các thuật ngữ inline trong tác vụ: được truyền trực tiếp cùng tác vụ dưới dạng `glossary_entries`

Trước khi vào Python, phía Rust hoàn thành:

- Chuẩn hóa mục thuật ngữ
- Loại bỏ trùng lặp
- Hợp nhất bảng thuật ngữ được đặt tên và các thuật ngữ inline
- Thống kê ghi đè cho cùng `source`

Giai đoạn dịch hiện chỉ thực hiện hai việc:

- Tiêm bảng thuật ngữ đã hợp nhất vào ngữ cảnh điều khiển LLM như gợi ý ưu tiên dịch
- Đếm số lần trúng thuật ngữ sau khi dịch và ghi vào `translation-manifest.json`, các tệp chẩn đoán và tóm tắt quy trình

Quy tắc tiêm runtime:

- Trước khi gọi LLM, khớp các thuật ngữ với văn bản nguồn của mục hoặc batch hiện tại; chỉ ghi các mục thuật ngữ đã khớp vào prompt
- Bảng viết tắt cũng được tiêm sau khi khớp văn bản nguồn để tránh các viết tắt không liên quan làm ô nhiễm đoạn hiện tại
- Các thuật ngữ cứng như `preserve` / `canonical` chỉ áp dụng cho các đoạn văn bản nguồn đã khớp; không có thay thế vô điều kiện trên toàn bộ sách
- Nếu văn bản nguồn không khớp với thuật ngữ hoặc viết tắt nào, mục đó sẽ không vào prompt hiện tại và không ảnh hưởng đến khóa bộ nhớ đệm hiện tại

Các việc không được thực hiện:

- Không ép buộc thay thế sau dịch
- Không đảm bảo mọi thuật ngữ đều được áp dụng
- Không phân tích cú pháp trực tiếp tệp Excel

## Tác nhân v1

Tác nhân hiện tại không phải là quy trình độc lập cũng không phải là cổng provider mới; nó là sự đóng gói khả năng dựa trên vai trò trong tầng dịch vụ dịch. Tái sử dụng `llm/shared/provider_runtime.py` hiện có; không bỏ qua mô hình đã thiết lập, base_url, api_key, giao thức đầu ra có cấu trúc.

Các vai trò đã triển khai:

- `TerminologyAgent`
  Khớp các thuật ngữ và viết tắt với văn bản nguồn hiện tại để tránh nhồi nhét toàn bộ bảng thuật ngữ vào mọi prompt.
- `ConsistencyReviewerAgent`
  Thực hiện kiểm tra chất lượng dựa trên quy tắc đối với kết quả dịch, ví dụ: residue tiếng Anh, không nhất quán placeholder, bỏ sót thuật ngữ.
- `RepairAgent`
  Xây dựng tác vụ sửa chữa LLM cho các vấn đề có thể khắc phục; chỉ sửa mục hiện tại mà không mở rộng ngữ cảnh.
- `TranslationAgentRuntime`
  Thực thi tác vụ tác nhân LLM thống nhất; mặc định sử dụng `request_chat_content` của provider đang hoạt động.
- `TranslationAgentCoordinator`
  Điểm vào điều phối tầng dịch vụ; liên kết thuật ngữ/đánh giá/sửa chữa thành giao diện ổn định.

Ranh giới phiên bản đầu tiên:

- Tác nhân có thể xây dựng tác vụ, thực thi tác vụ, phân tích kết quả, ghi chẩn đoán hoặc artifact đánh giá
- Tác nhân không đọc trực tiếp tệp OCR, quyết định quy trình cấp trang hoặc ghi PDF cuối cùng
- Tác nhân không giới thiệu SDK mới; các provider mới vẫn kết nối thông qua `llm/shared/provider_registry.py` trước
- Điều phối đa tác nhân ban đầu vẫn nằm trong dịch; API bên ngoài chỉ tiết lộ các artifact và chẩn đoán ổn định

Tích hợp mainline hiện tại:

- Sau các batch dịch và sửa chữa văn bản bị lỗi,进入 giai đoạn hậu xử lý `agent_repair`
- Mặc định `RETAIN_TRANSLATION_REPAIR_PROFILE=fast`; tác nhân sửa chữa sử dụng ngân sách nhỏ cho sửa chữa dự phòng để tránh một vài đoạn bất thường kéo toàn bộ sách
- `fast` mặc định tối đa 8 ứng viên sửa chữa; giảm bằng cách chặn số lượng mục chưa dịch khi ứng viên ít
- `quality` mở rộng ngân sách sửa chữa tác nhân; phù hợp với các tác vụ ngoại tuyến ưu tiên chất lượng
- Có thể vô hiệu hóa hoàn toàn thông qua `RETAIN_TRANSLATION_AGENT_REPAIR_LIMIT=0`
- Có thể bỏ qua giai đoạn sửa chữa tác nhân thông qua `RETAIN_TRANSLATION_AGENT_REPAIR=0`
- Chỉ sửa chữa các vấn đề có thể khắc phục như residue tiếng Anh, bỏ sót thuật ngữ, lỗi giao thức shell, v.v.
- Các lỗi cứng như đếm/lệnh placeholder, mất cân bằng dấu phân cách toán học, tràn ngữ cảnh, v.v. chỉ ghi chẩn đoán skip; tác nhân sửa chữa không đoán

Repair profile:

- `RETAIN_TRANSLATION_REPAIR_PROFILE=fast`
  Default mode. Skips heavy garbled reconstruction; retains small-budget agent repair and final empty translation consolidation.
- `RETAIN_TRANSLATION_REPAIR_PROFILE=quality`
  Quality priority. Enables larger agent repair and final recovery budget; suits speed-insensitive tasks.
- Individual overrides:
  `RETAIN_TRANSLATION_GARBLED_RECONSTRUCTION=1`
  `RETAIN_TRANSLATION_AGENT_REPAIR=0|1`
  `RETAIN_TRANSLATION_AGENT_REPAIR_LIMIT=N`
  `RETAIN_TRANSLATION_FINAL_RECOVERY_MAX_ITEMS=N`

Future progression order:

1. Consolidate more existing "post-translation check / repair / term injection" into coordinator first.
2. Then connect failure retry, English residue repair, term consistency repair into configurable pipeline.
3. Finally consider cross-paragraph consistency agent or document-level term memory agent; avoid changing main flow too much initially.

## Đồng thời và lập lịch thất bại

- Số lượng worker dịch mặc định của API chính thức DeepSeek được Rust API phân tích cú pháp là `1000`. Thân yêu cầu `translation.workers` vẫn có thể ghi đè.
- Nhóm kết nối HTTP Python mở rộng theo `configured_workers`; giới hạn mặc định là `1000`; có thể tạm thời ngăn chặn thông qua `RETAIN_TRANSLATION_HTTP_POOL_MAX`.
- Kênh dịch chính mặc định thực hiện 1 lần thử HTTP. Lỗi timeout, 429, 5xx, kết nối sẽ nhanh chóng giải phóng worker và đưa vào hàng đợi thử lại vận chuyển đuôi để tránh một mục thất bại chặn các đoạn tiếp theo.
- Thử lại vận chuyển đuôi thực thi sau hàng đợi chính; mặc định thực hiện 2 lần thử HTTP với thời gian chờ dài hơn.

## Mô tả chế độ

- `fast`
  Không bật bộ phân loại.
- `sci`
  Dành cho bài báo và tài liệu kỹ thuật; cũng thực hiện suy luận miền.
- `precise`
  Bật bộ phân loại LLM; chỉ phán đoán bổ sung cho các block OCR đáng ngờ.

## Lưu ý tương thích cấu hình chính sách

`build_translation_policy_config()` trong `services/policy/config.py` hiện vẫn giữ lại một số trường kế thừa không còn là một phần của ngữ nghĩa mainline mặc định:

- `enable_narrow_body_noise_skip`
- `enable_metadata_fragment_skip`
- `metadata_fragment_max_page_idx`
- `enable_reference_zone_skip`
- `enable_reference_tail_skip`

Quy ước hiện tại:

- Mainline mặc định không sử dụng các trường này để tái tạo logic skip cũ
- Hiện chỉ được giữ lại như bề mặt tương thích đã lỗi thời để ngăn các bài kiểm tra/caller cũ báo lỗi ngay lập tức
- Mã mới không nên thiết kế hành vi dựa trên các trường này

Lưu ý:

- Đây là hợp đồng chính sách dịch nội bộ Python, không phải hợp đồng API HTTP bên ngoài
- Quyết định chính "có dịch hay không" vẫn nên đến từ chính sách block rõ ràng trong `document.v1`

## Quy tắc hợp tác

Nếu module dịch được duy trì riêng biệt, tầng này chỉ chịu trách nhiệm "chuyển đổi `document.v1.json` thành các artifact dịch ổn định".

- Được phép sửa đổi chiến lược, đồng thời, bảng thuật ngữ, lập lịch LLM, lưu trữ payload, chẩn đoán dịch tại đây
- Không xử lý trực tiếp cấu trúc OCR thô của provider tại đây; không nhồi nhét logic kết xuất PDF nguồn trở lại
- Giao thức đầu ra chính thức hiện tại là "per-page translation payload + `translation-manifest.json`"; tầng kết xuất chỉ nên tiêu thụ giao thức này
- Nếu sửa đổi cấu trúc payload, ngữ nghĩa trường manifest hoặc phương thức phát hiện tệp mặc định, phải cập nhật đồng bộ `runtime/pipeline`, `rendering`, README và kiểm thử
- Bảng thuật ngữ hiện là ràng buộc gợi ý dịch, không phải quy tắc của tầng kết xuất hay tầng OCR; không lan truyền logic bảng thuật ngữ sang các module khác

</content>