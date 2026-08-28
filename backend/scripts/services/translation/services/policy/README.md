# Mô tả Policy

`scripts/services/translation/policy/` là thư mục cài đặt chính thức của tầng chiến lược dịch.

Bao gồm:

- `config.py`
  Cấu hình chế độ, chiến lược bỏ qua, lối vào suy luận lĩnh vực.
- `flow.py`
  Lối vào luồng áp dụng chiến lược thực sự vào payload.
- `body_text_filter.py`
  Logic lọc nhiễu văn bản và khối hẹp.
- `metadata_filter.py`
  Logic lọc đoạn metadata như dòng tác giả, dòng bản quyền, thông tin biên tập.

## Nguyên tắc thiết kế

- Mã mới thống nhất import từ `services.translation.services.policy.*`.
- Tầng chiến lược chỉ xử lý phán đoán cấp payload, không trực tiếp chạm PDF hoặc render.
