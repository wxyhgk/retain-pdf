# Hướng dẫn đóng góp kiểm thử

Đóng góp kiểm thử quan trọng ngang với đóng góp mã. Chuyên gia kiểm thử không cần hiểu toàn bộ triển khai nội bộ trước, cũng có thể trực tiếp đóng góp công việc giá trị cao.

## Có thể đóng góp gì

- Mẫu PDF có thể công khai hoặc đã làm ẩn, cùng với hiện tượng mong đợi, số trang, bbox, ảnh chụp màn hình và job_id tương ứng.
- Các trường hợp hồi quy cho chuẩn hóa OCR, dịch thuật, bảo vệ công thức, kết xuất, tải xuống, reader, library, resume.
- Điểm chuẩn hiệu suất mẫu lớn, ví dụ thời gian giai đoạn, mức sử dụng bộ nhớ và kích thước đầu ra cho PDF 100 trang, 500 trang, 1000 trang.
- Danh sách kiểm thử end-to-end, ví dụ khởi động desktop lần đầu, nâng cấp Docker, thử lại khi mất mạng, lỗi token, hủy tác vụ, kết xuất lại, xóa hàng loạt.
- Báo cáo kiểm thử thủ công, bao gồm môi trường, phiên bản, các bước tái hiện, kết quả mong đợi, kết quả thực tế và tệp đính kèm.
- Script kiểm thử tự động hoặc fixture, nhưng phải đảm bảo không chứa token riêng tư, tệp người dùng thực hoặc nội dung không công khai.

## Định dạng đề xuất cho Issue kiểm thử

```md
## Môi trường

- Phiên bản RetainPDF:
- Cách chạy: desktop / Docker / phát triển cục bộ
- Hệ điều hành và trình duyệt:
- OCR provider:
- Model provider:

## Mẫu

- Có thể công khai không:
- Số trang:
- Số trang / bbox liên quan:
- job_id:

## Các bước

1. ...
2. ...

## Kết quả mong đợi

...

## Kết quả thực tế

...

## Tệp đính kèm

- Ảnh chụp màn hình / PDF đã làm ẩn / nhật ký / đoạn luồng sự kiện
```

## Đề xuất PR kiểm thử

- Fixture càng nhỏ càng tốt, nếu có thể tái hiện bằng 1-3 trang thì không gửi cả cuốn sách.
- Tệp lớn, PDF hàng loạt, đầu ra benchmark mặc định đặt trong `experiments/` hoặc liên kết ngoài; chỉ những mẫu nhỏ rõ ràng cần vào kiểm thử tự động mới commit vào kho lưu trữ.
- Khi thêm kiểm thử mới, nêu rõ nó bảo vệ lỗi, module hoặc luồng người dùng nào.
- Đối với kiểm thử hiệu suất, viết rõ môi trường máy, số trang mẫu, lệnh, thời gian cũ, thời gian mới và phạm vi dao động cho phép.
- Đối với vấn đề hình ảnh/kết xuất, cố gắng đính kèm số trang, bbox, ảnh chụp màn hình và hành vi mong đợi; chỉ nói "trông không đúng" rất khó tạo kiểm thử hồi quy.

## Đầu vào kiểm thử thường dùng

Rust API:

```bash
cargo test --manifest-path backend/rust_api/Cargo.toml
```

Python:

```bash
PYTHONPATH=backend/scripts python3 -m pytest backend/scripts/devtools/tests/translation -q
PYTHONPATH=backend/scripts python3 -m pytest backend/scripts/devtools/tests/document_schema -q
PYTHONPATH=backend/scripts python3 -m pytest backend/scripts/devtools/tests/rendering -q
python3 backend/scripts/devtools/check_pipeline_architecture.py
```

Frontend và desktop:

```bash
npm --prefix frontend test
npm --prefix frontend run build
npm --prefix desktop run verify-frontend-sync
```

`npm --prefix frontend test` sử dụng Node test runner gốc, ưu tiên bao phủ kiểm thử hồi quy thuần túy như tiến độ tác vụ, định dạng trạng thái, không phụ thuộc vào trình duyệt hoặc dịch vụ backend.

Smoke trạng thái end-to-end frontend sẽ thực sự gửi tác vụ, thường cần Rust API cục bộ, token OCR, key model và PDF mẫu; chạy khi có đủ điều kiện:

```bash
cd frontend
npm run smoke:status -- --file ../data/temPDF/test1.pdf
```
