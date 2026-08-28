# Đặc tả Schema Tài liệu

`scripts/services/document_schema/` định nghĩa cấu trúc tài liệu trung gian thống nhất.

Hiện đang được sử dụng chính thức:

- Tên schema: `normalized_document_v1`
- Phiên bản schema: `1.1`
- Tên tệp mặc định: `document.v1.json`
- Tên tệp báo cáo mặc định: `document.v1.report.json`
- Schema đọc được bằng máy: `document.v1.schema.json`
- Trình xác thực Python: `validator.py`

JSON này hiện là đầu vào OCR tiêu chuẩn cho quy trình dịch/render chính.

## Ranh giới giai đoạn

Lớp `document_schema` chỉ chịu trách nhiệm cho việc bàn giao giai đoạn OCR / Chuẩn hóa; nó không đảm nhận trách nhiệm dịch hoặc render ở các giai đoạn hạ lưu.

Đầu vào và đầu ra chính thức được cố định như sau:

- Đầu vào:
  Payload OCR thô của provider, thư mục tệp thô của provider, ngữ cảnh PDF nguồn cần thiết
- Đầu ra:
  `document.v1.json` và `document.v1.report.json`

Không chịu trách nhiệm rõ ràng về:

- Chiến lược dịch, kiểm soát thuật ngữ hoặc lưu trữ artifact dịch
- Ghi đè bố cục, biên dịch Typst hoặc đầu ra PDF cuối cùng
- Để lộ các trường riêng tư của provider như hợp đồng chính trong các giai đoạn hạ lưu

Các điểm bàn giao ổn định:

- Khi giai đoạn OCR kết thúc tại đây, hạ lưu chỉ nên phụ thuộc vào `document.v1.json`
- `document.v1.report.json` chỉ phục vụ xác thực, khắc phục sự cố và tóm tắt tương thích; nó không phải là đầu vào chính cho dịch/render
- Dấu vết thô của provider được giữ lại để phân tích hồi cứu nhưng không được trở thành phụ thuộc của logic chính dịch / render

## Đặc tả phân tầng trường

Các trường trong `document.v1` không còn nên được coi là không phân biệt. Quy ước hiện tại chia chúng thành ba lớp:

1. Lớp cấu trúc cốt lõi
2. Lớp dấu vết chung
3. Lớp dấu vết thô của provider

### 1. Lớp cấu trúc cốt lõi

Lớp này chứa các trường ổn định mà mã dịch, render và chính sách có thể phụ thuộc trực tiếp.

Cấp cao nhất:

- `schema`
- `schema_version`
- `document_id`
- `doc_id`
- `source.provider`
- `page_count`
- `pages`
- `assets`
- `derived`
- `markers`

Cấp trang:

- `page`
- `page_index`
- `width`
- `height`
- `unit`
- `blocks`

Cấp block:

- `block_id`
- `page_index`
- `order`
- `reading_order`
- `geometry`
- `content`
- `layout_role`
- `semantic_role`
- `structure_role`
- `policy`
- `provenance`
- `type`
- `sub_type`
- `bbox`
- `text`
- `lines`
- `segments`
- `tags`
- `derived`
- `continuation_hint`

Nguyên tắc:

- Logic chính hạ lưu nên ưu tiên chỉ đọc lớp này
- Khi tích hợp các provider mới, mục tiêu đầu tiên là ánh xạ ổn định JSON thô sang lớp này
- Các quy trình chính mới nên ưu tiên tiêu thụ `geometry/content/layout_role/semantic_role/structure_role/policy/provenance`
- Các trường kế thừa `type/sub_type/bbox/text/lines/segments` được giữ lại như lớp tương thích; không mở rộng ngữ nghĩa thêm nữa
- Chuỗi dịch mặc định không nên suy luận văn bản nội dung từ `type/sub_type/tags/derived/source.raw_*`
- `policy.translate` là điểm vào chính thức để xác định liệu văn bản nội dung có đi vào chuỗi dịch hay không

Các trường luồng bố cục trong `content`:

- `content.text`: văn bản cấp block, giữ lại các ngắt dòng cần thiết từ provider
- `content.line_texts`: danh sách các văn bản dòng trong block, từ ngắt dòng rõ ràng của provider hoặc các bản ghi dòng ổn định do adapter xây dựng
- `content.text_flow`: hợp đồng bố cục hạ lưu; hiện có giá trị `flow` hoặc `preserve_lines`

Ranh giới trách nhiệm của `text_flow`:

- `flow` chỉ định văn bản nội dung thông thường; dịch và render có thể xử lý như các đoạn văn tự nhiên mà không buộc phải giữ các ngắt dòng trực quan của OCR
- `preserve_lines` chỉ định cấu trúc dòng trong block có giá trị ngữ nghĩa, ví dụ: mục lục, danh sách đánh số, danh sách mục, các block dòng ngắn có cấu trúc
- Việc xác định `preserve_lines` phải được hoàn thành tại lớp chuẩn hóa / adapter; lớp render chỉ tiêu thụ hợp đồng này và không nên đoán lại cấu trúc danh sách bằng regex
- Nếu các provider như Paddle chỉ cung cấp `block_label=text` nhưng `block_content` đã có các ngắt dòng rõ ràng ổn định, adapter nên nâng cấp các ngắt dòng này thành `line_texts + text_flow` thay vì để lộ các trường riêng tư của provider ở hạ lưu

### 2. Lớp dấu vết chung

Lớp này không phải là phụ thuộc cứng của quy trình chính, nhưng nhiều provider được khuyến khích căn chỉnh với các trường này khi có thể.

Các trường hiện có và sẵn sàng để tiếp tục sử dụng bao gồm:

- `content_is_rich`
- `content_format`
- `content_length`
- `content_line_count`
- `asset_key`
- `asset_url`
- `asset_resolved`
- `markdown_match_text`
- `markdown_match_found`
- `markdown_match_count`

Nguyên tắc:

- Lớp này chủ yếu phục vụ khắc phục sự cố, điều chỉnh và các tính năng cải tiến trong tương lai
- Có thể được đọc một cách thận trọng bởi mã chính sách
- Không nên thay thế `type/sub_type/tags/derived`

### 3. Lớp dấu vết thô của Provider

Lớp này chỉ dành cho phân tích hồi cứu và khắc phục sự cố; logic nghiệp vụ hạ lưu không được phụ thuộc trực tiếp vào nó.

Bao gồm nhưng không giới hạn ở:

- `source.raw_*`
- `metadata.raw_*`
- `layout_det_*`
- Id/đường dẫn/điểm/số/nhãn thô của provider
- Paddle `model_settings`
- Paddle `layout_det_res`
- Paddle `markdown.images` thô
- Các trường phát hiện thô của provider khác

Nguyên tắc:

- Lớp này có thể được giữ lại một cách toàn diện
- Nhưng không nên được coi là điểm vào ngữ nghĩa thống nhất
- Nếu một trường được cung cấp ổn định bởi nhiều provider trong tương lai, hãy xem xét nâng cấp lên "lớp dấu vết chung"

### Nguyên tắc đọc hạ lưu

Thứ tự được khuyến nghị:

1. Đọc lớp cấu trúc cốt lõi trước
2. Đọc lớp dấu vết chung khi cần thiết
3. Chỉ các script khắc phục sự cố hoặc nghiên cứu provider mới nên đọc lớp dấu vết thô

Nói cách khác:

- Quy trình chính dịch/render nên ưu tiên `geometry/content/layout_role/semantic_role/structure_role/policy/provenance`
- Để đưa ra phán đoán nâng cao, các trường dấu vết chung như `content_format` có thể được đọc một cách thận trọng
- Không viết logic chính dựa trực tiếp vào `layout_det_score`, `source.raw_type`, `metadata.raw_*`

## Mục tiêu thiết kế

- Cô lập các cấu trúc thô của OCR provider thượng nguồn tại lớp adapter
- Cung cấp một hợp đồng trung gian ổn định cho dịch, render, chính sách và API
- Tránh thiết kế quá mức; không ép các phán đoán ngữ nghĩa OCR không ổn định vào hệ thống kiểu chính

## Quy trình hiện tại

Quy ước quy trình chính:

1. Provider thượng nguồn xuất kết quả thô của chính nó trước
2. Adapter chuyển đổi kết quả thô thành `normalized_document_v1`
3. `services/translation` và `services/rendering` hoạt động độc quyền xung quanh cấu trúc thống nhất này

Lấy triển khai provider hiện tại làm ví dụ:

- OCR thô: `ocr/unpacked/layout.json`
- Trung gian thống nhất: `ocr/normalized/document.v1.json`
- Báo cáo chuẩn hóa: `ocr/normalized/document.v1.report.json`
- Đặc tả giai đoạn: `specs/normalize.spec.json` (`normalize.stage.v1`)

Ghi chú:

- `layout.json` thô được giữ lại cho adapter, gỡ lỗi và phân tích hồi cứu
- Quy trình chính dịch/render ưu tiên tiêu thụ `document.v1.json`
- `document.v1.report.json` được sử dụng để thăm dò adapter, hoàn thiện giá trị mặc định và tóm tắt xác thực schema
- Worker chuẩn hóa được gọi bởi quy trình chính Rust hiện yêu cầu `--spec <job_root/specs/normalize.spec.json>`
- Chỉ sử dụng `scripts/entrypoints/validate_document_schema.py` để xác thực schema / adapter thủ công cục bộ

## Quy ước Adapter

OCR thô của provider không nên đi trực tiếp vào luồng chính dịch/render.

Điểm vào thống nhất tại:

- `services/document_schema/adapters.py`

Giao diện adapter hiện tại:

- `detect_ocr_provider(payload)`
- `adapt_payload_to_document_v1(...)`
- `adapt_payload_to_document_v1_with_report(...)`
- `adapt_path_to_document_v1(...)`
- `adapt_path_to_document_v1_with_report(...)`
- `register_ocr_adapter(...)`

Điểm vào quy ước chung:

- `services/document_schema/providers.py`
  Hằng số định danh provider OCR ổn định; adapter, registry fixture và script hồi quy nên chia sẻ lớp này ưu tiên
- `services/pipeline_shared/`
  `pipeline_summary.json`, nhãn stdout, JSON IO và quy tắc chọn source-json dùng chung cho luồng chính
- `services/mineru/contracts.py`
  Chỉ giữ lại tên tệp thô và quy ước đặt tên thư mục riêng của provider MinerU

Các adapter provider chính thức hiện tại bao gồm:

- `mineru -> document.v1`
- `mineru_content_list_v2 -> document.v1`
- `generic_flat_ocr -> document.v1`
- `paddle -> document.v1`

## Phân tầng Adapter Provider

Các adapter hiện tại được chia thành hai lớp:

1. Khung chung
2. Lớp lắp ráp provider

Khung chung nằm tại:

- `services/document_schema/provider_adapters/common/`

Hiện bao gồm:

- `document_builder.py`
  Chịu trách nhiệm lắp ráp `document.v1` cấp cao nhất thống nhất
- `page_builder.py`
  Chịu trách nhiệm lắp ráp bản ghi trang thống nhất
- `block_builder.py`
  Chịu trách nhiệm lắp ráp bản ghi block thống nhất
- `normalize.py`
  Chịu trách nhiệm về các helper chuẩn hóa chung cho `bbox/polygon/segments/lines`, v.v.
- `relations.py`
  Cung cấp khung quan hệ trong trang để "suy luận ngữ nghĩa block hiện tại từ anchor trước đó"
- `specs.py`
  Định nghĩa các đặc tả block/trang trung gian mà provider ban đầu ánh xạ nội bộ

Nguyên tắc:

- `common/` không đọc trực tiếp bất kỳ tên trường thô nào của OCR provider cụ thể
- `common/` chỉ nhận các đặc tả trung gian đã được phân tích bởi lớp provider
- Bằng cách này, việc tích hợp các provider OCR mới chỉ yêu cầu chuyển đổi JSON thô thành đặc tả trước, sau đó chuyển giao cho các trình xây dựng chung

Lớp lắp ráp provider nằm tại:

- `services/document_schema/provider_adapters/`

Trong đó:

- `paddle/`
  Sử dụng phân rã dựa trên thư mục; chịu trách nhiệm phân tích `layoutParsingResults` thô của Paddle thành đặc tả chung.
  Hiện được chia nhỏ hơn nữa thành reader, relations, page trace, rich-content trace.
  Lớp reader hiện hội tụ giao diện thông qua ngữ cảnh trang/block nội bộ, không còn phân tán các tham số dấu vết markdown/bố cục.
- `mineru_content_list_v2_adapter.py`
  Đã tích hợp với các trình xây dựng chung nhưng chưa được phân rã thư mục hoàn toàn như Paddle
- `generic_flat_ocr_adapter.py`
  Hiện vẫn là adapter chuyển tiếp mỏng nhất
- `mineru`
  Luồng chính vẫn nằm trong `services/mineru/document_v1.py`; hiện không nằm trong phạm vi tổng quát này

Nói cách khác, khi mở rộng các provider OCR sau này, ưu tiên không phải là tiếp tục xếp chồng "các tệp adapter lớn", mà là:

1. JSON thô của provider -> đặc tả nội bộ của provider
2. Đặc tả -> trình xây dựng `common`
3. Adapter được đăng ký trong `adapters.py`
4. Fixture được tích hợp vào kiểm tra hồi quy

Dấu vết nội dung phong phú của Paddle cũng đã được chia nhỏ hơn nữa thành ba lớp:

- Hồ sơ nội dung: `content_profile.py`
- Tham chiếu tài sản: `asset_links.py`
- Khớp nhẹ Markdown: `markdown_match.py`

`rich_content.py` chỉ giữ lại điểm vào tổng hợp; không còn mang các chi tiết phân tích cụ thể.

Ghi chú:

- Paddle `content_format / asset_* / markdown_match_*` hiện được phân loại dưới "lớp dấu vết chung"
- Paddle `layout_det_* / model_settings / markdown.images` hiện được phân loại dưới "lớp dấu vết thô của provider"

Các provider mới có thể tham khảo:

- `services/document_schema/provider_adapters/provider_adapter_template.py`
- `services/document_schema/provider_adapters/paddle/`

Khi thêm provider OCR mới, cách tiếp cận đúng đắn là:

1. Thêm adapter provider mới
2. Chuyển đổi JSON thô thành `normalized_document_v1`
3. Chạy xác thực schema ngay sau đầu ra của adapter
4. Hạ lưu tiếp tục chỉ tiêu thụ `document.v1.json`

Thứ tự tích hợp được khuyến nghị:

1. Định nghĩa quy tắc đặt trường trước
   Quyết định trường nào đi vào `content/layout_role/semantic_role/structure_role/policy`, trường nào chỉ ở lại `tags/derived`, trường nào chỉ ở lại `metadata/source`.
2. Chuẩn bị fixture thô tối thiểu
   Đặt trong `scripts/devtools/tests/document_schema/fixtures/`.
3. Viết và đăng ký adapter
   Ưu tiên sử dụng lại các hằng số provider chung từ `providers.py`; không viết các chuỗi trần riêng biệt trong adapter, fixture và mục hồi quy.
   Nếu cấu trúc thô phức tạp, ưu tiên phân chia theo trách nhiệm `payload_reader / block_labels / relations / content_extract / trace` thay vì tiếp tục xếp chồng các tệp đơn.
4. Đăng ký fixture trong `fixtures/registry.py`
5. Chạy `regression_check.py`
   Để detector, adapt, validation, extractor vượt qua kiểm tra khói trong một lần chạy.

## Điểm vào xác thực

Điểm vào xác thực dài hạn:

- `scripts/entrypoints/validate_document_schema.py`
- `scripts/devtools/tests/document_schema/regression_check.py`

Hiện hỗ trợ hai chế độ sử dụng:

1. Xác thực trực tiếp `document.v1.json` đã tạo trước
2. Thực thi `adapter -> defaults -> validation` trên JSON OCR thô và xuất báo cáo

Ví dụ:

```bash
python scripts/entrypoints/validate_document_schema.py output/.../ocr/normalized/document.v1.json
python scripts/entrypoints/validate_document_schema.py output/.../ocr/unpacked/layout.json --adapt --document-id demo --write-report /tmp/document-schema-report.json
```

Báo cáo hiện bao gồm:

- Đường dẫn đầu vào
- Kết quả phát hiện adapter/provider
- Thống kê hoàn thiện giá trị mặc định
- Tóm tắt xác thực schema

Quy ước hiện tại của `validate_document_schema.py --write-report`:

- Khi `mode = "adapt"`:
  - `input_path`
  - `normalization`
  - `normalization_summary`
  - `validation`
- Khi `mode = "validate"`:
  - `input_path`
  - `validation`

Nói cách khác:

- Để xem chi tiết adapter / defaults / phát hiện đầy đủ, xem `normalization`
- Để xem tóm tắt nhẹ ổn định, ưu tiên `normalization_summary`
- Để xem kết quả xác thực cấp cao nhất, xem `validation`

Điểm vào tiêu thụ thống nhất:

- `services/document_schema/reporting.py`
- `load_normalization_report(path)`
- `build_normalization_summary(report)`

Quy ước:

- Khi phía Python chỉ cần hiển thị provider / provider đã phát hiện / số trang quan sát / số block quan sát / số trường mặc định / tóm tắt xác thực, ưu tiên sử dụng hai helper này
- Không viết lại kiểu đọc `report['defaults']['pages_seen']` riêng biệt trong `mineru/summary.py`, script khắc phục sự cố hoặc các lớp API tương lai
- Chỉ sử dụng trực tiếp dict báo cáo khi cần báo cáo gốc đầy đủ; việc giữ lại các trường gốc không bị ngăn cản

Kiểm tra khói hồi quy:

```bash
python scripts/devtools/tests/document_schema/regression_check.py
python scripts/devtools/tests/document_schema/regression_check.py --write-report /tmp/document-schema-regression.json
```

Script hồi quy này hiện thực hiện các xác thực nghiêm ngặt thay vì chỉ in log đơn giản:

- Registry adapter phải bao gồm các provider chính thức hiện tại
- `document.v1.json` hiện tại phải vượt qua xác thực schema
- layout thô / `content_list_v2.json` / fixture chung / fixture paddle phải đều được tự động phát hiện, chuyển đổi và vượt qua xác thực schema lại
- Các đường dẫn provider được chỉ định rõ ràng cũng phải hoạt động, ngăn chặn "tự động phát hiện vượt qua nhưng gọi rõ ràng bị hồi quy"
- Các provider như Paddle yêu cầu các khẳng định ngữ nghĩa bổ sung, khóa tối thiểu:
  - `header/footer`
  - `image_caption/table_caption`
  - `table_footnote`
  - `display_formula -> formula segment`

Khuyến nghị:

- Các provider mới nên thêm ít nhất một "khẳng định ngữ nghĩa provider"
- Không chỉ nhìn vào `pages / blocks`; nếu không dễ bỏ sót các hồi quy phân loại

## Quy tắc hoàn thiện giá trị mặc định

Tệp `document.v1.json` phiên bản hiện tại do adapter tạo ra trải qua quá trình hoàn thiện giá trị mặc định ổn định thống nhất trước khi đi vào luồng chính.

### Các trường cứng

Các trường này không thể được đoán tự động; việc thiếu sẽ được coi là lỗi cấu trúc:

- Cấp tài liệu:
  - `schema`
  - `schema_version`
  - `document_id`
  - `source`
  - `pages`
- Cấp trang:
  - `width`
  - `height`
  - `unit`
  - `blocks`
- Cấp block:
  - `block_id`
  - `geometry`
  - `content`
  - `layout_role`
  - `semantic_role`
  - `structure_role`
  - `policy`
  - `provenance`

### Các trường mềm

Các trường này cho phép lớp hoàn thiện giá trị mặc định cung cấp giá trị mặc định:

- Cấp tài liệu:
  - `derived -> {}`
  - `markers -> {}`
  - `page_count -> len(pages)`
- Cấp trang:
  - `page_index -> chỉ số trang hiện tại`
- Cấp block:
  - `page_index -> chỉ số trang hiện tại`
  - `order -> thứ tự block hiện tại`
  - `reading_order -> order`
  - `geometry -> {bbox:[0,0,0,0]}`
  - `content -> {kind:"unknown", text:""}`
  - `layout_role -> "unknown"`
  - `semantic_role -> "unknown"`
  - `structure_role -> ""`
  - `policy -> {translate:false, translate_reason:"missing_contract_fields"}`
  - `provenance -> {provider:"", raw_label:"", raw_sub_type:"", raw_bbox:[0,0,0,0], raw_path:""}`
  - `tags -> []`
  - `derived -> {role:"", by:"", confidence:0.0}`
  - `continuation_hint -> {source:"", group_id:"", role:"", scope:"", reading_order:-1, confidence:0.0}`
  - `metadata -> {}`
  - `source -> {}`

Nguyên tắc:

- Lớp hoàn thiện giá trị mặc định chỉ điền các trường có giá trị mặc định ổn định được định nghĩa rõ ràng
- Lớp hoàn thiện giá trị mặc định chỉ điền vào các ô trống; các đặc tả ngữ nghĩa chính thức vẫn được hợp nhất trong `contract_v1.py`
- Các lỗi cấu trúc thực sự vẫn được trình xác thực chặn lại

## Cấu trúc cấp cao nhất

Các trường cấp cao nhất:

- `schema: str`
  Cố định là `normalized_document_v1`
- `schema_version: str`
  Phiên bản mới nhất hiện tại là `1.1`
  Trình xác thực chỉ chấp nhận phiên bản hiện tại `1.1`
- `document_id: str`
  Định danh tài liệu, thường tương ứng với job hoặc tài liệu đầu vào
- `source: dict`
  Thông tin nguồn cấp cao nhất, ghi lại provider và các tệp thô
- `page_count: int`
  Số lượng trang
- `pages: list[dict]`
  Danh sách các trang
- `derived: dict`
  Ghi chú phái sinh cấp tài liệu hoặc nhận xét hậu xử lý
- `markers: dict`
  Các điểm đánh dấu ổn định cấp tài liệu, ví dụ: điểm bắt đầu tham chiếu

Ví dụ:

```json
{
  "schema": "normalized_document_v1",
  "schema_version": "1.1",
  "document_id": "20260330145544-14ab20",
  "source": {},
  "page_count": 1,
  "pages": [],
  "derived": {},
  "markers": {}
}
```

## Cấu trúc trang

Mỗi đối tượng trang hiện chứa:

- `page_index: int`
  Bắt đầu từ `0`
- `width: number`
  Chiều rộng trang
- `height: number`
  Chiều cao trang
- `unit: str`
  Hiện sử dụng `pt`
- `blocks: list[dict]`
  Danh sách các block trang

Ràng buộc:

- `pages[i].page_index` phải khớp với thứ tự mảng
- Thứ tự block trong `blocks` được chỉ định rõ ràng bởi `order`

## Cấu trúc block

Mỗi block hiện chứa:

- `block_id: str`
  Id block ổn định, ví dụ: `p001-b0000`
- `page_index: int`
  Trang chứa block
- `order: int`
  Thứ tự trong trang
- `reading_order: int`
  Thứ tự đọc đã chuẩn hóa
- `geometry: dict`
  Các trường hình học ổn định, hiện bao gồm ít nhất `bbox`
- `content: dict`
  Các trường nội dung ổn định, hiện bao gồm ít nhất `kind` và `text`
- `layout_role: str`
  Vai trò bố cục rõ ràng
- `semantic_role: str`
  Vai trò ngữ nghĩa rõ ràng
- `structure_role: str`
  Vai trò cấu trúc nội dung rõ ràng
- `policy: dict`
  Chính sách thực thi rõ ràng, hiện bao gồm ít nhất `translate`
- `provenance: dict`
  Nhãn thô của provider và thông tin truy xuất nguồn gốc
- `type: str`
  Loại chính tương thích
- `sub_type: str`
  Loại phụ tương thích
- `bbox: [x0, y0, x1, y1]`
  Hộp bao quanh cấp block tương thích
- `text: str`
  Văn bản thuần đã chuẩn hóa của block
- `lines: list[dict]`
  Cấu trúc cấp dòng
- `segments: list[dict]`
  Cấu trúc phẳng span/segment
- `tags: list[str]`
  Các thẻ phái sinh nhẹ
- `derived: dict`
  Các kết luận ngữ nghĩa phái sinh mạnh hơn
- `continuation_hint: dict`
  Gợi ý liên tục đoạn văn từ provider hoặc lớp cấu trúc thượng nguồn
- `metadata: dict`
  Metadata gỡ lỗi/ánh xạ
- `source: dict`
  Thông tin nguồn thô của provider

## Quy ước `continuation_hint`

`continuation_hint` là một trường ổn định cấp block được sử dụng để mang gợi ý từ provider OCR hoặc lớp cấu trúc tiếp theo cho biết "các block này ban đầu thuộc cùng một đoạn văn".

Các trường hiện tại:

- `source`
  Hiện giữ lại `"" | "provider"`
- `group_id`
  Id ổn định cho cùng một nhóm liên tục
- `role`
  `"" | "single" | "head" | "middle" | "tail"`
- `scope`
  `"" | "intra_page" | "cross_page"`
- `reading_order`
  Thứ tự đọc trong nhóm từ provider; `-1` khi không xác định
- `confidence`
  `0.0 ~ 1.0`

Các ràng buộc hành vi hiện tại:

- `document.v1` chỉ chịu trách nhiệm lưu trữ ổn định các gợi ý; không hardcode bất kỳ trường riêng tư nào của provider ở lớp schema
- Luồng chính dịch hiện ưu tiên tiêu thụ các gợi ý với `source="provider"` và `scope="intra_page"`
- Các gợi ý `cross_page` chỉ được tiêu thụ ở lớp dịch trong các điều kiện được kiểm soát (các trang liền kề, thứ tự rõ ràng, ranh giới vùng bố cục an toàn, độ dài văn bản đủ); lớp schema chỉ định nghĩa và duy trì hợp đồng
- Các provider OCR mới có thể tạo ra thông tin nhóm liên tục ổn định nên ưu tiên ghi vào trường này thay vì để lộ các trường thô riêng tư ở hạ lưu

## Quy ước `type / sub_type`

`type / sub_type` chỉ mang cấu trúc ổn định; không ép buộc ngữ nghĩa cấp cao mà OCR không thể xác định ổn định.

Các loại chính hiện tại:

- `text`
- `formula`
- `image`
- `table`
- `code`
- `unknown`

Ví dụ về `sub_type` hiện đang sử dụng:

- `title`
- `body`
- `metadata`
- `header`
- `footer`
- `page_number`
- `footnote`
- `display_formula`
- `figure`
- `table_body`
- `code_block`

Quy tắc:

- Các cấu trúc có thể ánh xạ ổn định nên đi vào `type / sub_type` ưu tiên
- Ngữ nghĩa cấp cao không ổn định không nên mở rộng trực tiếp hệ thống loại chính
- Hỏi trước: "Đây là cấu trúc hay phán đoán ngữ nghĩa?"
- Hỏi trước: "Điều này có thể được tạo ra ổn định trên các provider với xác suất cao không?"

Ví dụ:

- Đoạn văn nội dung:
  - `type = "text"`
  - `sub_type = "body"`
- Tiêu đề:
  - `type = "text"`
  - `sub_type = "header"`
- Công thức hiển thị:
  - `type = "formula"`
  - `sub_type = "display_formula"`
- Khối mã:
  - `type = "code"`
  - `sub_type = "code_block"`
- OCR không thể phân chia nhỏ ổn định nhưng xác nhận văn bản:
  - `type = "text"`
  - `sub_type = "metadata"` hoặc `body`

Phản ví dụ:

- Không đặt `caption` trực tiếp vào `type`
- Không đặt `reference_entry` trực tiếp vào `sub_type`
- Không mở rộng một loại chính mới chỉ vì một provider có trường đặc biệt

Khi tích hợp các provider, sử dụng khung quyết định này:

- `text/header/footer/page_number/footnote` là các cấu trúc bố cục ổn định → đi vào `type / sub_type`
- `formula/display_formula`, `image/figure`, `table/table_body`, `code/code_block` là các cấu trúc block ổn định → đi vào `type / sub_type`
- `image_caption/table_caption/table_footnote/reference_entry/reference_heading` giống như "nhãn ngữ nghĩa" → đi vào `tags` ưu tiên
- Nếu các quy tắc cục bộ hoặc LLM tiếp theo đã đưa ra kết luận mạnh hơn về một block, ghi vào `derived.role`
- `author/date/affiliation/doi` thường không ổn định trong OCR và thay đổi nhiều giữa các provider; không mở rộng thành `sub_type` ổn định mới theo mặc định

## Phân tầng `tags / markers / derived`

Đây là quy ước thiết kế quan trọng nhất của schema hiện tại.

### `tags`

`tags` là các điểm đánh dấu nhẹ cấp block.

Phù hợp cho:

- `caption`
- `image_caption`
- `table_caption`
- `table_footnote`
- `image_footnote`
- `reference_heading`
- `reference_entry`
- `reference_zone`

Đặc điểm:

- Nhẹ
- Có thể cùng tồn tại
- Phù hợp cho tiêu thụ quy tắc nhanh

Ví dụ phù hợp cho `tags`:

- Một block vừa là `caption` và có thể được phân loại thêm là `image_caption`
- Một block đã ở trong vùng tham chiếu có thể mang thêm `reference_zone`

Ví dụ không phù hợp cho `tags`:

- Các cấu trúc ổn định như body / header / footer
- Các trường gỡ lỗi tạm thời của provider

### `markers`

`markers` là các điểm đánh dấu ổn định cấp tài liệu.

Hiện đang sử dụng:

- `reference_start`

Ví dụ:

```json
{
  "reference_start": {
    "page_index": 10,
    "block_id": "p011-b0021",
    "order": 21
  }
}
```

Ví dụ phù hợp cho `markers`:

- `reference_start` cấp tài liệu

Ví dụ không phù hợp cho `markers`:

- Ngữ nghĩa block đơn
- Thông tin gỡ lỗi chỉ có ý nghĩa tạm thời cho một trang

### `derived`

`derived` chứa các kết luận ngữ nghĩa phái sinh mạnh hơn.

Cấu trúc `derived` cấp block hiện tại:

- `role: str`
- `by: str`
- `confidence: float`

Ví dụ:

- `role = "caption"`
- `role = "reference_heading"`
- `role = "reference_entry"`

Ý nghĩa của `derived`:

- Cho phép các quy tắc của provider ghi
- Cho phép các quy tắc cục bộ ghi
- Sẽ cho phép LLM ghi trong tương lai

Nói cách khác, `derived` là điểm vào chính cho sự phát triển tiếp tục của lớp ngữ nghĩa.

Ví dụ phù hợp cho `derived`:

- `role = "caption"`
- `role = "reference_heading"`
- `role = "reference_entry"`
- `role = "algorithm"`, miễn là kết luận đến từ các quy tắc cục bộ hoặc phán đoán cấp cao hơn, không sao chép các trường thô của provider vào hợp đồng chính

Ví dụ không phù hợp cho `derived`:

- `raw_type` thô của provider
- Các cấu trúc có thể được đặt ổn định trực tiếp trong `type / sub_type`
- Các điểm đánh dấu tạm thời chỉ có ý nghĩa đối với một script cục bộ cụ thể

Hướng dẫn quyết định thực tế:

- Nếu logic hạ lưu muốn "lọc nhanh một loạt các block", ưu tiên `tags`
- Nếu logic hạ lưu muốn "xem block này như một đối tượng ngữ nghĩa cụ thể", ưu tiên `derived.role`
- Nếu đây là sự thật bố cục nền tảng, không đặt trong `tags/derived`; đặt trực tiếp trong `type / sub_type`

## Ranh giới `metadata` và `source`

### `metadata`

`metadata` chứa thông tin ánh xạ cục bộ, gỡ lỗi và theo dõi cấu trúc.

Ví dụ hiện đang sử dụng:

- `raw_index`
- `raw_angle`
- `raw_sub_type`
- `parent_block_id`

Đặc điểm:

- Nghiêng về triển khai cục bộ
- Nghiêng về gỡ lỗi/theo dõi
- Các lớp trên nên tránh ràng buộc quá nhiều logic nghiệp vụ

### `source`

`source` chứa thông tin nguồn gốc của provider.

Ví dụ hiện đang sử dụng:

- `provider`
- `raw_page_index`
- `raw_path`
- `raw_type`
- `raw_sub_type`
- `raw_bbox`
- `raw_text_excerpt`

Đặc điểm:

- Bảo tồn ánh xạ gốc
- Tạo điều kiện truy xuất nguồn gốc đầu ra của provider
- Không nên trở thành phụ thuộc dài hạn của logic chính dịch/render

## Cấu trúc dòng và segment

`lines[*]` các trường hiện tại:

- `bbox`
- `spans`

`lines[*].spans[*]` các trường hiện tại:

- `type`
- `raw_type`
- `text`
- `bbox`
- `score`

`segments[*]` các trường hiện tại:

- `type`
- `raw_type`
- `text`
- `bbox`
- `score`

Quy ước:

- `segments` là chuỗi phẳng trong block, thuận tiện cho dịch và bảo vệ công thức
- `lines` bảo tồn cấu trúc cấp dòng, thuận tiện cho bố cục và phân tích cục bộ
- Công thức nội tuyến không phải là loại chính của block; được giữ lại trong `segments/spans`

## Hợp đồng ổn định và các trường không ổn định

Các trường hiện được khuyến nghị là hợp đồng ổn định:

- Cấp cao nhất: `schema`, `schema_version`, `document_id`, `page_count`, `pages`, `markers`
- Trang: `page_index`, `width`, `height`, `unit`, `blocks`
- Block: `block_id`, `page_index`, `order`, `type`, `sub_type`, `bbox`, `text`, `lines`, `segments`, `tags`, `derived`, `continuation_hint`, `metadata`, `source`
- `derived.role/by/confidence`

Các phần hiện không được khuyến nghị để ràng buộc mạnh bên ngoài:

- Chi tiết nội bộ của `metadata`
- Tập hợp trường cụ thể của `source.raw_*`
- Một số `tags` đặc thù của provider

Nói cách khác:

- Nghiệp vụ lớp trên nên ưu tiên phụ thuộc vào `type / sub_type / tags / derived / markers`
- Không coi các trường thô của provider là hợp đồng chính nữa

## Nguyên tắc tiến hóa phiên bản

`v1` hiện có thể sử dụng nhưng không phải là phiên bản "cuối cùng vĩnh viễn".

Nguyên tắc tiến hóa trong tương lai:

- Các thay đổi nhỏ nên bổ sung trường; không thay đổi ngữ nghĩa một cách nhẹ nhàng
- Nếu cần phá vỡ các hợp đồng ổn định hiện có, nâng cấp lên `v2`
- Adapter provider hấp thụ các thay đổi thượng nguồn; không để rò rỉ các thay đổi trực tiếp vào luồng chính

### Kết luận hiện tại

Không khuyến nghị khởi tạo `document.v2` ở giai đoạn này.

Lý do:

- Luồng chính vừa hoàn thành hợp nhất `raw -> adapter -> defaults -> validator -> document.v1`; mục tiêu chính là ổn định `v1`
- Hầu hết các yêu cầu mới vẫn thuộc về mở rộng adapter, lắng đọng ngữ nghĩa `tags/derived/markers` và tăng cường phạm vi hồi quy; chưa đến mức cần phá vỡ hợp đồng
- Mở `v2` sớm sẽ kéo theo tích hợp provider, luồng chính dịch, luồng chính render và tương thích tác vụ lịch sử đồng thời; lợi ích ít hơn so với việc ổn định `v1` trước

### Điều kiện cần trước khi xem xét `v2`

Phải đáp ứng ít nhất một trong các điều kiện:

1. Các định nghĩa trường ổn định của `v1` phải được thay thế hoàn toàn.
   Ví dụ:
   - Hệ thống `type / sub_type` cần đại tu lớn
   - Tổ chức cơ bản của `lines / segments` cần thay đổi
   - Ranh giới trách nhiệm của `tags / derived / markers` cần được vẽ lại hoàn toàn

2. Nhu cầu chung dài hạn giữa các provider xuất hiện mà không thể diễn đạt tương thích bằng cách "thêm trường".
   Ví dụ:
   - Nhiều provider OCR tạo ra ổn định một loại cấu trúc mà `v1` không thể mang theo không mất mát
   - Ngữ nghĩa trường hiện có buộc hạ lưu phải liên tục viết các nhánh tương thích

3. Chi phí tương thích lịch sử bắt đầu vượt quá đáng kể chi phí nâng cấp.
   Ví dụ:
   - Lớp hoàn thiện giá trị mặc định ngày càng giống "viết lại bán phần"
   - Trình xác thực và luồng chính cần duy trì hai bộ giả định mâu thuẫn dài hạn

### Chiến lược mặc định cho đến lúc đó

- Mở rộng adapter ưu tiên; không mở rộng hợp đồng luồng chính
- Bổ sung ngữ nghĩa `tags / derived / markers` ưu tiên; không thay đổi `type / sub_type` một cách nhẹ nhàng
- Bổ sung schema đọc được bằng máy và mẫu hồi quy ưu tiên; không nâng cấp số phiên bản trước

## Nguyên tắc triển khai quan trọng nhất hiện tại

- Luồng chính tập trung vào `document.v1.json`
- Lớp adapter xử lý `raw -> normalized`
- Lớp nghiệp vụ ưu tiên tiêu thụ:
  - `type / sub_type`
  - `tags`
  - `derived`
  - `markers`

Không coi cấu trúc JSON thô của MinerU là hợp đồng chính cho dịch/render nữa.

## Quy tắc phối hợp

Lớp này là ranh giới giao thức quan trọng nhất giữa OCR và các module hạ lưu.

- `document.v1.json` là hợp đồng chính thức mà dịch / render có thể phụ thuộc trực tiếp
- `document.v1.report.json` dùng cho xác thực, khắc phục sự cố và tóm tắt tương thích; không phải là đầu vào chính của hạ lưu
- Khi thêm trường, ưu tiên bổ sung vào lớp cấu trúc cốt lõi hoặc lớp dấu vết chung; không để hạ lưu phụ thuộc vào dấu vết thô dài hạn
- Nếu sửa đổi cấu trúc `document.v1`, ngữ nghĩa trường hoặc tên tệp mặc định, phải đồng thời cập nhật adapter, README, fixture, xác thực schema và kiểm thử tương thích hạ lưu
- Chủ sở hữu dịch / render cần thêm ngữ nghĩa nên định nghĩa rõ ràng tại đây trước khi triển khai trong các module tương ứng; không được bỏ qua lớp này để đọc các trường riêng tư của provider

</content>