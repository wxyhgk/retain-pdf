# Dịch vụ AI retainpdf

Dịch vụ AI thường trú: trả lời truy vấn agentic cho thư viện. Không trạng thái — mặt dữ liệu (documents / favorites / FTS) chỉ do Rust API quản lý, dịch vụ này đọc qua HTTP; văn bản khối đọc trực tiếp sản phẩm trong thư mục tác vụ (chỉ đọc).

## Kiến trúc

```
POST /v1/ask ──▶ RetrievalAgent(vòng lặp trần, DeepSeek function calling)
                    │  Registry công cụ (name+schema+handler đẳng cấu với agent SDK phổ biến)
                    ├── list_documents    → Rust /api/v1/documents
                    ├── search_fulltext   → Rust /api/v1/search(khớp neo FTS5)
                    ├── read_blocks       → data/jobs/<job>/{ocr,translated}(chỉ đọc)
                    └── search_favorites  → Rust /api/v1/favorites
Trả về: answer + citations[](có neo document/job/page/block, nhảy được đến trình đọc) + tool_trace
```

Cố tình không sử dụng framework agent: một provider, dịch vụ cục bộ một người dùng, vòng lặp trần kiểm soát hoàn toàn thời gian chờ / số vòng / số tham chiếu; định nghĩa công cụ đẳng cấu, khi di chuyển chỉ thay vỏ vòng lặp.

## Chạy

```bash
RETAIN_AI_API_KEYS=dev-local-key \
RETAIN_AI_RUST_API_KEY=dev-local-key \
RETAIN_AI_LLM_API_KEY=sk-... \
python3 -m retainpdf_ai
# Mặc định 127.0.0.1:41100; chạy trong thư mục backend/ai_service
```

Biến môi trường (đều có giá trị mặc định, trừ thông tin xác thực):

| Biến | Mặc định | Mô tả |
|---|---|---|
| `RETAIN_AI_API_KEYS` | Bắt buộc | Tập hợp X-API-Key của dịch vụ này (phân cách bằng dấu phẩy) |
| `RETAIN_AI_RUST_API_KEY` | Bắt buộc | Key để gọi Rust API |
| `RETAIN_AI_LLM_API_KEY` | Bắt buộc | Key DeepSeek (hoặc endpoint tương thích) |
| `RETAIN_AI_RUST_API_BASE` | `http://127.0.0.1:41000` | Địa chỉ Rust API |
| `RETAIN_AI_LLM_BASE_URL` | `https://api.deepseek.com/v1` | Điểm cuối LLM |
| `RETAIN_AI_LLM_MODEL` | `deepseek-v4-flash` | Mô hình |
| `RETAIN_AI_PORT` | `41100` | Cổng lắng nghe |
| `RETAIN_AI_MAX_TOOL_ROUNDS` | `6` | Giới hạn số vòng công cụ agent |
| `RETAIN_AI_MEMORY_WINDOW_TURNS` | `6` | Số vòng trò chuyện gần đây được giữ |
| `RETAIN_AI_MEMORY_COMPRESS_AFTER_TURNS` | `12` | Vượt quá thì nén trích xuất các vòng sớm |
| `RETAIN_AI_MEMORY_MAX_CHARS` | `24000` | Giới hạn ký tự history đưa vào mô hình |
| `RETAIN_AI_DATA_ROOT` | `<repo>/data` | Thư mục gốc sản phẩm tác vụ |

## Ví dụ gọi

```bash
curl -s -X POST http://127.0.0.1:41100/v1/ask \
  -H "X-API-Key: dev-local-key" -H "Content-Type: application/json" \
  -d '{"question": "Tài liệu nào trong thư viện thảo luận về tính chọn lọc của trao đổi halogen-lithium? Kết luận là gì?"}'
```

## Kiểm tra

```bash
cd backend/ai_service && python3 -m pytest tests/ -q
```
