# Hướng dẫn tích hợp frontend: API tầng dữ liệu thư viện

> Commit backend: `9b22e26` (Tầng dữ liệu thư viện: documents là công dân hạng nhất + lưu trữ neo + tìm kiếm toàn văn FTS5)
>
> Giao diện `/api/v1/library/books` hiện có được **giữ nguyên**, trang thư viện có thể di chuyển theo nhịp độ, không di chuyển cũng không hỏng.
> Tất cả các giao diện mới và hiện có đều sử dụng xác thực `X-API-Key`, phản hồi thống nhất với gói `{code, message, data}`.

## Khái niệm cốt lõi (thay đổi mô hình duy nhất frontend cần hiểu)

- **document = định danh ổn định của một PDF** (khử trùng theo sha256 nội dung): cùng một PDF dù tải lên bao nhiêu lần, dịch bao nhiêu lần, đều có cùng `document_id`. job trở thành "bản ghi xử lý" dưới tên tài liệu.
- **Neo**: lưu trữ và kết quả tìm kiếm đều mang bộ bốn `(document_id, job_id, page_idx, block_id)`, `job_id + page + block` chính là tọa độ định vị hiện có của trình đọc, có thể nhảy trực tiếp đến vị trí gốc.

## Danh sách giao diện

### 1. Danh sách / Chi tiết / Sửa tài liệu

```
GET  /api/v1/documents?limit=50&offset=0&reading_status=reading&tag=hóa học&collection_id=xxx
GET  /api/v1/documents?job_id=xxx          ← Bất kỳ job_id nào (bao gồm lịch sử run) đều truy vấn trực tiếp tài liệu thuộc về, không cần quét danh sách để lấy active_job_id
     → data.documents[]: { document_id, title, source_filename, page_count, bytes,
                            active_job_id, reading_status, tags[], added_at,
                            last_opened_at, updated_at, authors_json, year, doi }

GET  /api/v1/documents/:document_id

PATCH /api/v1/documents/:document_id
     body: { title?, reading_status?, tags? }
```

- `reading_status` chỉ nhận `unread | reading | done`, các giá trị khác trả về 400;
- `tags` có ngữ nghĩa **thay thế toàn bộ** (truyền `[]` là xóa);
- `active_job_id` là run xử lý hiện tại của tài liệu — **dùng nó để mở trình đọc**;
- Danh sách sắp xếp theo `added_at` giảm dần, `limit` tối đa 500.

### 2. Lưu trữ

```
POST /api/v1/favorites
     body: {
       page_idx, block_id, quote_text,                      ← Bắt buộc
       document_id?, job_id?,                               ← Cần ít nhất một trong hai
       char_start?, char_end?, kind?,
       translated_quote_text?, note?
     }
     → data: FavoriteRecord (bao gồm favorite_id được tạo, document_id đã phân giải và job_id thực tế được neo)

GET  /api/v1/favorites?document_id=xxx
     → data.favorites[] (sắp xếp theo số trang; không truyền tham số = tất cả lưu trữ, sắp xếp theo thời gian giảm dần)

PATCH /api/v1/favorites/:favorite_id
     body: { note }                          ← Cập nhật nguyên tử ghi chú, favorite_id không đổi
DELETE /api/v1/favorites/:favorite_id
```

- **Chỉ truyền `job_id` (bao gồm lịch sử run) thì backend tự động phân giải tài liệu thuộc về và neo vào không gian block của run đó** — khi lưu trữ trong trình đọc chỉ cần truyền job_id hiện tại, mở job lịch sử cũng lưu đúng;
- Chỉ truyền `document_id` thì neo vào `active_job_id` của nó;
- `quote_text` là ảnh chụp nhanh trích dẫn, bắt buộc (văn bản gốc được chọn); `translated_quote_text` khuyến nghị truyền cùng — khi neo bị mất, ảnh chụp đảm bảo nội dung không mất;
- `kind`: `sentence | data | figure`, mặc định `sentence`;
- `char_start / char_end` là vùng chọn trong block (tùy chọn, không truyền nghĩa là cả block).

### 3. Tìm kiếm toàn văn (cả Trung và Anh)

```
GET /api/v1/search?q=quang phổ&limit=20
    → data.hits[]: { document_id, job_id, page_idx, block_id,
                     source_snippet, translated_snippet }
```

- Từ khóa trong snippet được bao bởi `[` `]`, frontend có thể thay thế bằng thẻ đánh dấu;
- `q` có độ dài bất kỳ đều có thể tìm (≥3 ký tự dùng chỉ mục FTS5, ngắn hơn tự động chuyển về khớp mờ);
- `limit` tối đa 100.

### 4. Hỏi đáp AI (truy xuất agentic, kèm trích dẫn có thể nhảy)

> Frontend chỉ truy cập một điểm vào Rust API: `/api/v1/ai/ask` là proxy ngược đến dịch vụ retainpdf-ai, xác thực vẫn là cùng X-API-Key, không cần cấu hình mới.

```
POST /api/v1/ai/ask
     body: { question: string, document_id?: string, job_id?: string, stream?: boolean,
             conversation_id?: string,             ← Hội thoại nhiều vòng, xem mục 6
             llm_api_key?: string, llm_base_url?: string, llm_model?: string }
```

- `job_id` (bao gồm lịch sử run) có thể thay thế `document_id`: server phân giải tài liệu thuộc về và giới hạn phạm vi tìm kiếm;
- Ba trường `llm_*` đến từ cài đặt thông tin xác thực frontend, ghi đè cấu hình env của server theo yêu cầu; thiếu key trả về 400 "Vui lòng điền API Key mô hình trong cài đặt thông tin xác thực frontend".

**Không phát trực tiếp** (`stream` mặc định false): chờ câu trả lời đầy đủ (agent truy xuất nhiều vòng, thường 10-30 giây)
```json
{ "code": 0, "data": {
    "answer": "…Văn bản trả lời, câu thực tế có chú thích [n]…",
    "citations": [ { "ref": 1, "document_id": "…", "job_id": "…",
                     "page_idx": 3, "block_id": "p004-b0002", "snippet": "…" } ],
    "tool_trace": [ { "round": 1, "tool": "search_fulltext", "arguments": {…} } ],
    "rounds": 4
} }
```

**Phát trực tiếp** (`stream: true`): SSE (`text/event-stream`), mỗi dòng `data: {json}`, các loại sự kiện:

| type | Các trường | Giải thích |
|---|---|---|
| `tool` | round, tool, arguments | Đẩy theo thời gian thực mỗi khi agent gọi công cụ — hiển thị thành gợi ý quá trình "đang truy xuất: xxx" |
| `answer_delta` | text | Tăng dần từng token của câu trả lời cuối, render từng phần |
| `done` | answer, citations, tool_trace, rounds | Kết quả cuối cùng (cấu trúc giống data không phát) |
| `error` | message | Thất bại |

Điểm cần lưu ý khi render frontend:
- `[n]` trong văn bản trả lời tương ứng với `citations[].ref`, hiển thị thành trích dẫn có thể nhấp; khi nhấp dùng `job_id + page_idx + block_id` để nhảy đến trình đọc — **cùng logic neo với lưu trữ**;
- Khi truyền `document_id` thì giới hạn hỏi đáp trong một tài liệu ("hỏi tài liệu này" trong trình đọc), không truyền thì tìm kiếm toàn bộ thư viện;
- Sự kiện quá trình khuyến nghị hiển thị văn bản ngữ nghĩa của `tool`: `search_fulltext`→"Tìm kiếm toàn văn", `read_blocks`→"Đọc ngữ cảnh bản gốc", `list_documents`→"Duyệt thư viện", `search_favorites`→"Tìm lưu trữ";
- Khi dịch vụ AI chưa khởi động, proxy trả về 502, thông báo "Dịch vụ AI chưa chạy".

### 5. Tài sản (ảnh đính kèm như ảnh chụp lưu trữ)

```
POST /api/v1/assets                    ← multipart, tên trường file (png/jpeg/webp, ≤20MB)
     → data: { asset_id, mime, bytes, created_at }
GET  /api/v1/assets/:asset_id          ← Nội dung tệp; định địa chỉ nội dung, phản hồi kèm header cache immutable, có thể an tâm dùng <img src>
```

- `asset_id` = sha256 của tệp: cùng một ảnh tải lên nhiều lần tự động hợp nhất, nhận cùng id;
- **Luồng lưu trữ ảnh**: canvas xuất PNG → POST assets lấy asset_id → POST favorites kèm `asset_id` (khuyến nghị `kind: "figure"`) và `rect_json` (lưu nguyên hình học cắt, đổi thiết bị có thể khôi phục);
- Bản ghi favorites hiện trả về các trường `asset_id` / `rect_json`, chuỗi rỗng = lưu trữ văn bản thuần.

### 6. Hội thoại hỏi đáp AI (lưu trữ lịch sử + hội thoại nhiều vòng)

```
POST   /api/v1/ai/conversations                      body: { title?, document_id? }
GET    /api/v1/ai/conversations?limit=50&offset=0    → data.conversations[] (bao gồm message_count, sắp xếp theo cập nhật giảm dần)
GET    /api/v1/ai/conversations/:id                  → Các trường hội thoại + messages[] (seq tăng dần)
DELETE /api/v1/ai/conversations/:id                  Xóa tầng kèm tin nhắn
POST   /api/v1/ai/conversations/:id/messages         body: { role, content, citations_json?, tool_trace_json?, model? }
```

- **Frontend tích hợp hội thoại nhiều vòng chỉ cần một bước**: tạo hội thoại lấy `conversation_id`, sau đó mỗi lần `/api/v1/ai/ask` đều truyền nó — server tự động tiêm các vòng trước làm ngữ cảnh, sau khi trả lời xong tự động ghi user/assistant vào lịch sử (**frontend không cần gọi giao diện messages**, đó là để AI service ghi lại);
- `citations_json` trong tin nhắn là mảng ảnh chụp neo (cấu trúc giống citations trả về từ ask), khi render lịch sử cũng có thể nhấp để nhảy;
- **Ngữ nghĩa neo mềm**: trích dẫn hỏi đáp không ngăn xóa job (khác với bảo vệ 409 của lưu trữ), sau khi job bị xóa, nhảy không còn nhưng văn bản snippet vẫn còn — khi nhảy thất bại, hãy giảm cấp duyên dáng thành chỉ hiển thị văn bản;
- Tiêu đề hội thoại tự động lấy 40 ký tự đầu của câu hỏi đầu tiên, có thể ghi đè bằng `title` khi tạo.

### 7. Phân loại (bộ sưu tập): tạo thư mục để nhóm PDF

> Bảng `collections`/`collection_documents` đã được tạo cùng với tầng dữ liệu thư viện, nhưng chưa gắn route; nay bổ sung. v1 chỉ làm thư mục phẳng (không hỗ trợ lồng, `parent_id` truyền vào cũng chấp nhận, nhưng frontend hiện không cần dùng).

```
POST   /api/v1/collections                body: { name, parent_id? }
GET    /api/v1/collections                → data.collections[] (sắp xếp theo sort_order, bao gồm document_count)
PATCH  /api/v1/collections/:id             body: { name?, sort_order? }
DELETE /api/v1/collections/:id             ← Chỉ xóa thư mục, tài liệu không bị ảnh hưởng

POST   /api/v1/collections/:id/documents              body: { document_ids: [...] }
DELETE /api/v1/collections/:id/documents/:document_id
```

- Truyền `document_id` không tồn tại trả về 404; thêm cùng tài liệu nhiều lần là idempotent (không báo lỗi, không đếm trùng);
- Xem tài liệu trong một thư mục: `GET /api/v1/documents?collection_id=xxx` (xem mục 1), `active_job_id` trong mỗi bản ghi nhận được là run xử lý hiện tại có thể mở của tài liệu đó;
- Nếu frontend vẫn đang dùng `/api/v1/library/books` cũ để render thẻ (thay vì chiếu `/api/v1/documents`), hãy ghép tập hợp `active_job_id` nhận được ở bước trên vào tham số `job_ids` mới (phân cách bằng dấu phẩy, xem giải thích bên dưới về `/api/v1/library/books`) để lấy dữ liệu cùng cấu trúc với thẻ thư viện trang chủ, không cần làm thêm một bộ render "chi tiết thẻ thư mục" khác.

### `/api/v1/library/books` thêm tham số tùy chọn: `job_ids`

```
GET /api/v1/library/books?job_ids=job-a,job-b,job-c
```

- Danh sách trắng job_id phân cách bằng dấu phẩy, chỉ trả về các bản ghi khớp, hình dạng giống hệt khi không truyền tham số;
- Không truyền là trạng thái hiện tại (phân trang `limit`/`offset`), đây là tham số tăng dần thuần túy, không ảnh hưởng đến bất kỳ caller hiện có nào;
- Khi truyền `job_ids`, không cắt theo phân trang — ngữ nghĩa là "cho tôi chính xác các job này", không phải "lật đến trang thứ mấy".

## Hai ranh giới phải xử lý

1. **Bảo vệ xóa**: khi xóa sách (`DELETE /api/v1/library/books/:job_id`), nếu job đó bị lưu trữ tham chiếu, backend trả về **409**, trong message có số lượng tham chiếu — frontend phải hiển thị lỗi này thành "Tài liệu có N lưu trữ, vui lòng xóa lưu trữ trước", thay vì lỗi chung.
2. **Tải lên trùng lặp**: cùng một PDF tải lên lại không tạo tài liệu mới (số lượng danh sách documents không thay đổi), frontend không nên giả định "tải lên thành công = danh sách có thêm một mục".

## Đường dẫn di chuyển đề xuất (không bắt buộc)

1. **Bước đầu chỉ làm tăng dần**: thêm "chọn → lưu trữ" và thanh bên lưu trữ trong trình đọc (chỉ thêm mới, không động đến trang hiện có). Nhảy lưu trữ: dùng `job_id + page_idx + block_id` trong neo để tái sử dụng định vị trình đọc hiện có.
2. **Bước hai** chuyển trang chủ thư viện từ chiếu `/api/v1/library/books` sang `/api/v1/documents`, lấy được thẻ / trạng thái đọc / khả năng bộ sưu tập.

## Phụ lục: Tra cứu nhanh các trường

| Trường | Giải thích |
|---|---|
| `document_id` | sha256(hex) nội dung tệp, ổn định không đổi |
| `active_job_id` | Run xử lý hiện tại, điểm vào trình đọc |
| `job_id` (trong lưu trữ/kết qu��) | Phiên bản không gian block nơi neo |
| `block_id` | ID block của `document.v1.json`, ví dụ `p001-b0002` |
| `page_idx` | Số trang bắt đầu từ 0 |
| `reading_status` | `unread` / `reading` / `done` |
| `kind` (lưu trữ) | `sentence` / `data` / `figure` |
