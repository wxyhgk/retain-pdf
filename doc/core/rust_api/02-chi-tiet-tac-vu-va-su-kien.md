# Chi tiết tác vụ và sự kiện

Bài này nói về cách đọc quá trình thực thi tác vụ.

## Giao diện chính

Chi tiết tác vụ:

- `GET /api/v1/jobs/{job_id}`

Luồng sự kiện:

- `GET /api/v1/jobs/{job_id}/events`
- `GET /api/v1/ocr/jobs/{job_id}/events`

Chẩn đoán thất bại và khôi phục:

- `GET /api/v1/jobs/{job_id}/diagnostics`
- `GET /api/v1/jobs/{job_id}/resume-plan`
- `POST /api/v1/jobs/{job_id}/resume`

## Cần xem gì trong chi tiết tác vụ

Các trường quan trọng:

- `status`
- `display_stage`
- `stage`
- `substage`
- `lane`
- `stage_detail`
- `progress`
- `stage_snapshot`
- `background_snapshots`
- `stages`
- `runtime`
- `failure`
- `failure_diagnostic`
- `timestamps`
- `actions`
- `artifacts`
- `ocr_job`
- `invocation`
- `normalization_summary`
- `glossary_summary`
- `log_tail`

Cách dùng khuyến nghị cho frontend:

- Trạng thái chính hiện tại chỉ xem `stage_snapshot`
- Trạng thái bảng giai đoạn xem `stages`
- Luồng sự kiện chỉ dùng cho lịch sử, dòng thời gian và gỡ lỗi
- Mô tả giai đoạn hiện tại xem `stage_detail`
- `stage` là giai đoạn máy nội bộ của backend, không dùng làm căn cứ xác định giai đoạn lớn trên frontend
- Giai đoạn thực của tác vụ hiện tại xem `runtime.current_stage`
- Tổng thời gian xem `runtime.total_elapsed_ms`
- Thời gian giai đoạn hiện tại xem `runtime.active_stage_elapsed_ms`
- Dòng thời gian quá trình xem `runtime.stage_history`

## Nguồn thật của dòng thời gian

`runtime.stage_history` là nguồn thật của dòng thời gian chính, không suy luận từ `/events`.

Mỗi mục thường bao gồm:

- `stage`
- `detail`
- `enter_at`
- `exit_at`
- `duration_ms`
- `terminal_status`

## Cách đọc luồng sự kiện

Luồng sự kiện phù hợp cho thẻ trạng thái, hiển thị tiến độ và gỡ lỗi, không phải dòng thời gian chính. Dòng thời gian chính vẫn xem `runtime.stage_history`.

`GET /api/v1/jobs/{job_id}/events` trả về sự kiện công khai đã được chuẩn hóa bởi Rust, không phải sự kiện gốc Python. Trong sự kiện công khai:

- `display_stage` là giai đoạn người dùng trong ảnh chụp/sự kiện, chỉ có thể là `ocr | translation | render | null`, không bao giờ là `done`.
- `stage` là giai đoạn máy nội bộ của backend, ví dụ `ocr_processing`, `translating`, `rendering`.
- `substage` là giai đoạn con đọc được bằng máy, ví dụ `translation_batches`, `render_prewarm`.
- `lane` phân biệt tiến độ chính và sự kiện nền/sản phẩm/chẩn đoán.
- `event_type` là loại sự kiện đã chuẩn hóa, ví dụ `progress`, `artifact`, `terminal`, `error`, `diagnostic`.
- `message` / `stage_detail` chỉ dành cho con người, frontend không dùng để xác định giai đoạn.
- `stage` / `user_stage` / `event_type` gốc Python sẽ được lưu trong `payload.raw_stage`, `payload.raw_user_stage`, `payload.raw_event_type`, dùng khi gỡ lỗi.

Các trường ổn định của mục sự kiện:

- `seq`
- `ts`
- `created_at`
- `level`
- `lane`
- `display_stage`
- `stage`
- `substage`
- `stage_detail`
- `event`
- `event_type`
- `raw_event_type`
- `progress`
- `message`
- `provider`
- `provider_stage`
- `payload`

`progress` là đối tượng tiến độ công khai:

```json
{
  "unit": "page",
  "current": 37,
  "total": 142,
  "percent": 26.056338028169012
}
```

Frontend nên ưu tiên tiêu thụ:

- `display_stage`
- `lane`
- `substage`
- `stage_detail`
- `event_type`
- `progress.unit`
- `progress.current`
- `progress.total`
- `progress.percent`

Không ưu tiên tiêu thụ các trường nội bộ/tương thích này:

- `payload.raw_stage`
- `payload.raw_user_stage`
- `payload.raw_event_type`
- `message`
- `provider_stage`

`lane` dùng để phân biệt tiến độ chính và sự kiện nền:

- `main`: có thể hiển thị trên thẻ trạng thái chính.
- `background`: làm nóng nền, chuẩn bị nền, v.v., không được ghi đè giai đoạn chính.
- `artifact`: phát hành sản phẩm.
- `diagnostic`: thông tin hỗ trợ chẩn đoán hoặc lỗi.

Các giai đoạn con ổn định hiện tại:

| Giai đoạn công khai | Giai đoạn con | Đơn vị tiến độ | Giải thích |
| --- | --- | --- | --- |
| `ocr` | `ocr_processing` | `page` | Tiến độ phân tích trang OCR; nếu provider chỉ trả về trạng thái hoàn thành, ít nhất cung cấp tổng số trang. |
| `ocr` | `normalizing` | `step` | Chuẩn hóa kết quả OCR. |
| `translation` | `translation_prepare` | `step` | Chuẩn bị dịch. |
| `translation` | `domain_inference` | `step` | Nhận diện lĩnh vực tài liệu. |
| `translation` | `page_policies` | `page` | Chính sách trang và phân loại khối. |
| `translation` | `continuation_review` | `page` | Rà soát đoạn tiếp nối xuyên cột/trang. |
| `translation` | `translation_batches` | `batch` | Lô dịch chính. |
| `translation` | `translation_tail_retry` | `batch` | Hàng đợi thử lại cuối. |
| `translation` | `garbled_repair` | `page` | Sửa lỗi mã hóa. |
| `translation` | `agent_repair` | `page` | Sửa kết quả dịch. |
| `translation` | `final_untranslated_recovery` | `page` | Thu hồi phần chưa dịch cuối cùng. |
| `render` | `render_prepare` | `step` | Chuẩn bị kết xuất. |
| `render` | `render_prewarm` | `step` | Làm nóng kết xuất; thường là `lane=background`. |
| `render` | `render_pages` | `page` | Xây dựng trang, làm sạch, phủ, tạo nguồn Typst. |
| `render` | `render_compile` | `step` | Biên dịch Typst, lưu PDF và các bước không thể tách theo trang. |

Quy tắc tiến độ:

- Với cùng `stage + substage + progress.unit`, `progress.current` không được giảm.
- Tiến độ step như `render_compile` không hiển thị thành “tổng N trang”.
- `render_prewarm` thuộc lane nền, không được ghi đè tiến độ chính của `render_pages`.
- Sự kiện trạng thái hoàn thành nên cố gắng mang `current=total` cuối cùng để tiện khôi phục trạng thái sau làm mới.

## Vòng đời

Các workflow phổ biến:

- `book`
- `ocr`
- `translate`
- `render`

Các giai đoạn chính phổ biến:

- `queued`
- `ocr_submitting`
- `ocr_processing`
- `normalizing`
- `translation_prepare`
- `translating`
- `render_prepare`
- `render_preprocess`
- `rendering`
- `saving`
- `finished`
- `failed`

## Giao thức thất bại

Khi thất bại, ưu tiên xem:

- `failure.summary`
- `failure.category`
- `failure.root_cause`
- `failure.retryable`
- `failure.suggestion`

Các trường tương thích:

- `failure_diagnostic`
- `log_tail`

Nếu frontend chỉ cần thông tin thất bại sạch cho trang chi tiết tác vụ, ưu tiên đọc:

`GET /api/v1/jobs/{job_id}/diagnostics`

Các trường trả về:

- `failed_stage`
- `failed_substage`
- `summary`
- `detail`
- `suggestion`
- `retryable`
- `resume_available`

Giao diện này tái sử dụng các trường chính thức của `failure` và khi cần sẽ quay về bộ phân loại backend, không yêu cầu frontend tự phân tích `request_payload`, `events` hay `log_tail`.

## Khôi phục điểm dừng

Kế hoạch khôi phục:

`GET /api/v1/jobs/{job_id}/resume-plan`

Các trường trả về:

- `can_resume`
- `job_id`
- `from_stage`
- `resume_workflow`
- `reuses_artifacts`
- `reruns_stages`
- `reason`

Quy tắc hiện tại:

- Có `translations_dir + source_pdf`: `from_stage=render`, `resume_workflow=render`, chỉ chạy lại kết xuất.
- Có `normalized_document_json + source_pdf`: `from_stage=translate`, `resume_workflow=book`, chạy lại dịch và kết xuất.
- Không có hai loại checkpoint nào: `can_resume=false`, `reason` đưa ra lý do.

Thực thi khôi phục:

`POST /api/v1/jobs/{job_id}/resume`

Triển khai hiện tại tái sử dụng hợp đồng thực thi của `/rerun`:

- Khi có thể kết xuất lại tại chỗ, giữ nguyên `job_id`, xóa sản phẩm kết xuất cũ, xếp hàng workflow `render`.
- Chỉ có checkpoint OCR, tạo tác vụ khôi phục `book` mới.
- Nếu tác vụ vẫn ở `queued` / `running`, trả về xung đột trạng thái, cần hủy trước.

## Kết luận chính

- Giao diện chính của trang chi tiết là `GET /api/v1/jobs/{job_id}`
- Dòng thời gian xem `runtime.stage_history`
- Luồng sự kiện xem `GET /api/v1/jobs/{job_id}/events`
- Nguồn thật thất bại xem `failure`
- Thông tin thất bại ngắn gọn xem `GET /api/v1/jobs/{job_id}/diagnostics`
- Trạng thái nút khôi phục xem `GET /api/v1/jobs/{job_id}/resume-plan`
