# Vòng đời nhiệm vụ

## 1. Các workflow hiện được hỗ trợ

Rust API hiện hỗ trợ 4 loại workflow:

1. `book`
   Định danh đường dẫn chính đầy đủ hiện tại: OCR -> Normalize -> Translate -> Render
2. `ocr`
   Chỉ chạy OCR/Normalize, tạo ra `document.v1.json`
3. `translate`
   OCR -> Normalize -> Translate, dừng ở sản phẩm dịch, không vào render
4. `render`
   Tái sử dụng artifact của job có sẵn, chỉ chạy lại render

## 2. Đường dẫn chính

### 2.1 `book`

`book` ở đây là định danh workflow trong giao thức API hiện tại, biểu thị "đường dẫn chính đầy đủ".
Nó là enum ổn định, không yêu cầu frontend hoặc cổng vào local tiếp tục phơi bày tên provider cho người dùng.

1. Tải lên PDF
2. Tạo nhiệm vụ chính
3. Nhiệm vụ chính tạo nhiệm vụ con OCR bên trong
4. Provider OCR tải lên, kiểm tra, tải xuống kết quả
5. Chuẩn hóa thành `document.v1`
6. Dịch
7. Render
8. Xuất PDF / ZIP / các sản phẩm khác

### 2.2 `translate`

1. Tải lên PDF
2. Tạo nhiệm vụ dịch
3. Nhiệm vụ dịch tạo nhiệm vụ con OCR bên trong
4. Provider OCR tải lên, kiểm tra, tải xuống kết quả
5. Chuẩn hóa thành `document.v1`
6. Dịch
7. Xuất tải trọng dịch, `translation-manifest.json`, thông tin chẩn đoán

Bổ sung:

- Khi `translation.math_mode=placeholder`, giai đoạn dịch đi theo chuỗi bảo vệ công thức cũ
- Khi `translation.math_mode=direct_typst`, giai đoạn dịch đi theo nhánh "xuất trực tiếp công thức" thử nghiệm
- Cả hai không thay đổi giao diện nhiệm vụ và cổng vào render, chỉ ảnh hưởng đến chiến lược xử lý công thức trong giai đoạn dịch

### 2.3 `render`

1. Tạo nhiệm vụ render
2. Trong yêu cầu, thông qua `source.artifact_job_id` trỏ đến một job đã có
3. Backend tái sử dụng `source_pdf` và `translations_dir` từ job đó
4. Chỉ thực hiện render
5. Xuất PDF / Typst / sản phẩm render mới

## 3. Tại sao có nhiệm vụ con OCR

Các nhiệm vụ chính `book` và `translate` không làm mọi thứ cùng một lúc, mà tạo ra một nhiệm vụ con OCR, thường là:

`{job_id}-ocr`

Làm vậy có hai lợi ích:

- Có thể tách biệt vận chuyển OCR và đường dẫn dịch/render chính để quan sát
- Chẩn đoán provider OCR có thể được treo riêng trong chi tiết để trả về

## 4. Tên giai đoạn phổ biến

Tên giai đoạn thay đổi khi đường dẫn tiến triển, bao gồm:

- `queued`
- `ocr_submitting`
- `ocr_upload`
- `mineru_upload`
- `mineru_processing`
- `translation_prepare`
- `normalizing`
- `translating`
- `domain_inference`
- `page_policies`
- `rendering`
- `finished`
- `failed`

Bổ sung:

- `translate` thường dừng ở `translating -> finished`
- `render` thường đi thẳng vào `rendering`
- `ocr` không vào `translating` hoặc `rendering`

Không phải mọi nhiệm vụ đều trải qua các giai đoạn giống hệt nhau, nhưng ý tưởng chính là nhất quán.

## 5. Phía yêu cầu phân biệt như thế nào

Điều quan trọng nhất là hai việc:

1. `workflow`
   Quyết định đây là nhiệm vụ đầy đủ, OCR-only, Translate-only hay Render-only
2. `source`
   - `upload_id`: dùng cho `book` / `translate`
   - `artifact_job_id`: dùng cho `render`

Quy ước hiện tại:

- `workflow=translate` vẫn tạo nhiệm vụ con OCR, nhưng không vào render
- `workflow=render` không chạy OCR hay dịch nữa, mà tái sử dụng artifact của job có sẵn
- `workflow=ocr` sử dụng cổng vào độc lập `/api/v1/ocr/jobs`, không lẫn trong `/api/v1/jobs`
- Nội dung JSON yêu cầu `/api/v1/jobs` có cấu trúc nhóm `source / ocr / translation / render / runtime` là hợp đồng chính thức
- Các trường phẳng lịch sử chỉ được giữ lại trong một vài cổng vào phụ trợ multipart, không còn được quảng bá là hợp đồng JSON chính

## 6. Frontend hiểu giai đoạn như thế nào

Khuyến nghị phân biệt ba tầng:

- `status`: nhiệm vụ đã kết thúc chưa
- `stage`: đang ở giai đoạn nào
- `stage_detail`: mô tả giai đoạn hiện tại cho người

Ví dụ:

- `status = running`
- `stage = translating`
- `stage_detail = Đã hoàn thành lô dịch thứ 18/55`

Điều này cho thấy:

- Nhiệm vụ chưa kết thúc
- Giai đoạn hiện tại là dịch
- Tiến độ lô hiện tại đã đến 18/55

## 7. Khi nào nút tải xuống có thể nhấn

Frontend không tự xây dựng quy tắc, mà xem trực tiếp trong giao diện chi tiết:

- `actions.*.enabled`
- `artifacts.*.ready`

Ví dụ:

- Nút tải PDF xem `actions.download_pdf.enabled`
- Nút tải ZIP xem `actions.download_bundle.enabled`

Bổ sung:

- Nhiệm vụ `translate` thành công, thường chỉ có thư mục dịch và bundle ready, PDF chưa chắc ready
- Nhiệm vụ `render` thành công, PDF sẽ ready, nhưng không nhất thiết có vật phẩm tải xuống liên quan đến OCR

## 8. Khi thất bại nên xem gì

Nhiệm vụ thất bại ưu tiên xem:

- `failure.category`
- `failure.summary`
- `failure.root_cause`
- `failure.retryable`
- `failure.suggestion`

Nếu chưa đủ, xem thêm:

- `runtime.final_failure_category`
- `runtime.final_failure_summary`
- `log_tail`
- `/events`

## 9. Phân công trách nhiệm giữa dòng thời gian và luồng sự kiện

Sự phân công này rất quan trọng:

- `runtime.stage_history` trả lời "toàn bộ quá trình mỗi giai đoạn mất bao lâu"
- `/events` trả lời "những sự kiện cụ thể nào đã xảy ra trong quá trình"
- `failure` trả lời "lần thất bại này được phân loại là gì, có thể thử lại không, đề xuất xử lý thế nào"
- `failure_diagnostic` chỉ là chế độ xem đơn giản tương thích với frontend cũ

Cái trước phù hợp cho tổng quan, cái sau phù hợp cho gỡ lỗi.
