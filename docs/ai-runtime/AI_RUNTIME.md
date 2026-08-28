# Thiết kế AI Runtime RetainPDF

**Trạng thái:** Bản thảo thiết kế v0.1  
**Ngày:** 2026-07-21  
**Phạm vi:** `backend/ai_service` (retainpdf-ai) và hợp đồng với Rust / frontend  
**Không thuộc phạm vi:** Đường ống OCR/dịch; khóa nhà cung cấp LLM cụ thể

Tài liệu kèm theo:

- [SESSION_AND_MEMORY.md](./SESSION_AND_MEMORY.md) — Nhiều vòng và nén  
- [SKILLS.md](./SKILLS.md) — Gói Skill  

---

## 1. Động lực

Hiện tại `RetrievalAgent` đủ để hỗ trợ "truy xuất toàn bộ tài liệu + chuyển hướng trích dẫn", nhưng lộ trình sản phẩm còn cần:

| Năng lực | Tại sao phải thiết kế ngay |
|------|------------------|
| **Skills** | Hỏi đáp tài liệu / trợ lý chú thích / so sánh nhiều tài liệu… không thể nhét hết vào một system prompt |
| **Gọi công cụ** | Đã có function calling; cần phiên bản hóa, phạm vi quyền, ngân sách, khả năng quan sát |
| **Nén ngữ cảnh** | Sau nhiều vòng, `history[-12:]` sẽ làm tràn token và mất cấu trúc bằng chứng |
| **Đa Agent** | Tách biệt truy xuất và viết, có thể có critic; tránh vòng lặp đơn vô hạn |

Ràng buộc (không thể phá vỡ):

1. **Rust là bên ghi duy nhất vào mặt dữ liệu** (documents / FTS / conversations / favorites).  
2. **AI service ưu tiên không trạng thái**: có thể khởi động lại; phiên được lưu vào Rust.  
3. **Ưu tiên người dùng đơn cục bộ**: độ trễ và khả năng kiểm soát > mức độ hoàn chỉnh của nền tảng agent đám mây.  
4. **Schema công cụ đồng cấu với OpenAI-compatible tools**, dễ thay đổi vòng ngoài.

---

## 2. Kiến trúc phân tầng

```
┌─────────────────────────────────────────────────────────────┐
│  Frontend (bảng AI reader)                                 │
│  SSE: tool / answer_delta / compress / handoff / done       │
└───────────────────────────┬─────────────────────────────────┘
                            │ POST /api/v1/ai/ask  (proxy Rust)
┌───────────────────────────▼─────────────────────────────────┐
│  Transport  app.py                                          │
│  Xác thực · SSE · Kiểm tra yêu cầu · Truyền conversation_id │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│  Orchestrator  (về sau; v0 có thể downgrade thành "chạy skill mặc định")│
│  Chọn skill / có đa agent hay không / khi nào kết thúc      │
└───────┬─────────────────────┬───────────────────────────────┘
        │                     │
┌───────▼───────┐   ┌─────────▼─────────┐
│ Session/Memory│   │ RunBudget         │
│ Cửa sổ·Tóm tắt·Bằng chứng │ Số vòng·Token·Thời gian tường  │
└───────┬───────┘   └─────────┬─────────┘
        │                     │
┌───────▼─────────────────────▼─────────┐
│  Agent Runtime(s)                     │
│  Vòng lặp công cụ chung · Phát sự kiện · Điều kiện dừng  │
└───────┬───────────────────────────────┘
        │
┌───────▼───────────────────────────────┐
│  Skills  →  Tools                     │
│  Gói khai báo năng lực    Hành động nguyên tử │
└───────┬───────────────────────────────┘
        │
┌───────▼───────────────────────────────┐
│  Data plane (chỉ đọc từ góc nhìn AI)   │
│  Rust HTTP · thư mục job md/ocr/translated│
└───────────────────────────────────────┘
```

| Tầng | Trách nhiệm | Hiện trạng | Mục tiêu |
|----|------|------|------|
| Transport | HTTP/SSE, Key | `app.py` | Giữ mỏng; loại sự kiện có thể mở rộng |
| Session/Memory | Nhiều vòng, nén | `history[-12:]` văn bản gốc | Cửa sổ + tóm tắt + gói bằng chứng |
| Orchestrator | Định tuyến/hợp tác | Không có (single agent) | Chọn skill → có thể multi-agent |
| Runtime | Vòng lặp công cụ | `agent.py` | Tách thành loop tái sử dụng |
| Skills | Chiến lược+gợi ý+tập con công cụ | SYSTEM_PROMPT hardcode | Gói skill dạng thư mục |
| Tools | I/O nguyên tử | `tools.py` | Thêm scope/timeout/phiên bản |
| Evidence | Trích dẫn/hình ảnh | Citation dataclass | Giao thức thống nhất, frontend có thể chuyển hướng và render |

---

## 3. Đối tượng cốt lõi (mô hình logic)

### 3.1 Run

Một đơn vị thực thi do câu hỏi của người dùng kích hoạt (có thể nhiều vòng công cụ, có thể qua nhiều agent).

```text
Run
  run_id            Tạo runtime (liên kết log/SSE)
  conversation_id   Tùy chọn, phiên bền vững
  skill_id          Mặc định literature-qa
  scope             { document_id?, job_id? }
  budget            RunBudget
  status            running | done | error | cancelled
  events[]          Vết quan sát được
  result            answer + evidence + usage
```

### 3.2 RunBudget

```text
RunBudget
  max_tool_rounds      Mặc định 6 (RETAIN_AI_MAX_TOOL_ROUNDS hiện tại)
  max_wall_time_s      Đề xuất 120
  max_input_tokens     Đề xuất 60% cửa sổ model
  max_tool_calls       Đề xuất 24
  max_evidence_items   Đề xuất 32 (giới hạn trên khi nén)
```

Khi cạn: vòng thu dọn bắt buộc (giữ hành vi "Hãy trả lời dựa trên bằng chứng hiện có").

### 3.3 EvidenceItem (Bằng chứng thống nhất)

Frontend chuyển hướng, hình minh họa, chú thích đều dùng hình dạng này:

```text
EvidenceItem
  ref               int          # [n] hiển thị cho người dùng
  kind              text | image | page_preview | favorite
  document_id
  job_id
  page_idx          0-based
  block_id? 
  snippet?          Trích đoạn ngắn
  image_url?        /api/v1/jobs/.../markdown/images/...
  preview_url?      /api/v1/jobs/.../preview/pages/{1-based}
  source_tool       search_fulltext | read_blocks | ...
  created_round     int
```

`citations[]` là view của tập con `kind=text` (và được trích dẫn trong câu trả lời) trong `EvidenceItem`.

### 3.4 Tin nhắn Transcript (lưu trữ phiên)

Xem [SESSION_AND_MEMORY.md](./SESSION_AND_MEMORY.md). Điểm chính: ngoài `user`/`assistant`, cho phép **`system_summary`** và trường metadata **`evidence_snapshot`** (có thể nằm trong phần mở rộng JSON của tin nhắn assistant, hoặc loại tin nhắn độc lập).

---

## 4. Luồng sự kiện (Hợp đồng SSE)

Tương thích ngược với các loại hiện có; các loại mới tùy chọn, frontend có thể bỏ qua.

| type | Khi nào | payload要点 |
|------|------|----------------|
| `tool` | Trước/sau gọi công cụ | `tool`, `round`, `arguments?`, `status?` |
| `answer_delta` | Luồng câu trả lời cuối | `text` gia tăng hoặc tích lũy (**triển khai phải cố định một cách**; hiện tại là tích lũy toàn văn) |
| `compress` | Nén xảy ra | `dropped_turns`, `summary_chars`, `kept_evidence` |
| `skill` | Chuyển/tải skill | `skill_id`, `phase: start\|end` |
| `handoff` | Bàn giao agent | `from`, `to`, `reason` |
| `done` | Kết thúc thành công | `answer`, `citations`, `tool_trace`, `rounds`, `usage?`, `memory?` |
| `error` | Thất bại | `message`, `code?` |

**Quy tắc tương thích:** Frontend cũ chỉ cần nhận `tool` / `answer_delta` / `done` / `error` là đủ.

---

## 5. Skills và Tools (Ranh giới)

```text
Tool  = Hành động nguyên tử (có schema, có thể unit test, có thể kiểm tra)
Skill = Tập con công cụ + gợi ý system/developer + chiến lược (khóa scope, định dạng đầu ra, có cho phép list_documents không)
```

Xem chi tiết tại [SKILLS.md](./SKILLS.md).

Skill đầu tiên:

| skill_id | Mục đích | Công cụ |
|----------|------|------|
| `literature-qa` | Hỏi đáp toàn bộ tài liệu trong reader (hành vi hiện tại) | search_fulltext, read_blocks, search_favorites (có scope) |

Các ứng viên tiếp theo: `annotation-assist`, `paper-compare`, `glossary-extract`.

---

## 6. Đa Agent (Phase D, giao diện chiếm chỗ trước)

**v0 / v1 không bắt buộc multi-agent.** Giao diện dự phòng:

```text
AgentRole
  id: retriever | analyst | critic
  skill_id hoặc tool_allowlist
  model_override?
```

Bàn giao:

```text
Handoff
  from_role → to_role
  payload: { evidence_refs[], question, notes }
```

Lộ trình phát triển khuyến ngh���:

1. **Single Runtime + literature-qa** (hiện tại)  
2. **Pipeline** Retriever → Analyst (cùng evidence, khác prompt)  
3. **Critic tùy chọn** kiểm tra "khẳng định không có [n]"  
4. Sau đó mới xét fan-out song song (nhiều tài liệu)

Orchestrator dùng máy trạng thái đơn giản, không cần đồ thị thực thi trước.

---

## 7. Cấu trúc gói mục tiêu

```text
backend/ai_service/retainpdf_ai/
  app.py                 # Transport
  config.py
  rust_client.py
  tools/                 # Hoặc giữ tools.py rồi tách
    registry.py
    literature.py        # search/read/favorites
  skills/
    loader.py
    literature_qa/
      skill.yaml
      prompt.md
  runtime/
    loop.py              # Tách từ agent.py
    budget.py
    events.py
  memory/
    assemble.py          # Ghép messages
    compress.py          # Tóm tắt + cắt
  orchestrator/
    default.py           # v0: chạy skill trực tiếp
  evidence/
    model.py
    assign_refs.py
  agent.py               # Facade quá độ → gọi runtime
```

Khi di chuyển, **đường dẫn `POST /v1/ask` và trường giữ tương thích**; thay đổi chuỗi gọi nội bộ.

---

## 8. Ranh giới với Rust / Frontend

### Rust

- Tiếp tục: proxy `/api/v1/ai/ask`, CRUD conversations, thêm messages  
- Mở rộng (B cần): tin nhắn có thể mang `metadata_json` (summary / evidence_snapshot / skill_id)  
- AI **không** trực tiếp ghi SQLite  

### Frontend

- Gửi: `question`, `document_id`/`job_id`, `conversation_id`, `stream`, thông tin LLM  
- Tiêu thụ: SSE + `citations` + hydrate hình ảnh (đã có)  
- Về sau: hiển thị gợi ý nén, tên skill, danh sách nhiều phiên (có thể tái sử dụng Rust conversations)

### AI service

- Đọc: Rust search/documents/favorites + thư mục job  
- Ghi: chỉ qua Rust append conversation messages  

---

## 9. Bảo mật và chính sách

| Chính sách | Giải thích |
|------|------|
| Phạm vi Document | Phiên reader ép `document_id`; tiêm ở tầng công cụ (hiện có `_scope_tool_arguments`) |
| Cấm ngầm truy xuất toàn bộ | Có job không có document thì fail closed (hiện có) |
| Tác dụng phụ của Tool | v1 tools đều chỉ đọc; thao tác ghi (sửa yêu thích, v.v.) cần skill rõ ràng + xác nh��n |
| Khóa | LLM key có thể truyền ở cấp request; không ghi vào job snapshot / không trả về |
| Trung thực trích dẫn | System prompt yêu cầu dẫn [n] cho sự thật; có thể có critic kiểm tra sau |

---

## 10. Chiến lược kiểm thử

| Tầng | Kiểm thử gì |
|----|--------|
| tools | schema, handler pure functions, đường dẫn image_urls |
| runtime loop | mock chat_fn: vòng công cụ → vòng kết thúc → budget cạn |
| memory | cắt cửa sổ, thay thế tóm tắt giảm token, giữ evidence |
| app SSE | thứ tự sự kiện, done chứa citations |
| Hợp đồng | OpenAPI/ví dụ khớp với mock frontend |

Không bắt buộc e2e gọi DeepSeek thật; mock chat là đủ.

---

## 11. Các giai đoạn triển khai (mức PR)

| Phase | Bàn giao | Người dùng thấy |
|-------|------|----------|
| **C** | Bộ tài liệu này | Không |
| **B1** | Giao thức Session + frontend `conversation_id` thông suốt | Nhiều vòng có bộ nhớ |
| **B2** | Đường ống nén Memory + sự kiện `compress` | Hội thoại dài không tràn, có thể hiển thị "đã nén" |
| **S1** | Tải Skill + literature-qa ngoài | Hành vi tương tự, có thể thêm skill nóng |
| **D0** | Orchestrator chiếm chỗ + tùy chọn tách analyst | Cải thiện chất lượng/cấu trúc câu trả lời |

Mỗi phase giữ `/v1/ask` tương thích; đường dẫn bỏ sẽ có cửa sổ một phiên bản nhỏ.

---

## 12. Cố ý không làm (giai đoạn này)

- Gắn một framework agent cụ thể là duy nhất  
- AI service ghi trực tiếp vào thư viện nghiệp vụ  
- Hội thoại đa agent không giới hạn budget  
- Frontend triển khai thêm một giao thức tool  
- Định tuyến đa thuê bao đám mây (không phải hình thức sản phẩm hiện tại)

---

## 13. Quyết định (vấn đề mở)

| ID | Vấn đề | Xu hướng | Trạng thái |
|----|------|------|------|
| D1 | `answer_delta` gửi gia tăng hay tích lũy? | **Cố định tích lũy toàn văn** (khớp hiện thực), ghi rõ trong tài liệu | Đề xuất phê duyệt |
| D2 | Tóm tắt lưu ở đâu? | `metadata_json` hoặc tin nhắn `kind=summary` bên cạnh assistant | Xem tài liệu Session |
| D3 | Nén dùng LLM hay trích xuất? | v1 **trích xuất** (trích dẫn + từ khóa câu hỏi); v2 có thể LLM tóm tắt | Đề xuất phê duyệt |
| D4 | Multi-agent có mặc định bật không? | Mặc định tắt; feature flag / cấu hình skill | Đề xuất phê duyệt |

---

## 14. Điểm neo code tham khảo

| Đường dẫn | Vai trò |
|------|------|
| `backend/ai_service/retainpdf_ai/agent.py` | Vòng lặp hiện tại / đánh số tham chiếu |
| `backend/ai_service/retainpdf_ai/tools.py` | Công cụ nguyên tử |
| `backend/ai_service/retainpdf_ai/app.py` | SSE / history / persist |
| `backend/ai_service/retainpdf_ai/rust_client.py` | Client phiên và truy xuất |
| `frontend/.../use-reader-ask-runtime.ts` | Frontend tiêu thụ ask |
| `frontend/.../answer-enhance.ts` | Chuyển hướng trích dẫn và hình ảnh |