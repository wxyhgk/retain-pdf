# 06 Ánh xạ và ranh giới từ Paddle Markdown sang Job Artifact

Tài liệu này chỉ trả lời một câu hỏi:

- Đầu ra của Paddle provider, `normalized_document`, xuất artifact job, và giao diện tải xuống — bốn tầng này có ranh giới gì.

Kết luận cốt lõi được viết trước:

1. `provider raw` là đầu ra riêng của provider OCR, chỉ dùng để truy vết, chẩn đoán, đầu vào adapter, không phải hợp đồng chính cho hạ lưu.
2. `normalized_document` là vật giao nhận chính thức của giai đoạn OCR cho bản dịch/kết xuất, luồng chính nên phụ thuộc ổn định vào nó.
3. `job artifact` là tầng đăng ký và xuất sản phẩm công việc, chịu trách nhiệm phơi bày các tệp dưới dạng khóa artifact thống nhất, không định nghĩa lại ngữ nghĩa provider.
4. Giao diện tải xuống là tầng phơi bày HTTP, chỉ cam kết “tải xuống theo artifact hoặc theo tài nguyên ổn định”, không cam kết hạ lưu hiểu cấu trúc provider raw.

## Một sơ đồ xem ranh giới

```text
Paddle API JSONL / result.json
  -> ranh giới provider raw
  -> bộ chuyển đổi document_schema
  -> ocr/normalized/document.v1.json
  -> ranh giới normalized_document
  -> bản dịch / kết xuất
  -> kho đăng ký artifact job / gói ảo
  -> ranh giới xuất artifact
  -> /api/v1/jobs/* các tuyến tải xuống
  -> ranh giới giao diện tải xuống
```

## 1. Ranh giới Provider Raw

Tệp kết quả thô hiện tại của Paddle provider trong luồng hỗ trợ provider là:

- `ocr/result.json`

Mã nguồn:

- `backend/scripts/services/ocr_provider/provider_pipeline.py`
  `run_paddle_to_job_dir()` sẽ lưu kết quả tổng hợp của `download_jsonl_result()` vào `job_dirs.ocr_dir / "result.json"`
- `backend/scripts/services/ocr_provider/paddle_api.py`
  `download_jsonl_result()` tổng hợp JSONL thành:
  - `layoutParsingResults`
  - `dataInfo`
  - `_meta`

Trách nhiệm của tầng này chỉ có:

- Giữ lại cấu trúc thô của Paddle
- Cung cấp đầu vào cho bộ chuyển đổi `document_schema`
- Cung cấp cơ sở cho việc gỡ lỗi và đối chiếu provider

Trách nhiệm không nên có của tầng này:

- Không nên trực tiếp làm đầu vào cho bản dịch
- Không nên trực tiếp làm đầu vào cho kết xuất
- Không nên yêu cầu Rust API hoặc frontend hiểu chi tiết trường của `layoutParsingResults`
- Không nên được giao diện tải xuống bọc thành “ngữ nghĩa tài liệu thống nhất”

Nghĩa là:

- `result.json` là ảnh chụp nhanh provider raw
- Nó có thể thay đổi
- Miễn là adapter vẫn có thể ánh xạ ổn định sang `document.v1`, hạ lưu không nên bị buộc thay đổi theo

## 2. Ranh giới Normalized Document

Đầu ra chính thức sau khi Paddle raw đi vào hợp đồng thống nhất là:

- `ocr/normalized/document.v1.json`
- `ocr/normalized/document.v1.report.json`

Mã nguồn:

- `backend/scripts/services/ocr_provider/provider_pipeline.py`
  `_save_normalized_document_for_paddle()`
- `backend/scripts/services/document_schema/README.md`

Tầng này là điểm giao nhận ổn định của luồng chính từ OCR đến bản dịch/kết xuất.

Trách nhiệm:

- Cô lập các trường riêng của Paddle bên trong adapter
- Xuất `normalized_document_v1` thống nhất
- Để translation/rendering chỉ làm việc với cấu trúc ổn định

Luồng chính nên phụ thuộc:

- `document.v1.json`

Luồng chính không nên phụ thuộc:

- `result.json`
- `layoutParsingResults[*].prunedResult.*`
- `markdown.images` của Paddle
- `group_id/global_group_id` của Paddle

Vị trí của `document.v1.report.json` cũng cần được làm rõ:

- Nó là báo cáo chuẩn hóa và tóm tắt kiểm tra
- Dùng để gỡ lỗi, phân tích giá trị mặc định, kiểm tra tương thích
- Không phải đầu vào chính cho bản dịch hay kết xuất

## 3. Paddle Markdown nằm ở ranh giới nào

Markdown trong tầng tải xuống hiện tại không phải là trường hợp đồng chính thức của API raw Paddle, mà là một sản phẩm có thể xuất trong thư mục job.

Vị trí Rust phân tích Markdown:

- `backend/rust_api/src/storage_paths.rs`
  - `resolve_markdown_path()`
  - `resolve_markdown_images_dir()`

Thứ tự phân tích hiện tại:

1. Ưu tiên đọc `job_root/md/full.md`
2. Ưu tiên đọc `job_root/md/images/`
3. Chỉ khi tương thích với bố cục cũ, mới fallback đến `provider_raw_dir/full.md` và `provider_raw_dir/images/`

Điều này có nghĩa:

- `md/full.md` và `md/images/` thuộc cấu trúc đầu ra của job
- Chúng là “sản phẩm Markdown có thể tải xuống”
- Chúng không phải là hợp đồng provider raw của Paddle

Vì vậy đừng nhầm lẫn:

- `markdown.text` / `markdown.images` trong Paddle raw
- `md/full.md` / `md/images/` trong job

Cái trước thuộc dấu vết provider raw.
Cái sau thuộc khẩu ngữ artifact/export của job.

Luồng chính hiện đã đóng theo ranh giới này:

- Paddle provider pipeline sẽ thực hiện rõ ràng một lần materialize markdown
- Phát hành `layoutParsingResults[*].markdown.text/images` vào `job_root/md/full.md` và `job_root/md/images/`
- Tầng tải xuống Rust chỉ đọc bộ artifact đã phát hành này, không suy ngược từ `provider_raw_dir`

Có một ràng buộc triển khai rất quan trọng:

- Đường dẫn tương đối của hình ảnh trong Markdown, không thể tự chúng ta ngồi nghĩ ra mẫu cố định
- Phải dựa vào khóa `markdown.images` của Paddle
- Chúng ta hiện chỉ cho phép một lớp bao bọc phát hành ổn định: phát hành hình ảnh vào `md/images/` và thêm tiền tố phạm vi `page-N/` cho mỗi trang, tránh các hình ảnh cùng tên trong PDF nhiều trang ghi đè lên nhau

Nghĩa là, nếu Markdown thô của Paddle viết:

```html
<img src="imgs/img_in_image_box_320_138_932_438.jpg" ... />
```

Thì Markdown đã phát hành nên trở thành:

```html
<img src="images/page-6/imgs/img_in_image_box_320_138_932_438.jpg" ... />
```

Trong đó:

- `imgs/img_in_image_box_320_138_932_438.jpg` là đường dẫn tương đối từ provider trả về
- `page-6/` là phạm vi trang chúng ta thêm để phát hành đa trang
- `images/` tương ứng với thư mục artifact job `md/images/`

Không thể đơn giản hóa sai thành:

- Cố định `imgs/...`
- Cố định `assets/...`
- Cố định một mẫu đặt tên hình ảnh nào đó
- Cố định một cú pháp Markdown hình ảnh nào đó

Vì văn bản Paddle trả về có thể là Markdown `![](...)` hoặc HTML `<img src=\"...\">`, và các đoạn đường dẫn tương đối cũng phải hoàn toàn theo giá trị trả về của provider.

## 4. Ranh giới xuất Job Artifact

Trách nhiệm của artifact job là ánh xạ thống nhất các tệp và sản phẩm ảo trong thư mục job thành khóa artifact.

Mã chính:

- `backend/rust_api/src/storage_paths.rs`
- `backend/rust_api/src/services/artifacts.rs`

Điểm quan trọng nhất ở đây không phải là “tệp đặt ở đâu”, mà là “phơi bày ra bên ngoài dưới dạng khóa artifact nào”.

### Các khóa artifact liên quan trực tiếp đến Paddle/Normalize/Markdown

| artifact key | Ý nghĩa | Ranh giới thuộc về |
| --- | --- | --- |
| `provider_result_json` | Ảnh chụp nhanh kết quả thô provider | provider raw |
| `provider_raw_dir` | Thư mục thô provider | provider raw |
| `layout_json` | Điểm vào kết quả bố cục lịch sử/tương thích | provider raw hoặc tầng tương thích |
| `normalized_document_json` | Hợp đồng tài liệu thống nhất | normalized_document |
| `normalization_report_json` | Báo cáo chuẩn hóa | phụ trợ của normalized_document |
| `markdown_raw` | Tệp Markdown xuất từ job | artifact export |
| `markdown_images_dir` | Thư mục hình ảnh Markdown xuất từ job | artifact export |
| `markdown_bundle_zip` | Gói Markdown được đóng gói động bởi API | artifact export |

### Quy tắc ranh giới ở đây

`services/artifacts.rs` chỉ chịu trách nhiệm:

- Tìm artifact từ registry hoặc fallback
- Tạo đường dẫn tài nguyên ổn định cho artifact
- Xây dựng gói zip theo nhu cầu

Nó không chịu trách nhiệm:

- Giải thích JSON raw Paddle
- Định nghĩa ngữ nghĩa `document.v1`
- Quyết định một khối nào đó có phải là nội dung chính không

Nghĩa là, tầng artifact xử lý:

- Tệp có tồn tại không
- Tệp thuộc nhóm nào
- Sử dụng khóa artifact nào để phơi bày
- Có cho phép tải xuống trực tiếp không

Tầng artifact không nên ngược lại trở thành tầng ngữ nghĩa provider.

## 5. Ranh giới giao diện tải xuống

Giao diện tải xuống là tầng HTTP ngoài cùng, không nên rò rỉ cấu trúc đường dẫn nội bộ thành hợp đồng nghiệp vụ mới.

Mã chính:

- `backend/rust_api/src/services/jobs/facade/query/downloads.rs`
- `backend/rust_api/src/services/artifacts.rs`

### Giao diện tài nguyên ổn định

Các giao diện này phơi bày “loại tài nguyên ổn định”, không phải trường riêng của provider:

| Giao diện | Tài nguyên tương ứng | Mô tả |
| --- | --- | --- |
| `/api/v1/jobs/{job_id}/normalized-document` | `normalized_document_json` | Vật giao nhận chính thức từ OCR đến hạ lưu |
| `/api/v1/jobs/{job_id}/normalization-report` | `normalization_report_json` | Kiểm tra/tóm tắt chuẩn hóa |
| `/api/v1/jobs/{job_id}/markdown` | Chế độ xem đọc của `markdown_raw` | Có thể trả về JSON bọc hoặc markdown thô |
| `/api/v1/jobs/{job_id}/markdown/document` | Chế độ xem đọc có cấu trúc của `markdown_raw` + `markdown_images_dir` | Trả về nội dung Markdown, Markdown với liên kết hình ảnh tuyệt đối, danh sách liên kết hình ảnh trực tiếp |
| `/api/v1/jobs/{job_id}/markdown/images/{path}` | Tệp trong `markdown_images_dir` | Liên kết hình ảnh trực tiếp |
| `/api/v1/jobs/{job_id}/artifacts/{artifact_key}` | Mục trong artifact registry | Tải artifact chung |

### Giao diện Bundle

`bundle_response()` sẽ đóng gói zip động dựa trên sản phẩm hiện tại của job.

Nội dung bundle hiện tại đến từ:

- `translated_pdf`
- `markdown/full.md`
- `markdown/images/*`

Điều này cho thấy bundle là “tổ hợp tầng xuất”, không phải schema mới.

## 6. Tại sao bốn tầng này phải tách rời

Nếu bốn tầng không tách ra, sau này sẽ liên tục tái cấu trúc.

Các cách ghép nối sai điển hình:

1. Để chuỗi dịch đọc trực tiếp `layoutParsingResults` raw của Paddle
2. Để logic xuất artifact hiểu `block_label/group_id`
3. Để giao diện tải xuống trực tiếp cam kết cấu trúc trường thô của provider
4. Coi `markdown.text` là hợp đồng thống nhất cho hạ lưu, thay vì coi `document.v1` là đầu vào chính

Cách đúng là:

1. provider raw chịu trách nhiệm “giữ đúng bản gốc”
2. normalized document chịu trách nhiệm “thống nhất”
3. artifact export chịu trách nhiệm “đăng ký và xuất”
4. download API chịu trách nhiệm “phơi bày theo tài nguyên ổn định”

Như vậy mỗi tầng thay đổi chỉ ảnh hưởng đến tầng đó:

- Paddle API thay đổi: ưu tiên sửa provider adapter
- `document.v1` được nâng cấp: sửa normalize và người tiêu dùng hạ lưu
- Cách tải xuống thay đổi: sửa artifact/export và route/facade

Thay vì cả chuỗi cùng thay đổi.

## 7. Quy tắc xác định trong quá trình phát triển thực tế

Khi gặp một trường hoặc tệp, trước tiên hỏi nó thuộc tầng nào:

### Thuộc provider raw

Ví dụ điển hình:

- `result.json`
- `layoutParsingResults`
- `dataInfo`
- `markdown.images`
- `group_id`

Quy tắc xử lý:

- Có thể giữ lại
- Có thể gỡ lỗi
- Không thể làm hợp đồng chính thức cho luồng chính

Bổ sung quy tắc cho đường dẫn hình ảnh Markdown:

- Khóa `markdown.images` là một phần ngữ nghĩa của provider raw
- Tầng artifact đã phát hành không thể đổi tên cấu trúc đường dẫn tương đối bên trong nó
- Được phép làm là “đóng gói thư mục hình ảnh markdown job + cô lập phạm vi trang”, ví dụ tiền tố `images/page-6/`
- Không được phép đổi tên cấu trúc bên trong `imgs/...` do provider trả về thành tên tùy chỉnh của kho

### Thuộc normalized_document

Ví dụ điển hình:

- `document.v1.json`
- `document.v1.report.json`

Quy tắc xử lý:

- Đây là tầng giao nhận ổn định từ OCR đến translation/rendering
- Nâng cấp ngữ nghĩa ưu tiên thực hiện ở phía adapter/schema

### Thuộc artifact export

Ví dụ điển hình:

- `markdown_raw`
- `markdown_images_dir`
- `markdown_bundle_zip`
- `provider_result_json`
- `normalized_document_json`

Quy tắc xử lý:

- Quan tâm đến khóa artifact, trạng thái ready, đường dẫn tương đối, nhóm, loại nội dung
- Không phát minh ngữ nghĩa provider mới ở đây

### Thuộc download API

Ví dụ điển hình:

- `/normalized-document`
- `/normalization-report`
- `/markdown`
- `/artifacts/{artifact_key}`

Quy tắc xử lý:

- Quan tâm đến hình thức phơi bày tài nguyên, xác thực, tiêu đề phản hồi, streaming
- Không giải thích ý nghĩa nghiệp vụ của Paddle raw ở đây

## 8. Khẩu ngữ chính của tài liệu

Khi thảo luận về phần này, hãy thống nhất sử dụng các thuật ngữ sau:

- `provider raw`: Đầu ra và thư mục thô của Paddle
- `normalized_document`: Hợp đồng tài liệu thống nhất, đầu vào chính thức cho dịch/kết xuất
- `artifact export`: Đăng ký, đóng gói và xuất sản phẩm công việc
- `download API`: Phơi bày tài nguyên HTTP ra bên ngoài

Đừng tiếp tục sử dụng các cách nói lẫn lộn sau:

- “Markdown chính là đầu ra của Paddle”
- “artifact chính là schema”
- “Giao diện tải xuống bằng với provider contract”
- “Chỉ cần có thể tải xuống thì có thể làm đầu vào luồng chính”

Những cách nói này sẽ ghép nối lại các tầng.
