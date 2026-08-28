# Reader AI Chat API

RetainPDF backend cung cấp một giao diện hỏi đáp đọc tối thiểu nhưng có thể mở rộng. Frontend không truyền khóa model; backend chỉ đọc biến môi trường phía máy chủ.

## Endpoint

`POST /api/v1/jobs/{job_id}/reader/ai/chat`

## Yêu cầu

```json
{
  "message": "Đóng góp cốt lõi của bài viết này là gì?",
  "scope": "document",
  "provider": "deepseek",
  "model": "deepseek-chat",
  "api_key": "sk-...",
  "base_url": "https://api.deepseek.com/v1",
  "context": {
    "page": 3,
    "selection": {
      "page": 3,
      "rect": { "left": 120, "top": 240, "width": 300, "height": 180 }
    },
    "mode": "compare"
  },
  "history": [
    { "role": "user", "content": "Tóm tắt trước" },
    { "role": "assistant", "content": "..." }
  ]
}
```

Phiên bản đầu tiên chỉ hỗ trợ `scope=document`. `context` và `history` là tùy chọn; `context.page` / `selection.page` được dùng làm manh mối trọng số truy xuất.

Các trường cấu hình model tùy chọn:

- `provider`: Tùy chọn, mặc định `deepseek`, hỗ trợ `deepseek` / `openai`.
- `model`: Tùy chọn, DeepSeek mặc định `deepseek-chat`.
- `api_key`: Tùy chọn, ưu tiên sử dụng khi frontend truyền trực tiếp. Backend không ghi vào job snapshot, events hay body phản hồi.
- `base_url`: Tùy chọn, DeepSeek mặc định `https://api.deepseek.com/v1`.

## Phản hồi

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "answer": "Bài viết này chủ yếu đề xuất...",
    "citations": [
      {
        "title": "Introduction",
        "page": 1,
        "snippet": "..."
      }
    ],
    "used_context": {
      "source": "markdown",
      "scope": "document"
    }
  }
}
```

## Hành vi backend

Luồng phiên bản đầu tiên:

1. Dựa vào `job_id`, ưu tiên đọc artifact dịch có cấu trúc cục bộ: `jobs/{job_id}/translated/translation-manifest.json` và payload từng trang mà nó tham chiếu.
2. Trích xuất `page_idx/page_number`, vai trò tiêu đề và `render_markdown/translated_text` từ payload từng trang để tạo chunk nhận biết trang.
3. Nếu artifact dịch có cấu trúc không tồn tại hoặc trống, dự phòng về Markdown đã xuất bản: `jobs/{job_id}/md/full.md`, cắt chunk theo tiêu đề và đoạn văn.
4. Chọn chiến lược truy xuất theo câu hỏi của người dùng:
   - Câu hỏi thông thường: Tìm kiếm từ khóa nhẹ, lấy top 8 chunk.
   - Câu hỏi tổng hợp chung: Ưu tiên lấy chunk đại diện từ các chương như Abstract / Introduction / Methods / Results / Discussion / Conclusion và lấy mẫu đều toàn văn, tránh chỉ trúng trang đầu.
5. Gửi chunk, câu hỏi người dùng và lịch sử giới hạn đến model hỏi đáp đọc.
6. Trả về câu trả lời của model và các đoạn trích dẫn được backend truy xuất.

Lưu ý: Khi ưu tiên sử dụng `translation-manifest.json`, `citations[].page` lấy từ `page_number` hoặc `page_idx + 1` trong payload từng trang. Chỉ khi dự phòng về `full.md`, số trang mới cần suy luận từ văn bản Markdown, nếu không suy luận được thì là `null`.

## Cấu hình

Frontend có thể truyền trực tiếp `api_key` trong body yêu cầu. Nếu body không truyền, backend mới đọc biến môi trường phía máy chủ:

```bash
RETAINPDF_AI_PROVIDER=deepseek
RETAINPDF_AI_MODEL=deepseek-chat
DEEPSEEK_API_KEY=...
```

Tùy chọn:

```bash
RETAINPDF_AI_BASE_URL=https://api.deepseek.com/v1
RETAINPDF_AI_API_KEY=...
```

Ưu tiên:

1. `provider/model/api_key/base_url` trong body yêu cầu
2. Biến môi trường máy chủ `RETAINPDF_AI_PROVIDER/RETAINPDF_AI_MODEL/RETAINPDF_AI_API_KEY/RETAINPDF_AI_BASE_URL`
3. Giá trị mặc định của provider

Provider mặc định là `deepseek`, cũng hỗ trợ `openai`. `RETAINPDF_AI_API_KEY` là biến ghi đè chung; nếu không đặt, `deepseek` đọc `DEEPSEEK_API_KEY`, `openai` đọc `OPENAI_API_KEY`.

## Mã lỗi

- `404`: job không tồn tại, hoặc Markdown không tồn tại/không đọc được.
- `409`: Tác vụ chưa hoàn thành, Markdown chưa sẵn sàng.
- `429`: Dịch vụ model bị giới hạn tốc độ.
- `502`: Dịch vụ model thất bại hoặc trả về phản hồi không hợp lệ.
- `500`: Lỗi nội bộ backend, ví dụ chưa cấu hình AI provider.
