# Quy trình dịch thuật

## Quy trình book

Chuỗi chính của `workflow=book`:

```text
OCR con -> normalize -> dịch -> kết xuất
```

Rust sẽ chuẩn bị kết quả OCR trước, sau đó khởi động giai đoạn dịch. Sau khi dịch thành công sẽ tiếp tục kết xuất.

## Quy trình dịch

Chuỗi chính của `workflow=translate`:

```text
OCR con -> normalize -> dịch
```

Sau khi dịch xong, tác vụ kết thúc và không tạo PDF cuối cùng.

## Tái sử dụng sản phẩm OCR hiện có

Nếu yêu cầu có `source.artifact_job_id`, backend có thể tái sử dụng các sản phẩm OCR hiện có, chuẩn bị trực tiếp đầu vào dịch mà không cần OCR lại.

## Đầu vào giai đoạn dịch

- `source_json`: `document.v1.json` đã chuẩn hóa
- `source_pdf`: PDF nguồn
- `layout_json`: JSON bố cục/kết quả của provider, có thể dùng cho chẩn đoán hoặc thông tin bổ sung

## Đầu ra giai đoạn dịch

- Bản kê dịch
- Payload dịch theo trang
- Chẩn đoán
- Chỉ mục gỡ lỗi
- Sản phẩm đánh giá

Giai đoạn kết xuất chỉ nên tiêu thụ sản phẩm dịch và PDF nguồn, không nên quay lại đọc các trường riêng của OCR provider.
