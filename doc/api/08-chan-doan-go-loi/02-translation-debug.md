# API Gỡ lỗi Dịch thuật

Các giao diện này được sử dụng để khắc phục sự cố thiếu bản dịch, đầu ra lỗi, bất thường mô hình và phát lại.

## Chẩn đoán

```http
GET /api/v1/jobs/{job_id}/translation/diagnostics
```

Đọc `artifacts/translation_diagnostics.json`, trả về thống kê chạy dịch, thống kê provider, thống kê thử lại và các thông tin khác.

## Danh sách Item

```http
GET /api/v1/jobs/{job_id}/translation/items
```

Các tham số truy vấn thường dùng:

- `page`
- `final_status`
- `error_type`
- `route`
- `q`
- `limit`
- `offset`

Ưu tiên đọc `translation_debug_index.json`; nếu thiếu có thể xây dựng lại chỉ mục từ translation manifest.

## Item đơn

```http
GET /api/v1/jobs/{job_id}/translation/items/{item_id}
```

Truy xuất item gốc từ page payload mà translation manifest trỏ đến.

## Phát lại

```http
POST /api/v1/jobs/{job_id}/translation/items/{item_id}/replay
```

Phát lại là một lần gọi gỡ lỗi tức thời:

- Không tạo job mới.
- Không vào hàng đợi.
- Không sửa đổi trạng thái tác vụ gốc.
- Backend gọi đồng bộ `backend/scripts/devtools/replay_translation_item.py`.
- Có thể sử dụng API key dịch của job hiện tại.

## Quy tắc làm sạch

Trước khi trả về, debug/phát lại sẽ làm sạch các giá trị nhạy cảm trong yêu cầu job. Frontend không nên giả định có thể lấy được API key hoặc token provider gốc.
