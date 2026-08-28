# 05 Danh sách kiểm tra adapter

## Định nghĩa nhiệm vụ

Khi sắp xếp một người thích ứng Paddle OCR, đề xuất bàn giao trực tiếp như sau:

### Đầu vào

- JSON thô Paddle OCR
- Ít nhất một fixture tối thiểu
- Ít nhất một fixture tương đối đầy đủ

### Đầu ra

- Paddle adapter có thể đăng ký
- Đầu ra `document.v1`
- Tài liệu tương ứng
- Kiểm thử tương ứng

## Phạm vi tệp

Cho phép sửa:

- `doc/core/paddle_ocr_api/*`
- `backend/scripts/services/document_schema/provider_adapters/paddle/*`
- `backend/scripts/services/document_schema/adapters.py`
- `backend/scripts/services/document_schema/providers.py`
- `backend/scripts/devtools/tests/document_schema/fixtures/*`
- `backend/scripts/devtools/tests/document_schema/regression_check.py`

Không sửa:

- `backend/scripts/services/translation/*`
- `backend/scripts/services/rendering/*`
- `backend/scripts/runtime/pipeline/*`

Ngoại lệ:

- Chỉ khi hợp đồng chính thực sự cần thêm trường ổn định, mới cho phép đề xuất trước, sau đó sửa `document_schema`

## Thứ tự tích hợp

1. Xác nhận định dạng trả về gốc của Paddle
2. Sắp xếp các trường tầng trên cùng/cấp trang/cấp block
3. Xác định vị trí trường
4. Triển khai detector
5. Triển khai adapter
6. Triển khai ánh xạ `continuation_hint`
7. Bổ sung fixture
8. Chạy hồi quy
9. Cập nhật tài liệu

## Lệnh nghiệm thu

```bash
PYTHONPATH=backend/scripts python backend/scripts/devtools/tests/document_schema/regression_check.py
PYTHONPATH=backend/scripts python -m pytest backend/scripts/devtools/tests/document_schema -q
PYTHONPATH=backend/scripts python -m pytest backend/scripts/devtools/tests/translation -q
```

## Các mục cần kiểm tra

- Phát hiện provider có ổn định không
- `document.v1` có vượt qua kiểm tra schema không
- `source.provider` có được ghi đúng là `paddle` không
- `type/sub_type/tags/derived` có phù hợp với hợp đồng hiện tại không
- `metadata/source` có giữ lại trace cần thiết không
- `continuation_hint` có chỉ được ghi khi đáng tin cậy không
- Nhãn `skip_translation` có chỉ dành cho block cần bỏ qua không

## Mẫu mô tả bàn giao

Khi người thích ứng gửi, ít nhất nên nêu:

1. Hỗ trợ định dạng trả về API Paddle nào
2. Đã sử dụng fixture nào
3. Đã thêm hoặc sửa đổi ánh xạ trường nào
4. Những trường Paddle nào được cố tình không kết nối
5. Có ghi `continuation_hint` không
6. Lệnh kiểm thử và kết quả
