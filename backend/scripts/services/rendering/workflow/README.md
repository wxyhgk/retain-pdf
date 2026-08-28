# rendering/workflow

## Trách nhiệm

Tầng điều phối luồng render. Chịu trách nhiệm tổ chức tác vụ render, chọn chế độ render, chuẩn bị ngữ cảnh và điều độ module cụ thể.

## Lối vào công khai

- `executor.py`
- `direct_overlay.py`
- `modes.py`
- `context.py`

## Không nên làm gì

- Không cài đặt thuật toán redaction cụ thể.
- Không cài đặt chi tiết template mã nguồn Typst.
- Không cài đặt thuật toán thích ứng font bbox.
