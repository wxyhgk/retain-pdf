# Hướng dẫn đóng góp frontend và desktop

## Ranh giới thư mục

- `frontend/`: Mã nguồn frontend tĩnh đang được sử dụng trong sản xuất, cũng là đầu vào cho bundle desktop.
- `frontend-react/`: Khu vực di chuyển sang React mới, hiện không trực tiếp thay thế `frontend/`.
- `desktop/`: Đóng gói Electron desktop.
- `desktop/app/frontend/**`: Bundle frontend thực tế desktop đọc, không nên là đầu vào chỉnh sửa chính.

## Khởi động cục bộ

```bash
cd frontend
python3 -m http.server 40001 --bind 0.0.0.0
```

Nếu cần khởi động riêng khu vực di chuyển React:

```bash
cd frontend-react
npm run dev
```

Cổng mặc định: `40002`. Đầu vào này vẫn là khu vực di chuyển, không trực tiếp thay thế `frontend/` sản xuất.

Các cổng mặc định:

- Web frontend: `40001`
- Rust API: `41000`
- API gửi multipart không đồng bộ: `42000`

Quy tắc cơ sở API frontend xem [Khởi động và cấu hình cục bộ](../api/local-dev.md).

## Đồng bộ desktop

Sau khi sửa `frontend/src/**`, `frontend/*.html`, `frontend/src/styles/**` hoặc các tài nguyên frontend khác sẽ vào bundle desktop, phải đồng bộ desktop:

```bash
npm --prefix desktop run verify-frontend-sync
```

Lệnh này sẽ xây dựng lại frontend tĩnh, đồng bộ vào bundle desktop và chạy smoke frontend desktop.

## Quy tắc sửa đổi

- Đừng chỉ sửa `desktop/app/frontend/**`, hãy sửa tệp nguồn `frontend/**` rồi đồng bộ.
- Logic UI ưu tiên đặt vào các module feature/controller/view hiện có, không nhét luồng mới vào một tệp đầu vào lớn.
- Khi thêm khả năng tải xuống, reader, thẻ trạng thái, bảng thuật ngữ, xác nhận bundle desktop cũng có thể vượt qua `npm --prefix desktop run verify-frontend-sync`.
- Khi frontend cần thêm trường API mới, trước tiên xác nhận backend có view/projection ổn định không, đừng để frontend đoán từ payload nội bộ, raw artifact hoặc trường cơ sở dữ liệu.
- Sửa đổi `frontend-react/` nên rõ ràng là khả năng khu vực di chuyển, trừ khi mục tiêu PR là chuyển đổi đầu vào sản xuất.

## Kiểm tra thường dùng

```bash
npm --prefix frontend run build
npm --prefix desktop run verify-frontend-sync
```

Smoke trạng thái end-to-end frontend sẽ thực sự gửi tác vụ, thường cần Rust API cục bộ, token OCR, key model và PDF mẫu; chạy khi có đủ điều kiện:

```bash
cd frontend
npm run smoke:status -- --file ../data/temPDF/test1.pdf
```
