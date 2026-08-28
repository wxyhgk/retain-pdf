# Đóng gói phản hồi Rust API

## 1. Định dạng tầng trên cùng

Rust API hiện đang sử dụng thống nhất một bộ đóng gói phản hồi.

Phản hồi thành công:

```json
{
  "code": 0,
  "message": "ok",
  "data": {}
}
```

Phản hồi thất bại:

```json
{
  "code": 400,
  "message": "Thông tin lỗi cụ thể"
}
```

Quy tắc đọc rất đơn giản:

- `code = 0` biểu thị thành công
- `message` dành cho người xem
- Dữ liệu nghiệp vụ luôn nằm trong `data`

## 2. Điểm dễ mắc lỗi nhất

Nhiều trang trống, danh sách trống, trường "backend có trả về nhưng frontend không hiển thị" cuối cùng đều không phải do giao diện không trả về, mà là do đường dẫn đọc sai.

Lỗi điển hình:

```json
{
  "items": [...]
}
```

Đây không phải là cấu trúc Rust API hiện tại.

Cấu trúc thực tế là:

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "items": [...]
  }
}
```

Nghĩa là:

- Không đọc `response.items`
- Cũng không đọc `response.data.items` nếu HTTP client của bạn có một lớp đối tượng bên ngoài cùng
- Cuối cùng phải đọc `data` trong phần thân phản hồi của API

## 3. Ví dụ cụ thể về giao diện luồng sự kiện

`GET /api/v1/jobs/{job_id}/events?limit=50&offset=0`

Cấu trúc trả về thực tế là:

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "items": [
      {
        "job_id": "20260404150516-75857c",
        "seq": 1,
        "ts": "2026-04-04T15:05:16Z",
        "level": "info",
        "stage": "queued",
        "event": "job_created",
        "message": "Nhiệm vụ đã được tạo",
        "payload": {
          "stage": "queued",
          "status": "queued",
          "workflow": "book"
        }
      }
    ],
    "limit": 50,
    "offset": 0
  }
}
```

Điểm mấu chốt ở đây là:

- Mảng sự kiện nằm trong `data.items`
- `limit` nằm trong `data.limit`
- `offset` nằm trong `data.offset`

## 4. Thứ tự giải gói khuyến nghị cho frontend

Cho dù là chi tiết nhiệm vụ, danh sách hay luồng sự kiện, đều khuyến nghị xử lý theo thứ tự này:

1. Kiểm tra mã trạng thái HTTP
2. Kiểm tra `code` trong phần thân phản hồi
3. Khi `code === 0`, đọc `data`
4. Không bao giờ giả định trực tiếp rằng trường nghiệp vụ ở tầng trên cùng

## 5. Logic phán đoán phù hợp để viết trực tiếp vào frontend

- Nếu HTTP không phải `2xx`, xử lý theo lỗi mạng hoặc dịch vụ
- Nếu HTTP là `2xx` nhưng `code !== 0`, xử lý theo lỗi nghiệp vụ
- Nếu `code === 0` và `data == null`, xử lý theo "thành công nhưng không có tải trọng nghiệp vụ"
- Nếu trường nằm trong `data.xxx`, thì đừng tìm ở tầng trên cùng
