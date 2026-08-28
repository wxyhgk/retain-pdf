# rendering/source/preparation

## Trách nhiệm

Tầng tiền xử lý PDF trước khi render. Hiện chỉ giữ khả năng tiền xử lý PDF chung, ví dụ bóc tách tầng văn bản ẩn,
dán lại redaction công thức và dọn dẹp XObject.

bbox text strip đã chuyển sang `services.rendering.source_cleanup`. Không thêm lại logic lập kế hoạch bbox strip,
phán đoán trùng khớp hay viết lại content stream trong thư mục này.

## Lối vào công khai

- `hidden_text_strip.py`
- `redact_restore_formula.py`
- `xobject_sanitize.py`

## Ranh giới với source_cleanup

- `source_cleanup/planning` chịu trách nhiệm tạo ứng viên xóa và vùng bảo vệ từ translated items.
- `source_cleanup/pdf` chịu trách nhiệm xóa pikepdf content stream và đệ quy Form XObject.
- `source_cleanup/executor.py` là lối vào để luồng render gọi source cleanup.
- Nếu thư mục này cần gọi bbox strip, chỉ được đi qua lối vào gói `source_cleanup`, không trực tiếp
  import module planning/pdf nội bộ của nó.

## Không nên làm gì

- Không thực hiện redaction cuối cùng.
- Không sinh Typst.
- Không sửa đổi payload dịch.
- Không thêm quy tắc bbox text strip mới; quy tắc nên vào `services.rendering.policy` hoặc
  tầng tương ứng trong `services.rendering.source_cleanup` trước.
