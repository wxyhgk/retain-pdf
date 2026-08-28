# Xử lý lỗi

Để biết chi tiết tác vụ, luồng sự kiện, giao thức thất bại và dòng thời gian giai đoạn, vui lòng xem [Giải thích Rust API](../rust_api/README.md).

## Ưu tiên xem gì

Khi tác vụ thất bại, hãy xử lý theo thứ tự này:

1. `GET /api/v1/jobs/{job_id}`
2. `failure`
3. `failure_diagnostic`
4. `log_tail`
5. `GET /api/v1/jobs/{job_id}/events`
6. `runtime.stage_history`

`failure` là nguồn thất bại có cấu trúc thực sự; `failure_diagnostic` là chế độ xem tương thích dành cho frontend cũ và hiển thị đơn giản.

## Lệnh thường dùng

```bash
curl http://127.0.0.1:41000/health

curl -H "X-API-Key: your-key" \
  http://127.0.0.1:41000/api/v1/jobs/{job_id}

curl -H "X-API-Key: your-key" \
  "http://127.0.0.1:41000/api/v1/jobs/{job_id}/events?limit=200"

curl -H "X-API-Key: your-key" \
  http://127.0.0.1:41000/api/v1/jobs/{job_id}/artifacts-manifest
```

## Thư mục tác vụ

Tập trung xem:

- `DATA_ROOT/jobs/{job_id}/logs/pipeline_events.jsonl`
- `DATA_ROOT/jobs/{job_id}/ocr/`
- `DATA_ROOT/jobs/{job_id}/translated/`
- `DATA_ROOT/jobs/{job_id}/rendered/`
- `DATA_ROOT/jobs/{job_id}/artifacts/`

Tác vụ cũ có thể sử dụng `logs/events.jsonl`.

## Nút tải xuống không khả dụng

Đừng chỉ xem `status`. Hãy kiểm tra:

- `actions.download_pdf.enabled`
- `actions.open_markdown.enabled`
- `actions.open_markdown_raw.enabled`
- `actions.download_bundle.enabled`
- `artifacts.pdf.ready`
- `artifacts.markdown.ready`
- `artifacts.bundle.ready`
- `artifacts-manifest.items[].ready`

Nếu `ready=false` hoặc `enabled=false`, đừng tự nối link tải xuống để truy cập cưỡng bức.

## Lỗi Provider

Nguyên nhân thường gặp:

- `mineru_token`, `paddle_token`, `api_key` thiếu hoặc không hợp lệ.
- PDF vượt quá giới hạn của Provider thượng nguồn.
- DNS máy chủ backend, proxy hoặc mạng bất thường.
- Giao diện thượng nguồn gián đoạn tạm thời.

Ưu tiên xem:

- `provider_trace_id`
- `failure.provider`
- `failure.root_cause`
- `failure.suggestion`
- `CAUSE[n]` trong `log_tail`

## Gỡ lỗi dịch thuật

Khi giai đoạn dịch bất thường, hãy xem:

- `GET /api/v1/jobs/{job_id}/translation/diagnostics`
- `GET /api/v1/jobs/{job_id}/translation/items`
- `GET /api/v1/jobs/{job_id}/translation/items/{item_id}`
- `POST /api/v1/jobs/{job_id}/translation/items/{item_id}/replay`

Các giao diện này dành cho phát triển và khắc phục sự cố, không khuyến nghị là phụ thuộc luồng chính cho người dùng thông thường.

## Mã lỗi thường gặp

- `40000`: Lỗi yêu cầu, ví dụ thiếu trường, cấu trúc JSON không đúng hợp đồng.
- `40100`: Thiếu hoặc sai `X-API-Key`.
- `40400`: Tác vụ, artifact hoặc tài nguyên không tồn tại.
- `40900`: Xung đột trạng thái tác vụ.
- `50000`: Lỗi nội bộ backend.
