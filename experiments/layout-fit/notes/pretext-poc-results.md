# Kết quả PoC Pretext

Ngày:

- 2026-04-07

Môi trường:

- Dịch vụ tĩnh cục bộ: `python3 -m http.server 4173`
- Trình duyệt: `chromium --headless --disable-gpu --no-sandbox`
- Cài đặt phụ thuộc: `npm install --registry=https://registry.npmmirror.com`

## Trang đã xác minh

- `html/index.html`
- `html/pretext.html`

Hai trang đều hỗ trợ tự động chạy qua tham số URL:

- `?autoload=1`
- `&sample=<sample_id>`
- `&autorun=1`

Ví dụ:

- `http://127.0.0.1:4173/html/index.html?autoload=1&sample=20260407033349-ffe2e4:p002-b0002&autorun=1`
- `http://127.0.0.1:4173/html/pretext.html?autoload=1&sample=20260407033349-ffe2e4:p002-b0002&autorun=1`

## Kết quả đối chiếu phía trình duyệt đầu tiên

Mẫu:

- `20260407033349-ffe2e4:p002-b0002`

Tham số đầu vào:

- Chiều rộng: `447.45pt`
- Kích thước chữ: `11.06pt`
- Chiều cao dòng: khoảng `6.64pt`
  Ở đây沿用 cách近似 hiện tại trong trang "nhân kích thước chữ với `max_leading_em` của Typst", chỉ làm đầu vào đối chiếu PoC vòng đầu.

Kết quả:

- DOM height: `53.16pt`
- Pretext height: `53.12pt`
- height diff: `0.04pt`
- DOM lineCount: `8`
- Pretext lineCount: `8`
- DOM maxLineWidth: `597pt`
- Pretext maxLineWidth: `442.03pt`

## Kết luận hiện tại

Có thể xác nhận ba điều trước:

1. `@chenglou/pretext` đã có thể cài đặt cục bộ trong thư mục thí nghiệm này và được trang trình duyệt import.
2. Trên cùng lô `fixtures`, chiều cao và số dòng cấp khối của DOM và `pretext` đã có thể tự động đối chiếu trực tiếp.
3. Ít nhất trên mẫu `p002-b0002`, chiều cao và số dòng của `pretext` và DOM rất gần nhau.

Đồng thời cũng lộ ra một vấn đề quan trọng:

- Việc đọc `maxLineWidth` của trang DOM hiện tại là `scrollWidth`, nó phản ánh chiều rộng cuộn của toàn bộ hộp khối, không nhất thiết là chiều rộng thực của "dòng văn bản rộng nhất".
- `maxLineWidth` của `pretext` là chiều rộng văn bản tính từng dòng, do đó hai bên hiện chưa cùng khẩu độ nghiêm ngặt.

Điều này có nghĩa bước tiếp theo nên ưu tiên thống nhất khẩu độ chỉ số "dòng rộng nhất", rồi mới tiếp tục mở rộng thêm mẫu.

## Khuyến nghị bước tiếp theo

- Đổi chỉ số chiều rộng của trang cơ sở DOM từ `scrollWidth` sang khẩu độ từng dòng, căn chỉnh với `pretext`.
- Dùng toàn bộ 5 mẫu hiện tại chạy một lượt đối chiếu DOM / `pretext`, ghi lại chênh lệch chiều cao, chênh lệch số dòng và chênh lệch dòng rộng nhất.
- Sau đó đưa vào đối chiếu Typst, phán đoán DOM hay `pretext` gần kết quả Typst hơn.
