# Thiết kế Skills (dự thảo)

**Trạng thái:** dự thảo v0.1 (kết hợp với [AI_RUNTIME.md](./AI_RUNTIME.md))  
**Ngày:** 2026-07-21  

---

## 1. Skill vs Tool

| | Tool | Skill |
|--|------|--------|
| Mức độ chi tiết | I/O nguyên tử | Gói năng lực hướng nhiệm vụ |
| Nội dung | name + JSON Schema + handler | Tập hợp con công cụ + lời nhắc + chiến lược |
| Kiểm thử | Unit test handler | Kiểm thử kịch bản/hợp đồng |
| Ví dụ | `search_fulltext` | `literature-qa` |

Tóm gọn:

> **Tool là động từ; Skill là kịch bản.**

---

## 2. Định dạng gói

```text
retainpdf_ai/skills/literature_qa/
  skill.yaml      # danh sách
  prompt.md       # system (có thể tách system.md / developer.md)
  # tùy chọn policy.py — thêm khi chiến lược phức tạp
```

### skill.yaml

```yaml
id: literature-qa
version: 1
display_name: Hỏi đáp toàn bộ tài liệu
description: >
  Tìm kiếm và trả lời trong phạm vi một tài liệu (hoặc job chỉ định), bắt buộc trích dẫn neo.
tools:
  - search_fulltext
  - read_blocks
  - search_favorites
# list_documents cố tình không đưa vào skill của reader
policies:
  require_document_scope: true
  allow_global_search: false
  max_tool_rounds: 6
  output_locale: zh-CN
  require_citations: true
  allow_markdown_images: true
model:
  # có thể ghi đè; để trống thì dùng cấu hình yêu cầu/toàn cục
  temperature: 0.3
```

### prompt.md

- Chuyển nội dung chính của `SYSTEM_PROMPT` hiện có vào đây  
- Các placeholder (thay thế khi lắp ráp):

```text
{{document_id}}
{{job_id}}
{{evidence_table}}   # Bảng bằng chứng đã biết được Memory tiêm vào, có thể để trống
```

---

## 3. Giao diện loader

```python
class Skill(Protocol):
    id: str
    version: int
    tools: list[str]
    policies: dict
    def system_prompt(self, *, scope, evidence_table: str) -> str: ...

def load_skill(skill_id: str) -> Skill: ...
def list_skills() -> list[SkillMeta]: ...
```

Lỗi: `unknown skill` → 400.

---

## 4. Ra mắt đầu tiên: literature-qa

Hành vi tương ứng với phần hỏi đáp của reader hiện tại:

- scope bắt buộc document  
- Tầng tool tiêm document_id / job_id  
- Trích dẫn [n] + image_urls có thể nhúng  
- Không lộ list_documents  

Nghiệm thu: chất lượng trả lời ngang với hiện trạng; chỉ cấu hình/lời nhắc được ngoại hóa, không thoái lui chức năng.

---

## 5. Các Skill ứng viên tiếp theo

| id | Kịch bản | Công cụ có thể |
|----|------|----------|
| `annotation-assist` | Giải thích dựa trên chú thích/vùng chọn | read_blocks, search_favorites |
| `paper-compare` | So sánh hai tài liệu | search_fulltext×2, read_blocks |
| `figure-explain` | Chuyên giải thích hình/bảng | read_blocks, list_page_images (có thể thêm tool) |

---

## 6. Với Multi-agent

Skill có thể khai báo:

```yaml
agents:
  - role: retriever
    tools: [search_fulltext, read_blocks]
  - role: analyst
    tools: []    # chỉ ghi
```

v0 bỏ qua trường `agents`, thực hiện vòng lặp đơn với tất cả tools.  
Viết trường vào schema trước để tránh phải thay đổi định dạng gói sau này.

---

## 7. Thứ tự triển khai

1. Chuyển thư mục + loader + literature-qa vào (hành vi không đổi)  
2. Yêu cầu ask hỗ trợ `skill_id`  
3. Skill thứ hai để chứng minh khả năng mở rộng  
