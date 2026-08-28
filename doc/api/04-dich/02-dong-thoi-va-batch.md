# Đồng thời và lô

`workers` và `batch_size` trong yêu cầu dịch không đơn giản là "gửi đồng thời N yêu cầu, mỗi yêu cầu M mục". Backend sẽ điều phối dựa trên loại item, rủi ro và trạng thái provider.

## Trường yêu cầu

```json
{
  "translation": {
    "workers": 100,
    "batch_size": 1
  }
}
```

## Điều phối thực tế

Giai đoạn dịch sẽ phân loại các item chờ dịch thành:

- `batched_fast`: văn bản thông thường ít rủi ro, có thể gộp theo lô.
- `single_fast`: yêu cầu đơn mục thông thường.
- `single_slow`: mục công thức phức tạp, xử lý lại hoặc mục có rủi ro cao.

`workers` sẽ được phân bổ vào các hàng đợi này, thay vì trở thành một nhóm luồng đơn nhất.

## Tại sao đồng thời cao không nhất thiết tăng tốc tuyến tính

- Phía provider có adaptive concurrency, số lượng yêu cầu HTTP thực tế đang xử lý có thể thấp hơn `workers`.
- 429, 5xx, timeout sẽ kích hoạt thoái lui và thử lại.
- `single_slow` có giới hạn worker riêng, các mục phức tạp sẽ không chiếm hết tất cả worker.
- Áp dụng kết quả và flush một phần được xử lý tuần tự trong luồng chính.
- Tail retry có thể thêm công việc sau khi lô chính kết thúc.

## Trường chẩn đoán

Trong chẩn đoán dịch, cần chú ý:

- `configured_workers`
- `configured_batch_size`
- `effective_batch_size_translation`
- `translation_queue_split`
  - `batched_fast_batches`
  - `single_fast_batches`
  - `single_slow_batches`
  - `batched_fast_workers`
  - `single_fast_workers`
  - `single_slow_workers`
- `concurrency_observed.peak_inflight_translation_requests`
- `concurrency_observed.peak_inflight_all_llm_requests`
- `adaptive_concurrency.current_limit`
- `result_apply.apply_elapsed_ms`
- `result_apply.max_result_drain_batch`
- `result_flush.flush_elapsed_ms`
- `result_flush.max_flush_pages`
- `tail_retry.tail_retry_items`
- `tail_retry.tail_retry_elapsed_ms`
- `request_counts.timeout_attempts`

## Nguyên tắc Frontend

- Giao diện người dùng thông thường chỉ cần hiển thị `workers`.
- `batch_size` phù hợp hơn như tùy chọn nâng cao.
- Không cam kết trên UI rằng `workers=100` đồng nghĩa với 100 mục mỗi giây.
