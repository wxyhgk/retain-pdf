# Chi tiết tác vụ và dòng thời gian

## 1. Giao diện chính

Giao diện chính của trang chi tiết tác vụ là:

`GET /api/v1/jobs/{job_id}`

Hầu hết thông tin cốt lõi của trang chi tiết nên được lấy từ giao diện này:

- Trạng thái hiện tại
- Giai đoạn hiện tại
- Mô tả giai đoạn hiện tại
- Dòng thời gian runtime
- Nguyên nhân thất bại
- Trạng thái nút tải xuống
- Tóm tắt tác vụ con OCR
- Tóm tắt giao thức thực thi của tác vụ hiện tại
- Tóm tắt chuẩn hóa và tóm tắt bảng thuật ngữ

## 2. Các trường frontend nên quan tâm nhất

Các trường quan trọng nằm trong `data`:

- `request_payload`
- `status`
- `stage`
- `stage_detail`
- `runtime`
- `failure`
- `actions`
- `artifacts`
- `timestamps`
- `log_tail`
- `normalization_summary`
- `glossary_summary`
- `invocation`

Trong đó:

- `request_payload` là ảnh chụp nhanh tham số yêu cầu thực tế mà backend lưu cho tác vụ đó
- Khi gỡ lỗi, nếu cần xác nhận một tham số có thực sự vào backend hay không, ưu tiên xem ở đây
- Ví dụ: phạm vi trang OCR nên đọc: `data.request_payload.ocr.page_ranges`
- Chế độ dịch công thức nên đọc: `data.request_payload.translation.math_mode`
- `invocation` dùng để trả lời \"tác vụ này được chạy bằng đường dẫn cũ hay đường dẫn stage spec hiện tại\"
- `normalization_summary` dùng để trả lời \"kết quả chuẩn hóa có phải là `schema_version=1.1` hiện tại không, có xảy ra thu gọn giá trị mặc định không\"
- `glossary_summary` dùng để trả lời \"bảng thuật ngữ có được bật không, tình trạng khớp và không khớp ra sao\"

## 3. Cách xem giao thức thực thi của tác vụ mới

Tác vụ mới hiện tại nên thấy:

```json
{
  "invocation": {
    "stage": "provider",
    "input_protocol": "stage_spec",
    "stage_spec_schema_version": "provider.stage.v1"
  }
}
```

Nguyên tắc xác định khi gỡ lỗi:

- `input_protocol=stage_spec` nghĩa là tác vụ đang dùng worker spec-only hiện tại
- `stage_spec_schema_version` cho biết phiên bản spec giai đoạn cụ thể
- Nếu không có ở đây, không hẳn là giao diện bị hỏng, cũng có thể là tác vụ cũ không để lại phần tóm tắt này

## 4. Nguồn thật của dòng thời gian

\"Tổng quan -> Dòng thời gian quá trình\" phải lấy `runtime.stage_history` làm chuẩn.

Đừng dùng `/events` để suy ngược dòng thời gian chính. Lý do rất trực tiếp:

- `runtime.stage_history` đã là các đoạn giai đoạn được backend tổng hợp sẵn
- Mỗi đoạn có thời gian vào và ra
- Mỗi đoạn có thể gắn trực tiếp thông tin trạng thái cuối
- Frontend không cần hợp nhất, khử trùng, suy luận thêm

## 5. Các trường quan trọng trong `runtime`

Các trường quan trọng hiện tại:

- `current_stage`
- `stage_started_at`
- `last_stage_transition_at`
- `total_elapsed_ms`
- `active_stage_elapsed_ms`
- `retry_count`
- `last_retry_at`
- `terminal_reason`
- `final_failure_category`
- `final_failure_summary`
- `stage_history`

## 6. Cấu trúc cố định của `stage_history`

Mỗi mục là một đoạn thời gian giai đoạn:

```json
{
  "stage": "translating",
  "detail": "Đang dịch, lô 12/22",
  "enter_at": "2026-04-04T15:31:02Z",
  "exit_at": null,
  "duration_ms": null,
  "terminal_status": null
}
```

Ý nghĩa các trường:

- `stage`: Tên giai đoạn
- `detail`: Mô tả chính khi vào giai đoạn đó
- `enter_at`: Thời gian vào giai đoạn
- `exit_at`: Thời gian rời giai đoạn; giai đoạn đang hoạt động thường là null
- `duration_ms`: Chỉ ổn định khi giai đoạn đã hoàn thành; giai đoạn đang hoạt động thường là null
- `terminal_status`: Nếu giai đoạn đó là giai đoạn cuối trước khi kết thúc, có thể đánh dấu `succeeded / failed / canceled`

## 7. Cách đọc tác vụ đang chạy

Nếu tác vụ vẫn đang chạy:

- Giai đoạn đang hoạt động cũng xuất hiện trong `stage_history`
- Mục đó thường có `exit_at = null`
- Mục đó thường có `duration_ms = null`
- Thời gian thực tế của giai đoạn hiện tại nên đọc `runtime.active_stage_elapsed_ms`

Nghĩa là, frontend không nên tự tính bằng \"thời gian hiện tại - enter_at\" để hiển thị giá trị, trừ khi chỉ là bù khung cục bộ; nguồn thật của giao diện vẫn là `active_stage_elapsed_ms`.

## 8. Cách đọc tác vụ đã kết thúc

Nếu tác vụ đã kết thúc:

- `status` sẽ là `succeeded / failed / canceled`
- `runtime.terminal_reason` sẽ giải thích lý do trạng thái cuối
- `runtime.total_elapsed_ms` là tổng thời gian của toàn bộ đường ống
- Mục cuối cùng trong `runtime.stage_history` thường có `terminal_status`

## 9. Cách hiểu `normalization_summary`

`normalization_summary` trong chi tiết tác vụ hiện tại là tóm tắt nhẹ, không phải báo cáo đầy đủ.

Các trường quan trọng:

- `provider`
- `detected_provider`
- `schema`
- `schema_version`
- `document_defaults`
- `page_defaults`
- `block_defaults`
- `page_count`
- `block_count`

Cách dùng khuyến nghị cho frontend:

- Hiển thị trên trang chỉ đọc tóm tắt này
- Nếu thực sự cần kiểm tra chi tiết adapter/defaults/validation, hãy tải `artifacts.normalization_report`

Lưu ý:

- Mainline hiện tại chỉ chấp nhận `schema_version=1.1`
- `*_defaults` ở đây thể hiện số lượng giá trị mặc định được thu gọn, không còn gọi là `compat_*`

## 10. Tại sao tác vụ cũ có thể không có dòng thời gian

Đây là điểm dễ nhầm lẫn nhất gần đây.

Tác vụ cũ có thể xuất hiện:

```json
{
  "runtime": null
}
```

Điều này không có nghĩa:

- Frontend đọc sai
- Backend hiện tại bị hỏng
- Tác vụ hiện tại ghi thất bại

Nó chỉ có nghĩa:

- Khi tác vụ này được tạo và thực thi, backend chưa lưu dòng thời gian runtime vào cơ sở dữ liệu

Vì vậy, frontend nên coi các tác vụ này là \"dữ liệu lịch sử bị thiếu\".

## 11. \"Tác vụ cũ thiếu trường\" và \"tác vụ cũ bị từ chối\" không giống nhau

Đây là hai khái niệm dễ nhầm lẫn nhất khi gỡ lỗi gần đây:

- `runtime = null`
  - Đây là tác vụ cũ bị thiếu dữ liệu
  - Tác vụ vẫn có thể xem chi tiết, xem luồng sự kiện
- Giao diện chi tiết/tải xuống báo lỗi không hỗ trợ tác vụ cũ
  - Điều này có nghĩa tác vụ vẫn nằm trong bố cục thư mục cũ hoặc cách lưu artifact cũ
  - Backend hiện tại sẽ không tự động di chuyển tương thích, chỉ có thể chạy lại

## 12. Phạm vi đảm bảo

Phạm vi đảm bảo trong tài liệu hiện tại là:

- Tác vụ được tạo bởi backend mới
- Tác vụ được thực thi toàn bộ bởi cùng một backend mới

Chỉ trong phạm vi này, `runtime.stage_history` mới đảm bảo là toàn bộ quá trình đầy đủ, chứ không chỉ giữ lại giai đoạn cuối.

## 13. Thứ tự đọc phù hợp để frontend sử dụng trực tiếp

1. Đọc `status` trước
2. Đọc `runtime.current_stage`
3. Dòng thời gian đọc trực tiếp `runtime.stage_history`
4. Thời gian giai đoạn hiện tại đọc `runtime.active_stage_elapsed_ms`
5. Tổng thời gian đọc `runtime.total_elapsed_ms`
6. Tác vụ thất bại ưu tiên đọc `failure.summary` và `failure.category`
7. Giao thức thực thi đọc `invocation`
8. Tóm tắt chuẩn hóa đọc `normalization_summary`
9. Tóm tắt bảng thuật ngữ đọc `glossary_summary`

## 14. Cách hiểu `translation.math_mode`

Đường ống dịch hiện tại hỗ trợ hai giá trị:

- `placeholder`
  - Giá trị mặc định
  - Tiếp tục dùng chuỗi bảo vệ công thức / placeholder / khôi phục cũ
- `direct_typst`
  - Chế độ thử nghiệm
  - Không bảo vệ placeholder công thức, để mô hình xuất trực tiếp văn bản và toán học `$...$`

Frontend chỉ cần hiển thị hoặc truyền qua dưới dạng chuỗi, không cần tự suy luận.
