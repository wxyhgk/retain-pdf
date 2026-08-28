# Khóa bí mật cục bộ

Thư mục này chỉ chứa tệp khóa bí mật dùng khi phát triển trên máy nội bộ.

Quy ước hiện tại:

- `mineru.env`
  Ghi `MINERU_API_TOKEN=...` vào tệp

Ghi chú:

- Tệp `*.env` thực tế trong thư mục đã được Git bỏ qua
- Chỉ dùng cho phát triển cục bộ, không dùng để phân phối ra ngoài
- Nếu dòng lệnh truyền `--token`, vẫn ưu tiên tham số dòng lệnh
