# Đặc tả API OCR Provider

Lớp này mô tả cụ thể "cách tích hợp các dịch vụ OCR bên ngoài"; không ghép nối với quy trình dịch/render hiện tại.

Mục tiêu rõ ràng:

- Coi các API OCR bên thứ ba như các provider có thể thay thế, không phải một phần của luồng chính
- Để MinerU, các API OCR trong tương lai, thậm chí OCR cục bộ tuân theo cùng một cách tiếp cận tích hợp
- Tách biệt hoàn toàn "gọi API provider" khỏi "tiêu thụ schema thống nhất"

## Ranh giới thiết kế

Lớp này xử lý:

- Định nghĩa ranh giới khả năng của OCR provider
- Định nghĩa trừu tượng tối thiểu cho tích hợp API provider
- Thống nhất cách lưu trữ các artifact thô của provider
- Thống nhất cách payload thô đi vào chuỗi adapter `document_schema`

Lớp này không xử lý:

- Dịch
- Render PDF
- Typst
- Chính sách block nội dung
- Tiêu thụ nghiệp vụ bất kỳ JSON đặc thù của provider

## Nguyên tắc cốt lõi

1. Quy trình chỉ nhận diện schema thống nhất, không nhận diện JSON thô của provider
   - Đầu vào OCR luồng chính luôn là `document.v1.json`
   - JSON thô của provider chỉ tồn tại ở lớp provider, lớp adapter, lớp gỡ lỗi

2. API Provider là "lớp thu thập", không phải "lớp nghiệp vụ"
   - Nhiệm vụ của nó là gửi file đi, nhận kết quả về, lưu trữ
   - Không nên quyết định chế độ dịch, chế độ render, font, bảo vệ công thức, chính sách block

3. Chuyển đổi từ thô sang chuẩn hóa phải đi qua adapter một cách tường minh
   - Bất kỳ kết quả trả về nào của provider đều phải đi vào `services/document_schema/adapters.py` trước
   - Không để `translation/ocr`, `rendering/` hiểu trực tiếp JSON của provider

4. Khả năng của provider có thể thay đổi; schema thống nhất là hợp đồng ổn định
   - Provider có thể thay đổi giao diện, trường dữ liệu, định dạng trả về
   - Luồng chính không nên bị dao động bởi những thay đổi này

## Trừu tượng hóa được khuyến nghị

Để thực sự có lớp API OCR độc lập sau này, khuyến nghị chia thành ít nhất các loại giao diện sau.

### 1. Khai báo khả năng của Provider

Mỗi provider khai báo ranh giới khả năng của chính mình trước, ví dụ:

- Có yêu cầu token hay không
- Có hỗ trợ phân tích URL hay không
- Có hỗ trợ tải lên file cục bộ hay không
- Có hỗ trợ batch hay không
- Có hỗ trợ callback hay không
- Có hỗ trợ bật/tắt bảng/công thức hay không
- Kích thước file tối đa
- Số trang tối đa
- Các loại đầu vào được hỗ trợ
- Loại đầu ra mặc định

Đây là metadata của provider; không nên phân tán vào các phán đoán trong workflow.

### 2. Giao diện tác vụ Provider

Thống nhất thành các loại hành động sau:

- `submit_url_task(...)`
- `submit_file_task(...)`
- `poll_task(...)`
- `download_result(...)`
- `unpack_result(...)`

Lưu ý vẫn chỉ là ngữ nghĩa API của provider, không phải ngữ nghĩa luồng chính.

Ví dụ:

- `submit_*` trả về id tác vụ / id batch của provider
- `poll_task` trả về trạng thái hiện tại của provider
- `download_result` trả về các artifact thô như zip / markdown / json / html, v.v.

### 3. Quy ước Artifact thô của Provider

Lớp provider chỉ sắp xếp các kết quả thô vào cấu trúc lưu trữ ổn định, ví dụ:

- `ocr/provider/<provider-name>/...`
- `ocr/unpacked/...`
- `ocr/provider_summary.json`

Không giả định tại lớp provider:

- Phải có `layout.json`
- Phải có `full.md`
- Phải là zip
- Phải có bảng và công thức

Những thứ này nên là các artifact đặc thù của provider, không phải điều kiện tiên quyết của luồng chính.

### 4. Điểm vào Adapter chuyển đổi từ thô sang Schema

Sau khi các artifact của lớp provider được lưu trữ, bước tiếp theo chỉ làm một việc duy nhất:

- Gọi adapter `document_schema`, tạo ra:
  - `document.v1.json`
  - `document.v1.report.json`

Trách nhiệm của provider kết thúc tại đây.

## Kết luận về MinerU như một Provider

Dựa trên tài liệu API MinerU hiện tại, một số điểm rõ ràng:

1. MinerU có hai loại API
   - Precision Parsing API: yêu cầu token, bất đồng bộ, hỗ trợ bảng/công thức, đầu ra đa định dạng, có thể batch
   - Agent Lightweight API: không cần đăng nhập, bất đồng bộ, giới hạn chặt chẽ hơn, chỉ Markdown

2. Không loại API nào nên ghép nối trực tiếp với luồng chính
   - Chúng chỉ là các hình dạng vận chuyển/kết quả khác nhau của provider
   - Không phải hợp đồng OCR của luồng chính

3. Chỉ có hai thứ từ MinerU thực sự phù hợp để đi vào luồng chính
   - Các tệp artifact thô
   - `document.v1` được tạo ra thông qua adapter

4. Nội dung không nên ghép nối vào workflow
   - Trạng thái tác vụ MinerU theo nghĩa đen
   - Chi tiết trường của MinerU `layout.json` / `content_list_v2.json`
   - Tên tệp bên trong zip của MinerU
   - Phương thức tải lên đặc thù của MinerU, ngữ nghĩa batch, chi tiết callback
   - Tên phiên bản model MinerU trực tiếp tham gia vào quyết định dịch/render

## Khuyến nghị vị trí dự án hiện tại

Mã hiện tại có thể hiểu như sau:

- `services/ocr_provider/provider_pipeline.py`
  Điểm vào ổn định cho luồng đầy đủ dựa trên provider; các script, kiểm thử, bản vá tương thích đều sử dụng cái này như ranh giới
- `services/ocr_provider/paddle_api.py`
  Vận chuyển / thăm dò / tải kết quả Paddle
- `services/ocr_provider/paddle_markdown.py`
  Lưu trữ artifact Markdown và hình ảnh của Paddle
- `services/ocr_provider/paddle_normalize.py`
  Triển khai thuần chỉnh sửa hình học tài liệu đã chuẩn hóa của Paddle, v.v.
- `services/mineru/`
  Triển khai đặc thù cho provider MinerU, không phải "điểm vào OCR chung"
- `services/document_schema/`
  Lớp hợp đồng thống nhất của OCR
- `runtime/pipeline/`
  Lớp điều phối nghiệp vụ

Nếu tích hợp các API OCR khác sau này, khuyến nghị phát triển thành:

- `services/ocr_provider/`
  Chỉ đặc tả tích hợp provider và các trừu tượng chung
- `services/mineru/`
  Như một triển khai cụ thể của `ocr_provider`
- `services/<other_ocr>/`
  Các triển khai cụ thể của provider khác
- `services/document_schema/`
  Tiếp tục là hợp đồng đã chuẩn hóa thống nhất

Nói cách khác:

- Các provider có thể thay thế
- Adapter có thể mở rộng
- Workflow không cần hiểu sự khác biệt giữa các provider

## Các bước tích hợp được khuyến nghị

Khi thêm provider OCR mới, thứ tự được khuyến nghị:

1. Viết mô tả khả năng của provider trước
2. Sau đó viết lớp gọi API provider
3. Lưu trữ ổn định các artifact thô của provider
4. Viết adapter `document_schema`
5. Thêm fixture và kiểm tra hồi quy
6. Chỉ sau đó mới cho phép đi vào luồng chính dịch/render

Nếu JSON thô của provider đi vào luồng chính trước bước 4, việc ghép nối chắc chắn sẽ tiếp tục.

## Kết luận kỹ thuật từ tài liệu MinerU

Từ tài liệu API MinerU hiện tại, các trừu tượng có giá trị nhất cần tiếp thu:

- Mô hình tác vụ bất đồng bộ
- Phân biệt gửi URL và tải lên file
- Phân biệt batch và file đơn
- Có máy trạng thái riêng của provider
- Artifact thô có nhiều hơn một loại
- Giới hạn và hạn chế về khả năng rất rõ ràng

Những điều này nên được đưa vào thiết kế lớp provider.

Những điều sau không nên đi vào luồng chính:

- Đường dẫn HTTP cụ thể
- Tên trường JSON cụ thể
- Tên tệp bên trong zip cụ thể
- Tên model chỉ dành riêng cho provider

## Khuyến nghị hiện tại

Ngắn hạn không tiếp tục mở rộng `services/mineru/` thành "lớp nền tảng OCR mặc định".

Cách tiếp cận ổn định hơn:

- Hạ cấp rõ ràng xuống thành "triển khai provider MinerU"
- Thêm `ocr_provider/README.md` này như một quy ước chung
- Khi có API OCR mới, hãy tuân theo quy ước này trước khi quyết định thư mục và adapter

Như vậy việc chuyển đổi provider OCR sau này sẽ không yêu cầu phân rã lại luồng chính dịch/render.

## Ràng buộc triển khai hiện tại

Để tránh tái cấu trúc lặp đi lặp lại, thư mục `ocr_provider/` hiện tại được duy trì theo các quy tắc sau:

- `provider_pipeline.py` xử lý điều phối giai đoạn/provider và bề mặt tương thích ổn định
- `drivers.py` xử lý registry provider Python; các provider mới đăng ký tại đây trước; không viết logic điều phối ngược lại vào luồng chính
- `types.py` định nghĩa hợp đồng đầu vào/đầu ra ổn định cho trình điều khiển provider; `OcrProviderResult.artifact_manifest` là ranh giới artifact của provider
- Phía Rust API, đường dẫn artifact của provider được khai báo bởi bố cục artifact trong `backend/rust_api/src/ocr_provider/catalog.rs`; điều phối tác vụ không nên viết tên tệp provider trong workspace
- Phía Rust API, vận chuyển provider được điều phối bởi registry vận chuyển trong `backend/rust_api/src/job_runner/ocr_flow/provider_transport.rs`; đăng ký trình xử lý vận chuyển trước khi thêm provider tích hợp sẵn
- Các triển khai thuần mới chìm vào các module độc lập ưu tiên; không xếp chồng ngược lại trực tiếp vào `provider_pipeline.py`
- Nếu kiểm thử cần monkeypatch, các điểm vá nên vẫn nằm trong `provider_pipeline.py`
- `services/ocr_provider/__init__.py` phải xuất rõ ràng `provider_pipeline`
- `paddle_api.py` không xử lý schema đã chuẩn hóa
- `paddle_markdown.py` chỉ xử lý các artifact Markdown/hình ảnh; không động đến dịch hoặc render
- `paddle_normalize.py` chỉ xử lý tài liệu đã chuẩn hóa và chỉnh sửa hình học; không động đến vận chuyển provider
- `local_command_driver.py` là điểm vào tích hợp tối thiểu cho các mô hình OCR cục bộ; không quan tâm đến triển khai mô hình; chỉ xác thực hợp đồng lưu trữ
- `services/document_schema/adapters.py` chỉ thực hiện đăng ký adapter; không import trực tiếp `services/mineru/*`; MinerU đi qua `services/document_schema/provider_adapters/mineru/`
- Model và bí danh mặc định của Paddle được cấu hình trong `backend/config/ocr_providers.json`; không hardcode số phiên bản trong Python/Rust

Các ràng buộc này đã được đưa vào:

- `backend/scripts/devtools/check_pipeline_architecture.py`

Nói cách khác, nếu ai đó kết nối lại `ocr_provider` với lớp dịch/render hoặc thay đổi điểm vào ổn định thành xuất ngầm/liên kết trực tiếp sâu, kiểm tra kiến trúc cục bộ sẽ thất bại ngay lập tức.

## Phương pháp tích hợp OCR cục bộ

Để tích hợp mô hình OCR cục bộ của riêng mình, ưu tiên sử dụng provider `local_command` dựa trên cấu hình; không sửa đổi mã dịch hoặc render.

Tài liệu tích hợp bên ngoài đầy đủ tại:

```text
doc/api/03-OCR/04-local-command-plugin.md
```

Thiết kế cốt lõi của lớp này: OCR cục bộ là một "API dòng lệnh". RetainPDF khởi động lệnh và truyền đường dẫn đầu vào/đầu ra qua biến môi trường; lệnh OCR cục bộ đọc PDF và ghi payload thô hoặc `document.v1.json`.

Thiết lập runtime:

```bash
export RETAIN_LOCAL_OCR_COMMAND="python /path/to/my_ocr.py"
```

Sau đó gửi tác vụ với OCR provider là `local`. Lệnh cục bộ nhận các biến môi trường sau:

```text
RETAIN_OCR_SOURCE_PDF
RETAIN_OCR_JOB_ROOT
RETAIN_OCR_SOURCE_DIR
RETAIN_OCR_DIR
RETAIN_OCR_PROVIDER_RESULT_JSON
RETAIN_OCR_NORMALIZED_DOCUMENT_JSON
RETAIN_OCR_NORMALIZATION_REPORT_JSON
RETAIN_OCR_PROVIDER_RAW_DIR
RETAIN_OCR_RAW_PAYLOAD_JSON
RETAIN_OCR_RAW_PROVIDER
```

Điều kiện thành công tối thiểu:

- Đọc `RETAIN_OCR_SOURCE_PDF`
- Ghi `RETAIN_OCR_NORMALIZED_DOCUMENT_JSON` với nội dung là `document.v1.json`
- Hoặc ghi `RETAIN_OCR_RAW_PAYLOAD_JSON` để RetainPDF tạo `document.v1.json` một cách thống nhất thông qua adapter `document_schema`
- Mã thoát `0` khi thành công; khác `0` khi thất bại

Tùy chọn:

- Ghi `RETAIN_OCR_PROVIDER_RESULT_JSON` để lưu kết quả thô của OCR cục bộ
- Ghi `RETAIN_OCR_NORMALIZATION_REPORT_JSON` để lưu báo cáo chẩn đoán của riêng mình

Nếu lệnh cục bộ ghi trực tiếp `document.v1.json`, trình điều khiển sẽ thêm báo cáo/kết quả tối thiểu và xác thực `document.v1.json`. Các bước dịch, render, API đọc tiếp theo đều chỉ tiêu thụ schema thống nhất.

Nếu OCR cục bộ chỉ có thể xuất JSON thô tùy chỉnh và không thể xuất trực tiếp `document.v1.json`, khuyến nghị chế độ artifact thô:

1. Lưu trữ ổn định JSON thô vào `RETAIN_OCR_RAW_PAYLOAD_JSON` trước
2. Thêm adapter trong `services/document_schema/provider_adapters/`
3. Adapter tạo ra `document.v1.json`
4. Chỉ định tên adapter thông qua `RETAIN_OCR_RAW_PROVIDER`
5. Để trở thành provider tích hợp sẵn, đăng ký trình điều khiển provider trong `services/ocr_provider/drivers.py`

Ví dụ payload thô tối thiểu có thể sử dụng adapter tích hợp sẵn `generic_flat_ocr` trước:

```bash
export RETAIN_LOCAL_OCR_COMMAND="python /path/to/my_ocr.py"
export RETAIN_OCR_RAW_PROVIDER=generic_flat_ocr
```

Lệnh bên ngoài chỉ cần ghi cấu trúc sau vào `RETAIN_OCR_RAW_PAYLOAD_JSON`:

```json
{
  "provider": "generic_flat_ocr",
  "pages": [
    {
      "page": 1,
      "width": 612,
      "height": 792,
      "unit": "pt",
      "blocks": [
        {
          "type": "text",
          "sub_type": "body",
          "bbox": [72, 72, 420, 120],
          "text": "Văn bản thô OCR",
          "lines": [],
          "segments": []
        }
      ]
    }
  ]
}
```

Nếu đã có dịch vụ OCR HTTP cục bộ, không để RetainPDF ghép nối trực tiếp với API riêng của dịch vụ đó. Khuyến nghị viết lệnh wrapper: đọc `RETAIN_OCR_SOURCE_PDF`, yêu cầu dịch vụ HTTP cục bộ, chuyển đổi kết quả trả về thành `generic_flat_ocr` hoặc `document.v1`, sau đó ghi vào đường dẫn đã thống nhất.

## Cấu hình Model Paddle

Phiên bản model Paddle không nên được hardcode ở lớp gọi. Model mặc định và bí danh được thống nhất từ:

```text
backend/config/ocr_providers.json
```

Mặc định hiện tại:

```text
PaddleOCR-VL-1.6
```

Có thể ghi đè thông qua biến môi trường:

```bash
export RETAIN_OCR_PROVIDER_CONFIG=/path/to/ocr_providers.json
export RETAIN_PADDLE_DEFAULT_MODEL=PaddleOCR-VL-1.6
```

Rust API cũng hỗ trợ:

```bash
export RUST_API_OCR_PROVIDER_CONFIG=/path/to/ocr_providers.json
export RUST_API_PADDLE_DEFAULT_MODEL=PaddleOCR-VL-1.6
```

## Tùy chọn Provider / Đặc tả Chứng thực / Khám phá Động

Hợp đồng hiển thị của OCR provider được thống nhất tại:

```text
backend/config/ocr_providers.json
```

Frontend và các bên tích hợp bên ngoài không nên hardcode "provider cần những trường nào"; thay vào đó hãy đọc:

```http
GET /api/v1/providers/ocr
```

Mỗi provider được trả về bao gồm:

- `key`: Tên provider được sử dụng khi gửi tác vụ
- `display_name`: Tên hiển thị
- `provider_kind`: `remote`, `local_command`, hoặc `remote_command`
- `credential`: Trường chứng thực và quy ước biến môi trường; có thể là `null` đối với các provider cục bộ
- `options`: Định nghĩa tham số của provider bao gồm `type/default/env/aliases/choices/required`
- `capabilities`: Có hỗ trợ URL, file cục bộ, thăm dò, gói, bật/tắt công thức/bảng hay không
- `artifact_layout`: Vị trí lưu trữ ổn định cho các artifact thô của provider

Cấu trúc phản hồi điển hình:

```json
{
  "key": "paddle",
  "display_name": "PaddleOCR",
  "provider_kind": "remote",
  "credential": {
    "field": "paddle_token",
    "env": "RETAIN_PADDLE_API_TOKEN",
    "required_for": ["remote_url", "local_upload"]
  },
  "options": {
    "paddle_model": {
      "type": "string",
      "default": "PaddleOCR-VL-1.6",
      "aliases": {
        "paddleocr-vl": "PaddleOCR-VL-1.6"
      }
    }
  }
}
```

Để thêm provider OCR cục bộ mới, không cần sửa đổi luồng chính dịch/render. Thêm vào cấu hình trước:

```json
{
  "providers": {
    "my_local_ocr": {
      "display_name": "OCR Cục bộ của tôi",
      "kind": "local_command",
      "credential": null,
      "options": {
        "command": {
          "type": "string",
          "default": "python /path/to/my_ocr.py"
        },
        "raw_provider": {
          "type": "string",
          "default": "generic_flat_ocr"
        }
      }
    }
  }
}
```

Để thêm provider OCR từ xa mới, cũng ưu tiên sử dụng `remote_command`; không viết máy trạng thái submit/poll/download của bên thứ ba vào luồng chính Rust trước. Ví dụ cấu hình:

```json
{
  "providers": {
    "my_remote_ocr": {
      "display_name": "OCR Từ xa của tôi",
      "kind": "remote_command",
      "credential": {
        "field": "credential",
        "env": "RETAIN_MY_REMOTE_OCR_TOKEN",
        "required_for": ["remote_url", "local_upload"]
      },
      "options": {
        "command": {
          "type": "string",
          "default": "python /path/to/my_remote_ocr.py"
        },
        "raw_provider": {
          "type": "string",
          "default": "generic_flat_ocr"
        }
      }
    }
  }
}
```

Registry provider Python tự động khám phá các provider có `kind=local_command|remote_command` và thực thi với cùng trình điều khiển lệnh. Thứ tự đọc `command/raw_provider`:

1. Tùy chọn provider trong stage spec hoặc tham số runtime
2. `RETAIN_LOCAL_OCR_COMMAND` / `RETAIN_OCR_RAW_PROVIDER`

Các provider lệnh nhận các biến môi trường ổn định sau:

```text
RETAIN_OCR_PROVIDER
RETAIN_OCR_PROVIDER_KIND
RETAIN_OCR_CREDENTIAL
RETAIN_OCR_SOURCE_PDF
RETAIN_OCR_SOURCE_URL
RETAIN_OCR_JOB_ROOT
RETAIN_OCR_SOURCE_DIR
RETAIN_OCR_DIR
RETAIN_OCR_PROVIDER_RESULT_JSON
RETAIN_OCR_NORMALIZED_DOCUMENT_JSON
RETAIN_OCR_NORMALIZATION_REPORT_JSON
RETAIN_OCR_PROVIDER_RAW_DIR
RETAIN_OCR_RAW_PAYLOAD_JSON
RETAIN_OCR_RAW_PROVIDER
```

Hợp đồng chính của `remote_command`:

- Lệnh plugin tự xử lý submit / poll / download / retry API của bên thứ ba.
- Nếu đầu vào từ `source.file_url`, plugin phải ghi PDF nguồn cuối cùng vào `RETAIN_OCR_SOURCE_DIR`.
- Plugin có thể ghi trực tiếp `RETAIN_OCR_NORMALIZED_DOCUMENT_JSON`.
- Plugin cũng có thể ghi `RETAIN_OCR_RAW_PAYLOAD_JSON` sau đó để adapter tương ứng của `raw_provider` chuyển đổi thành `document.v1.json`.
- Chứng thực được phân tích ưu tiên bởi backend từ `ocr.credential_ref` sau đó ghi vào `RETAIN_OCR_CREDENTIAL`; cũng có thể đọc được thông qua `credential.env` của cấu hình cho biến môi trường riêng của plugin.
- Luồng chính chỉ tiêu thụ `document.v1.json`; không hiểu máy trạng thái riêng của dịch vụ từ xa.

</content>