# Hợp đồng API Thư viện

**HTTP bên ngoài** của Thư viện đã được hợp nhất vào điểm vào API thống nhất:

- [Điểm vào API tổng của backend RetainPDF](../../../doc/core/api/index.md)

**Phân lớp triển khai** (đơn thể mô-đun hóa, không phải vi dịch vụ):

```text
routes/library*.rs, collections.rs
  → services/library_api.rs
      → services/library/*
```

Xem hướng dẫn cộng tác:

- [RUST_API_ARCHITECTURE.md](../RUST_API_ARCHITECTURE.md) §2.2–2.3
- [RUST_API_DIRECTORY_MAP.md](../RUST_API_DIRECTORY_MAP.md)
- [BOUNDARIES.md](../BOUNDARIES.md)（Library Facade）

Giữ lại tệp này để tương thích với các liên kết cũ. Không duy trì mô tả trường giao diện thứ hai ở đây.
