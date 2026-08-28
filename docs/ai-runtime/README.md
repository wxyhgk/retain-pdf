# RetainPDF AI Runtime (Chỉ mục tài liệu thiết kế)

**Trạng thái:** Bản thảo thiết kế (Kiến trúc C + Session/Nén B)  
**Ngày:** 2026-07-21  
**Hiện trạng mã:** `backend/ai_service` là vòng lặp mỏng không trạng thái (`RetrievalAgent` + `ToolRegistry`)  
**Lối vào sản phẩm:** Hỏi đáp toàn sách trình đọc → Rust proxy `POST /api/v1/ai/ask` → retainpdf-ai `:41100`

---

## Tài liệu

| Tài liệu | Nội dung |
|------|------|
| **[AI_RUNTIME.md](./AI_RUNTIME.md)** | Kiến trúc mục tiêu: Transport / Session / Orchestrator / Runtime / Skills / Evidence |
| **[SESSION_AND_MEMORY.md](./SESSION_AND_MEMORY.md)** | Giao thức hội thoại đa luân, nén ngữ cảnh, API và hình dạng dữ liệu (bản thảo chi tiết B) |
| **[SKILLS.md](./SKILLS.md)** | Định dạng gói Skill, ranh giới với Tool, ví dụ `literature-qa` đầu tiên |

---

## Mục tiêu một câu

> **Dịch vụ AI chỉ làm điều phối; Rust quản dữ liệu và quyền; hình dạng tool đồng cấu với SDK chủ lưu; Skills / Memory / Multi-agent có thể cắm vào, không cần đập bỏ viết lại.**

---

## Quan hệ với hiện trạng

```
Hiện trạng (MVP)
  POST /v1/ask → RetrievalAgent vòng lặp trần → 4 tools → answer + citations

Mục tiêu (runtime mở rộng được)
  POST /v1/runs  → Orchestrator
                    ├─ Session/Memory (cửa sổ + tóm tắt + gói evidence)
                    ├─ Skill(s) (literature-qa / …)
                    ├─ Agent loop(s) (truy vấn / phân tích / critic tùy chọn)
                    └─ Evidence (điểm neo, hình, tham chiếu nhảy được)
```

Chiến lược di chuyển: Skill mặc định vẫn là hỏi đáp truy vấn toàn sách hôm nay; khả năng mới thêm dưới dạng skill/tool, **không khóa chặt** trước framework nặng như LangGraph/Crew.

---

## Thứ tự triển khai (khuyến nghị)

1. **Tài liệu đóng băng giao diện** ✅ (Bản thảo C + B)  
2. **Session xuyên suốt (B1)** ✅ auto-create + dính frontend + done hồi truyền  
3. **Nén Memory (B2)** ✅ Cửa sổ + tóm tắt extractive + SSE `compress`  
4. Bộ tải Skill + cổng thu `literature-qa`  
5. Orchestrator + agent thứ hai (tùy chọn)  

Mỗi bước đều có thể hợp nhất riêng, có thể rollback, không chặn `/v1/ask` hiện có.
