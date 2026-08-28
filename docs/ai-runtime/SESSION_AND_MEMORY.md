# Phiên và nén ngữ cảnh (Bản thảo B)

**Trạng thái:** API / Hình dạng dữ liệu bản thảo v0.1 · **B1 + B2 đã triển khai**  
**Ngày:** 2026-07-21  
**Phụ thuộc:** [AI_RUNTIME.md](./AI_RUNTIME.md)  
**Mục tiêu:** Nhiều vòng thực sự có thể sử dụng; hội thoại dài không làm tràn ngữ cảnh; bằng chứng (trích dẫn/hình ảnh) có thể tái sử dụng qua các vòng

### Tóm tắt triển khai B1 (thực hiện)

| Hạng mục | Vị trí |
|----|------|
| AI auto-create + `done.conversation_id` | `retainpdf_ai/app.py` |
| Rust tạo client | `retainpdf_ai/rust_client.py` |
| Lưu trữ sticky frontend | `frontend/src/js/reader/ai/conversation-store.ts` |
| ask gửi/nhận conversationId | `api/ai.ts` + `ask-answerer.ts` |

### Tóm tắt triển khai B2 (thực hiện)

| Hạng mục | Vị trí |
|----|------|
| Trích xuất nén `extractive_v1` | `retainpdf_ai/memory/compress.py` |
| Lắp ráp cửa sổ | `retainpdf_ai/memory/assemble.py` |
| SSE `compress` + `done.memory` | `retainpdf_ai/app.py` |
| Cấu hình | `RETAIN_AI_MEMORY_WINDOW_TURNS` v.v. (xem config.py) |
| Lưu tóm tắt | tin nhắn assistant, nội dung bắt đầu bằng `【Tóm tắt hội thoại】` |

---

## 1. Hiện trạng và khoảng trống

### 1.1 Đã có

| Năng lực | Vị trí |
|------|------|
| Rust CRUD phiên | `/api/v1/ai/conversations` |
| Thêm tin nhắn | `.../messages` (user/assistant + citations_json + tool_trace_json) |
| AI đọc lịch sử | `load_history` → **12 tin nhắn gần nhất** `role+content` |
| AI ghi lại | `persist_turn` ghi user + assistant |

### 1.2 Khoảng trống

1. Trình đọc frontend **thường không gửi / tạo `conversation_id`** → thực tế nhiều vòng không có trạng thái.  
2. Lịch sử **chỉ nhét văn bản gốc**, không có tóm tắt, không có gói bằng chứng → dài vừa đắt vừa mất cấu trúc.  
3. `tool_trace` được lưu nhưng **không được đưa lại vào mô hình** (đúng, nhưng cần hình thức khác để giữ bằng chứng).  
4. Không có **sự kiện nén**, người dùng không biết "các vòng đầu đã được tóm tắt".  
5. Không có **view memory** thống nhất ( `messages[]` cho runtime và transcript cho lưu trữ chưa được phân tầng).

---

## 2. Phân tầng khái niệm

```text
Transcript (lưu trữ, Rust)
  = Bản ghi hội thoại đầy đủ người dùng thấy (có thể chứa tin nhắn tóm tắt)

MemoryView (runtime, lắp ráp trong bộ nhớ AI)
  = messages[] được đưa vào LLM
  = f(Transcript, EvidenceStore, CompressPolicy)

EvidenceStore (runtime + có thể snapshot lưu)
  = EvidenceItem tích lũy của phiên (theo ref hoặc hash nội dung)
```

Nguyên tắc:

- **Transcript giữ nguyên** (có thể phát lại UI)  
- **MemoryView tối giản** (có thể cắt, có thể thay thế bằng tóm tắt)  
- **Evidence ổn định** ( [ n ] và anchor ổn định qua các vòng)

---

## 3. Hình dạng dữ liệu

### 3.1 Conversation (Rust, đã có thể mở rộng)

```json
{
  "conversation_id": "conv_...",
  "document_id": "doc_...",
  "job_id": "2026...",
  "title": "Tự động hoặc do người dùng đặt",
  "skill_id": "literature-qa",
  "created_at": "...",
  "updated_at": "..."
}
```

Các trường mở rộng (đề xuất):

| Trường | Giải thích |
|------|------|
| `document_id` / `job_id` | Phạm vi mặc định của phiên (ghi khi tạo bởi trình đọc) |
| `skill_id` | Skill mặc định |
| `memory_json` | Tùy chọn: trạng thái nén `{ "summary": "...", "through_message_id": "..." }` |

### 3.2 Message (Rust)

Hiện có: `role`, `content`, `citations_json`, `tool_trace_json`, `model`, thời gian.

**Đề xuất mở rộng `metadata_json` (đối tượng JSON)**:

```json
{
  "kind": "turn | summary | system_note",
  "run_id": "run_...",
  "skill_id": "literature-qa",
  "evidence_refs": [1, 2, 5],
  "usage": { "prompt_tokens": 0, "completion_tokens": 0 },
  "compress": {
    "covers_message_ids": ["m1", "m2"],
    "policy": "extractive_v1"
  }
}
```

| kind | role gợi ý | Công dụng |
|------|-----------|------|
| `turn` | user / assistant | Hỏi đáp thông thường (mặc định) |
| `summary` | `assistant` hoặc `system` chuyên biệt | Tóm tắt lịch sử đã nén (UI có thể thu gọn hiển thị "đã nén N vòng") |
| `system_note` | system | Gỡ lỗi/thông tin chiến lược, mặc định không hiển thị cho người dùng |

**Tương thích:** Tin nhắn cũ không có `metadata_json` được coi là `kind=turn`.

### 3.3 EvidenceSnapshot (có thể nhúng trong metadata assistant hoặc bảng riêng)

```json
{
  "items": [
    {
      "ref": 1,
      "kind": "text",
      "document_id": "doc_x",
      "job_id": "job_y",
      "page_idx": 3,
      "block_id": "p004-b0012",
      "snippet": "……",
      "image_urls": ["/api/v1/jobs/job_y/markdown/images/page-4/imgs/..."]
    }
  ],
  "ref_counter": 6
}
```

Trong cùng phiên, **ref tăng đơn điệu không thu hồi** (tránh «[2] vòng trước là A, vòng này là B»).  
Nếu bắt buộc phải thu hồi, UI chỉ hiển thị `citations` của vòng hiện tại, bong bóng lịch sử gắn với snapshot lúc đó.

---

## 4. Thuật toán lắp ráp Memory (cốt lõi B2)

### 4.1 Đầu vào

```text
assemble_memory(
  transcript: Message[],
  scope: { document_id, job_id },
  skill: Skill,
  budget: TokenBudget,
) -> { messages: ChatMessage[], evidence: EvidenceItem[], debug }
```

### 4.2 Chiến lược `extractive_v1` (mặc định, không dùng LLM tóm tắt)

```text
1. Tách:
   - summaries = tin nhắn kind==summary (theo thời gian)
   - turns = cặp user/assistant kind==turn

2. Lấy «tóm tắt mới nhất» S (nếu có), nó bao phủ nội dung trước message_id đó.

3. Cửa sổ gần đây W:
   - Lấy các turn sau S, cắt xuống K vòng gần nhất (mặc định K=6 vòng = 12 tin nhắn)
   - Nếu một tin nhắn quá dài thì cắt (user 2k / assistant 3k ký tự)

4. Gói Evidence E:
   - Hợp nhất citations / evidence_snapshot từ assistant trong W
   - Giới hạn max_evidence_items (mặc định 24)
   - Ưu tiên: ref được tham chiếu bởi vòng gần nhất > mới hơn > có image_urls

5. Ghép messages:
   [ system = skill.system_prompt + scope_lock_text ]
   [ developer? = skill.developer ]
   if S: [ {role:user, content: "Dưới đây là tóm tắt các vòng trước, hãy coi là bối cảnh đã biết:\n"+S.content } ]
          [ {role:assistant, content: "Được, tôi sẽ dựa trên tóm tắt và câu hỏi mới để tiếp tục." } ]  # Tiền tố ổn định
   for m in W: thêm role/content
   if E:  thêm một ngữ cảnh ẩn/user tool? → Không;
          thay vào đó gắn vào cuối system "Bảng bằng chứng đã biết":
          "E1 [1] p.4 block … snippet"
          (kiểm soát ~2k ký tự)

6. Nếu ước lượng tokens > budget:
   - Giảm K (cửa sổ)
   - Rút ngắn snippet
   - Kích hoạt compress_now() để tạo tóm tắt mới (xem 4.3)
```

### 4.3 Khi nào nén `compress_now`

Điều kiện kích hoạt (bất kỳ):

- `len(turns) > 2K` (ví dụ 12 vòng)  
- Ước lượng prompt tokens > `0.55 * context_window`  
- Yêu cầu rõ ràng `force_compress: true`

**Mẫu tóm tắt trích xuất:**

```text
【Tóm tắt hội thoại】
- Người dùng quan tâm:…
- Kết luận đã xác nhận:… (kèm [n] nếu có)
- Vấn đề chưa giải quyết:…
- Bằng chứng quan trọng:
  [1] tr.3 … 
  [2] tr.7 …
```

Cách tạo v1:

1. Trích xuất từ các turn bị gấp: tất cả câu hỏi user (cắt), tất cả câu assistant có [n], toàn bộ citations
2. Ghép theo quy tắc, **không gọi LLM** (ổn định, rẻ, kiểm thử được)
3. v2 tùy chọn: LLM tóm tắt skill, nếu thất bại quay về v1

Sau khi nén:

1. Gửi tin nhắn `kind=summary` đến Rust  
2. Cập nhật `conversation.memory_json.through_message_id`  
3. Gửi sự kiện SSE `compress`

### 4.4 Ước lượng Token

v1 dùng ước lượng rẻ: `tokens ≈ chars / 3` (hỗn hợp Trung-Anh có thể dùng `/2.5`).  
Không bắt buộc dùng tiktoken, tránh phụ thuộc nặng vào dịch vụ AI.

---

## 5. Hình dạng API

### 5.1 Giữ tương thích: `POST /v1/ask` (retainpdf-ai)

```json
{
  "question": "……",
  "document_id": "doc_…",
  "job_id": "job_…",
  "conversation_id": "conv_…",
  "stream": true,
  "skill_id": "literature-qa",
  "force_compress": false,
  "llm_api_key": "",
  "llm_base_url": "",
  "llm_model": ""
}
```

| Trường | Hiện tại | Sau B |
|------|------|------|
| `conversation_id` | Tùy chọn | **Trình đọc nên luôn gửi** (nếu không có, backend có thể tự tạo và trả về trong done) |
| `skill_id` | Không có | Tùy chọn, mặc định `literature-qa` |
| `force_compress` | Không có | Tùy chọn |
| `history` truyền trực tiếp từ client | Không có | **Không khuyến khích**; dùng server đọc từ Rust (tránh hai nguồn) |

### 5.2 Mở rộng `done` (các trường tùy chọn)

```json
{
  "type": "done",
  "answer": "……",
  "citations": [ /* Evidence con */ ],
  "tool_trace": [ /* run này */ ],
  "rounds": 3,
  "conversation_id": "conv_…",
  "run_id": "run_…",
  "memory": {
    "window_turns": 6,
    "had_summary": true,
    "evidence_count": 8,
    "compressed": false
  },
  "usage": {
    "prompt_tokens_est": 4200,
    "completion_tokens_est": 600
  }
}
```

### 5.3 SSE mới: `compress`

```json
{
  "type": "compress",
  "dropped_turns": 8,
  "summary_chars": 900,
  "kept_evidence": 12,
  "policy": "extractive_v1"
}
```

### 5.4 Rust: Tạo phiên (khi trình đọc mở AI hoặc lần hỏi đầu)

```http
POST /api/v1/ai/conversations
{
  "document_id": "doc_…",
  "job_id": "job_…",
  "title": "",
  "skill_id": "literature-qa"
}
→ { "conversation_id": "conv_…" }
```

### 5.5 Rust: Thêm tin nhắn (mở rộng)

```http
POST /api/v1/ai/conversations/{id}/messages
{
  "role": "assistant",
  "content": "……",
  "citations_json": "[…]",
  "tool_trace_json": "[…]",
  "model": "…",
  "metadata_json": "{ \"kind\": \"turn\", \"run_id\": \"…\" }"
}
```

Tin nhắn tóm tắt:

```json
{
  "role": "assistant",
  "content": "【Tóm tắt hội thoại】…",
  "metadata_json": "{\"kind\":\"summary\",\"compress\":{\"policy\":\"extractive_v1\",\"covers_message_ids\":[…]}}"
}
```

### 5.6 Luồng trình đọc frontend (mục tiêu)

```text
mở bảng AI
  if !conversationId cho (jobId|documentId):
       tạo conversation → lưu trong bộ nhớ/localStorage key
ask(câu hỏi):
  POST ask với conversation_id + job_id + document_id
  on compress → có thể toast «Đã nén hội thoại đầu»
  on done → hiển thị answer + citations; ghi nhớ conversation_id
```

Khóa lưu trữ gợi ý: `retainpdf.reader.ai.conversation.v1:{jobId}`.

---

## 6. Mã giả Runtime

```python
def ask(question, *, conversation_id, scope, skill_id, budget, force_compress=False):
    skill = load_skill(skill_id)
    transcript = rust.list_messages(conversation_id, limit=200)

    if force_compress or should_compress(transcript, budget):
        summary_msg = build_extractive_summary(transcript, budget)
        rust.append_message(conversation_id, summary_msg)
        emit({"type": "compress", ...})
        transcript = rust.list_messages(conversation_id, limit=200)

    mem = assemble_memory(transcript, scope, skill, budget)
    result = run_tool_loop(
        messages=mem.messages,
        tools=skill.tools,
        budget=budget,
        evidence_seed=mem.evidence,
        on_event=emit,
    )
    rust.append_message(user)
    rust.append_message(assistant + citations + metadata)
    emit({"type": "done", **result, "conversation_id": conversation_id, "memory": mem.debug})
    return result
```

---

## 7. Quan hệ với số tham chiếu

| Quy tắc | Giải thích |
|------|------|
| Trong một run | Giống `_assign_refs` hiện tại, bắt đầu từ 1 hoặc `ref_counter+1` |
| Qua các run | **Tiếp tục tăng** (đọc `ref_counter` từ snapshot lần trước) |
| [n] trong câu trả lời | Phải nằm trong evidence hiện tại hoặc bảng bằng chứng đã biết |
| Sau nén | Tóm tắt giữ [n] và snippet; UI bong bóng cũ vẫn hiển thị citations lúc đó |

---

## 8. Kế hoạch kiểm thử (B)

| Tình huống | Kỳ vọng |
|------|------|
| Không có conversation_id | Hành vi như hiện tại (một vòng); hoặc auto-create và trả về trong done |
| Có conversation_id hỏi liên tiếp 2 vòng | Vòng 2 memory chứa user/assistant vòng 1 |
| Sau 15 vòng kích hoạt nén | Xuất hiện tin nhắn summary; assemble không còn chứa toàn bộ văn bản đầu |
| Giới hạn evidence | Quá max thì bỏ mục cũ nhất không được tham chiếu |
| Khóa scope | system của memory chứa document_id; tham số tool được tiêm |
| Cắt ký tự | assistant quá dài bị cắt và không làm hỏng JSON |

---

## 9. Danh sách triển khai theo giai đoạn

### B1 — Kết nối phiên (nhỏ, ưu tiên)

- [ ] Frontend: tạo/dùng lại `conversation_id` và gửi kèm ask
- [ ] Backend: done trả về `conversation_id`
- [ ] Rust: conversation hỗ trợ `document_id`/`job_id`/`skill_id` (nếu chưa có)
- [ ] Tài liệu + unit test: số lượng history được tiêm

### B2 — Nén Memory

- [ ] `memory/assemble.py` + `memory/compress.py`
- [ ] Đọc/ghi `metadata_json`
- [ ] SSE `compress`
- [ ] Ước lượng token và cấu hình budget
- [ ] Unit test: độ dài messages trước/sau nén

### B3 — Evidence qua các vòng

- [ ] Lưu snapshot / đưa lại «bảng bằng chứng đã biết»
- [ ] Lưu ref_counter

---

## 10. Cấu hình (gợi ý env)

| Biến | Mặc định | Giải thích |
|------|------|------|
| `RETAIN_AI_MEMORY_WINDOW_TURNS` | `6` | Số vòng gần đây giữ lại |
| `RETAIN_AI_MEMORY_MAX_CHARS` | `24000` | Giới hạn thô MemoryView |
| `RETAIN_AI_MEMORY_COMPRESS_AFTER_TURNS` | `12` | Quá số vòng này thì nén |
| `RETAIN_AI_MEMORY_MAX_EVIDENCE` | `24` | Số lượng bằng chứng |
| `RETAIN_AI_MEMORY_POLICY` | `extractive_v1` | Tên chiến lược nén |

---

## 11. Quyết định mở

| ID | Vấn đề | Đề xuất |
|----|------|------|
| M1 | Tự động tạo khi không có conversation_id? | **Có** (giảm trạng thái frontend), done phải trả về |
| M2 | Có hiển thị summary trong UI không? | Mặc định thu gọn một dòng «đã tóm tắt N vòng trước» |
| M3 | tool_trace có vào memory không? | **Không**; chỉ vào evidence và trace run này |
| M4 | Cho phép client gửi history không? | v1 **bỏ qua** history từ client, tránh phân nhánh |

---

## 12. Tiêu chí nghiệm thu (khi B hoàn thành)

1. Cùng một tác vụ đọc, hỏi liên tiếp 5 lần, lần thứ 5 có thể tham chiếu kết luận hoặc bằng chứng của lần 1.  
2. Kéo dài lịch sử lên 20 vòng, yêu cầu vẫn thành công; SSE xuất hiện ít nhất một lần `compress` hoặc có tin nhắn summary.  
3. Sau nén, các liên kết citations vẫn đúng (page_idx 0-based).  
4. Frontend cũ không gửi trường mới thì hành vi không bị lỗi 5xx.