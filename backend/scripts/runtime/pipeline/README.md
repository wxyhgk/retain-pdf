# Hướng dẫn thư mục Pipeline

`scripts/runtime/pipeline/` chịu trách nhiệm kết nối sản phẩm chuẩn hóa OCR, quy trình dịch và quy trình kết xuất thành một bus ổn định.

Nơi đây không chứa phân tích OCR provider cụ thể, gọi mô hình dịch hay chi tiết kết xuất PDF cấp thấp, mà chịu trách nhiệm "làm thế nào để tổ chức các khả năng này theo đúng thứ tự".

## Hợp đồng giai đoạn

### 1. Giai đoạn OCR / Chuẩn hóa

Ranh giới trách nhiệm:

- Đầu vào: kết quả OCR raw của provider, PDF nguồn và metadata provider
- Đầu ra: tầng trung gian thống nhất `document.v1.json` và `document.v1.report.json`
- Đến đây là dừng, không tiếp tục đảm nhận dịch và kết xuất PDF cuối cùng

Điểm giao tiếp ổn định:

- Mainline dịch / kết xuất chỉ nên coi `document.v1.json` là đầu vào chính thức sau giai đoạn OCR
- Thư mục JSON raw, zip, unpacked của provider chỉ giữ cho adapter, gỡ lỗi và truy xuất

### 2. Giai đoạn Dịch

Ranh giới trách nhiệm:

- Đầu vào: `document.v1.json`, tham số chiến lược dịch và thư mục đầu ra dịch
- Đầu ra: payload dịch từng trang, `translation-manifest.json`, tóm tắt dịch và thông tin chẩn đoán
- Đến đây là dừng, không chịu trách nhiệm phân tích raw provider, không ghi lại PDF nguồn và bàn giao PDF cuối cùng

Điểm giao tiếp ổn định:

- Giai đoạn kết xuất chỉ nên tiêu thụ giao thức sản phẩm dịch, không được đọc ngược cấu trúc OCR raw của provider
- Giao thức sản phẩm dịch mặc định hiện tại bao gồm payload dịch từng trang và `translation-manifest.json`
- Mainline render-only hiện yêu cầu manifest-only; không còn quay lại quét các tệp JSON từng trang cũ
- Giai đoạn dịch được phép đọc PDF nguồn để suy luận lĩnh vực hoặc hỗ trợ chiến lược, nhưng không sở hữu quyền kiểm soát kết xuất PDF nguồn
- Nếu bảng thuật ngữ được bật, giai đoạn dịch còn ghi tóm tắt bảng thuật ngữ vào `translation-manifest.json`, tệp chẩn đoán và pipeline summary; các trường này là metadata, không thay đổi giao thức đầu vào kết xuất
- Pipeline summary và translation manifest hiện còn ghi trường `invocation` để khai báo phiên bản schema giai đoạn hiện tại
- Worker các giai đoạn hiện còn ghi thêm sự kiện giai đoạn thống nhất vào `logs/pipeline_events.jsonl`; tệp này là điểm trung gian để Rust API thu gọn giao thức sự kiện sau này

### 3. Giai đoạn Kết xuất

Ranh giới trách nhiệm:

- Đầu vào: PDF nguồn, sản phẩm dịch và tham số kết xuất
- Đầu ra: PDF cuối cùng, cùng với các sản phẩm trung gian overlay / typst / nén cần thiết
- Đến đây là dừng, không chịu trách nhiệm nhận diện OCR provider, không khởi tạo yêu cầu mô hình dịch

Điểm giao tiếp ổn định:

- Mainline kết xuất chỉ chấp nhận bộ đầu vào "PDF nguồn + sản phẩm dịch"
- Vấn đề cấu trúc OCR nên quay lại kiểm tra `document.v1.json` / `document.v1.report.json`, thay vì bổ sung xử lý đặc biệt cho provider ở tầng kết xuất

## Phân công module

- `book_pipeline.py`
  Điểm vào điều phối thống nhất. Giữ bề mặt gọi ổn định nhất bên ngoài, chịu trách nhiệm kết nối giai đoạn dịch và kết xuất, trả về kết quả tổng hợp của toàn bộ quy trình.
- `translation_stage.py`
  Chỉ chịu trách nhiệm giai đoạn dịch. Đầu vào `document.v1.json` và thư mục đầu ra, thực hiện cắt phạm vi trang, lắp ráp chiến lược chế độ học thuật và dịch toàn bộ sách, xuất payload dịch từng trang.
- `render_stage.py`
  Chỉ chịu trách nhiệm giai đoạn kết xuất. Đầu vào PDF nguồn và sản phẩm dịch, theo các chế độ `overlay`, `typst`, `dual`... tạo PDF cuối cùng.
- `services/pipeline_shared/`
  Không thuộc `runtime/pipeline/`, nhưng nó chứa hợp đồng stdout, summary, luồng sự kiện `pipeline_events.jsonl` dùng chung và JSON IO xuyên giai đoạn; pipeline nên phụ thuộc vào tầng này, thay vì quay lại phụ thuộc vào helper chia sẻ của một module provider nào đó.
- `render_inputs.py`
  Chỉ chịu trách nhiệm kiểm tra giao thức gọi Render-only, chuẩn hóa `source_pdf_path + translations_dir/translation_manifest_path` thành đầu vào ổn định mà giai đoạn kết xuất có thể tiêu thụ.
- `render_mode.py`
  Chỉ chịu trách nhiệm xác định phạm vi trang và chế độ `auto`, bao gồm việc có nên đi đường dẫn PDF có thể chỉnh sửa hay không.
- `translation_loader.py`
  Chỉ chịu trách nhiệm đọc và lọc các tệp kết quả dịch, tổ chức JSON dịch từng trang thành cấu trúc dữ liệu mà giai đoạn kết xuất có thể tiêu thụ.
- `translation_stage.py`
  Chịu trách nhiệm facade pipeline giai đoạn dịch toàn bộ sách, bên trong thực thi continuation, áp dụng chiến lược, dịch batch, điền kết quả và ghi qua `services.translation.workflow`.

## Cách hợp tác

Quy trình chuẩn:

`OCR JSON -> translation_stage -> translation JSON -> translation_loader/render_stage -> PDF cuối cùng`

`OCR JSON` ở đây mặc định là `document.v1.json`.

Quy trình provider-backed đầy đủ của Rust API cũng được kết nối theo ranh giới này:

- Tác vụ con OCR trước tiên tạo `document.v1.json`
- Điểm vào translate-only chỉ tạo payload dịch từng trang và `translation-manifest.json`
- Điểm vào render-only sau đó tiêu thụ PDF nguồn và sản phẩm dịch để tạo PDF cuối cùng

Quy ước bổ sung:

- Nếu đầu vào là JSON raw provider, nên chuẩn hóa rõ ràng bên ngoài pipeline hoặc tại điểm vào dịch
- Pipeline không chịu trách nhiệm hiểu cấu trúc raw riêng của provider
- Nếu chỉ cần xem phát hiện provider, bổ sung mặc định hoặc tóm tắt kiểm tra schema, ưu tiên đọc `document.v1.report.json`
- Tác vụ đầy đủ có thể kết nối ba giai đoạn, nhưng ranh giới đầu vào/đầu ra của ba giai đoạn phải độc lập, không thể phụ thuộc ngầm qua đối tượng bộ nhớ riêng
- Nếu chỉ chạy lại kết xuất, nên tái sử dụng `source_pdf` và `translations_dir` của job hiện có, không vào lại giai đoạn OCR hoặc dịch

## Điểm vào ổn định bên ngoài

Hiện tại khuyến nghị sử dụng các điểm vào sau:

- `run_book_pipeline(...)`
- `translate_book_pipeline(...)`
- `build_book_pipeline(...)`
- `build_book_from_translations(...)`
- `run_render_stage(...)`
- `resolve_page_range(...)`
- `is_editable_pdf(...)`

Quy ước bổ sung:

- Điểm vào giai đoạn đã được cố định là giao thức `--spec <stage-spec.json>`
- Giai đoạn normalize tương ứng `normalize.stage.v1`
- Giai đoạn translate-only tương ứng `translate.stage.v1`
- Giai đoạn render-only tương ứng `render.stage.v1`
- Toàn bộ quy trình provider-backed hiện tại tương ứng `provider.stage.v1`
  Đây là chi tiết triển khai hiện tại, không phải yêu cầu đặt tên quy trình cấp cao
- Điểm vào toàn bộ quy trình dựa trên OCR đã chuẩn hóa tương ứng `book.stage.v1`
- Điểm vào worker mà Rust workflow chính gọi hiện yêu cầu `--spec`
- Các điểm vào phát triển local cũng đã thống nhất chuyển sang dùng stage spec

## Gợi ý gọi

- CLI, API, tầng tích hợp ưu tiên chỉ phụ thuộc vào `book_pipeline.py`
- Chỉ vào `runtime/pipeline/` sau khi giai đoạn OCR hoàn tất; không đưa logic xử lý raw provider trở lại đây
- Chỉ dịch thì gọi `translate_book_pipeline(...)`
- Chỉ kết xuất thì gọi `build_book_pipeline(...)` hoặc `run_render_stage(...)`
  Khi gọi phải cung cấp `source_pdf_path` và một trong hai đầu vào dịch sau:
  - `translations_dir`
  - `translation_manifest_path`
- Nếu cả hai đều không có, hoặc thư mục không chứa `translation-manifest.json`, điểm vào sẽ ném lỗi `Render-only input error` cố định
- Giai đoạn kết xuất không còn tự "đoán" thư mục tác vụ cũ hoặc tên tệp trang cũ
- Không khuyến nghị tầng trên tự ghép phạm vi trang, xác định chế độ và đọc thư mục dịch

## Hồi quy tách biệt

Phạm vi hồi quy chuyên biệt hiện tại:

- Python: tải sản phẩm dịch chỉ manifest, giao thức đầu vào Render-only
- Rust: snapshot job chỉ OCR, workflow Dịch, workflow Kết xuất, điểm vào tác vụ đầy đủ, phát hiện artifact manifest

Các lệnh kiểm tra thường dùng:

```bash
PYTHONPATH=backend/scripts python -m pytest backend/scripts/devtools/tests -q
cd backend/rust_api && cargo test -q
```

## Quy tắc hợp tác

`runtime/pipeline/` phù hợp để "người phụ trách điều phối" duy trì riêng, nhưng trách nhiệm phải được thu gọn vào bản thân tổ chức giai đoạn.

- Nơi đây chỉ chịu trách nhiệm thứ tự giai đoạn, giao thức điểm vào, thư mục tác vụ và tổng hợp kết quả xuyên giai đoạn
- Không đưa logic adapter riêng của provider vào pipeline
- Không đưa chi tiết chiến lược dịch hoặc chi tiết triển khai kết xuất quay lại pipeline
- Nếu sửa đổi hợp đồng đầu vào/đầu ra giai đoạn, phải đồng bộ cập nhật README module thượng nguồn, README module hạ nguồn, điểm vào CLI/API và kiểm thử hồi quy
- Nếu chỉ là lỗi nội bộ của một module, ưu tiên sửa trong module đó; pipeline chỉ giữ lớp điều phối cần thiết