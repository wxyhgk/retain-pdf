# Thí nghiệm thích ứng `content_list_v2` MinerU

Tuyến thí nghiệm này chuyển `content_list_v2.json` của MinerU thành một JSON trung gian chuẩn hơn,
thuận tiện cho nghiên cứu dịch và render sau này.

Nó cố tình tách biệt với chuỗi chính ổn định, không trực tiếp làm lối vào mặc định.

Khuyến nghị hiện tại:

- Chuỗi chính ưu tiên dùng `ocr/normalized/document.v1.json`
- `ocr/unpacked/layout.json` chỉ giữ cho adapter, gỡ lỗi và truy ngược
- `content_list_v2.json` chỉ dùng cho thí nghiệm cấu trúc văn bản/công thức hạt mịn hơn

## Đầu vào

- `output/<job-id>/ocr/unpacked/content_list_v2.json`

## Đầu ra

Đầu ra là một JSON đã chuẩn hóa, chủ yếu bao gồm:

- Danh sách trang
- Cấu trúc khối đã chuẩn hóa
- Khối có văn bản đã làm phẳng kèm `segments`
- Khối phi văn bản giữ nguyên payload MinerU gốc

## Cách chạy

```bash
python scripts/devtools/experiments/mineru_content_v2/adapt_content_list_v2.py \
  --input output/<job-id>/ocr/unpacked/content_list_v2.json \
  --output output/<job-id>/ocr/mineru_content_v2_adapted.json
```

## Phạm vi phủ sóng hiện tại

- Hỗ trợ `title`, `paragraph`, `list`, `page_header`, `page_footer`, `page_number`
- `image`, `table`, `equation_interline` sẽ giữ lại làm khối không dịch được
- List item của MinerU sẽ triển khai thành khối chuẩn hóa độc lập

## Hạn chế đã biết

- Chưa làm tái tạo hình học từng dòng
- List item tái sử dụng bbox của list cha, vì đầu vào MinerU không có bbox từng item
- Hiện không khuyến nghị làm tuyến kết nối MinerU mặc định
