# Định dạng phản hồi

Ngoại trừ các endpoint tải xuống tệp, các phản hồi JSON từ backend sử dụng đối tượng được bao bọc.

## Phản hồi thành công

```json
{
  "code": 0,
  "message": "ok",
  "data": {}
}
```

Mô tả các trường:

- `code`: mã trạng thái nghiệp vụ. `0` có nghĩa là thành công.
- `message`: thông báo ngắn gọn dễ đọc cho con người.
- `data`: nội dung phản hồi cụ thể.

## Phản hồi lỗi

```json
{
  "code": 400,
  "message": "invalid request",
  "data": null
}
```

Phản hồi lỗi cũng có thể mang thông tin thất bại có cấu trúc; xem [Cấu trúc thất bại](../08-chan-doan-go-loi/01-cau-truc-that-bai.md).

## Phản hồi tệp

Các endpoint này trả về luồng tệp trực tiếp và không sử dụng bao bọc JSON:

- `GET /api/v1/jobs/{job_id}/pdf`
- `GET /api/v1/jobs/{job_id}/pdf/side-by-side`
- `GET /api/v1/jobs/{job_id}/cover`
- `GET /api/v1/jobs/{job_id}/thumbnail`
- `GET /api/v1/jobs/{job_id}/preview/pages/{page}`
- `GET /api/v1/jobs/{job_id}/markdown?raw=true`
- `GET /api/v1/jobs/{job_id}/markdown/images/{path}`
- `GET /api/v1/jobs/{job_id}/download`
- `GET /api/v1/jobs/{job_id}/artifacts/{artifact_key}` trả về luồng tệp khi sản phẩm là tệp

Khi tải xuống tệp trên frontend, dựa vào trạng thái HTTP và `Content-Type`; không phân tích chúng như JSON.
