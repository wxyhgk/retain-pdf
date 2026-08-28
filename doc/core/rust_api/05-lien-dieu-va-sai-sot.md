# Gỡ lỗi và khắc phục sự cố

## 1. Ba loại ngộ nhận phổ biến nhất

### 1.1 Backend không trả về, hay frontend đọc sai

Hãy dùng curl để xem phản hồi gốc trước, đừng đoán.

Ví dụ:

```bash
curl -s http://127.0.0.1:41000/api/v1/jobs/<job_id> \
  -H 'X-API-Key: your-key'
```

Và:

```bash
curl -s 'http://127.0.0.1:41000/api/v1/jobs/<job_id>/events?limit=50&offset=0' \
  -H 'X-API-Key: your-key'
```

Nếu phản hồi gốc có dữ liệu mà trang không hiển thị, hãy kiểm tra đường dẫn giải mã của frontend trước.

### 1.2 "Backend không trả về runtime.stage_history"

Câu nói này có hai trường hợp hoàn toàn khác nhau:

Trường hợp thứ nhất, tác vụ hiện tại là tác vụ cũ:

- `runtime = null`
- Có nghĩa là lúc đó backend chưa lưu thời gian runtime

Trường hợp thứ hai, tác vụ hiện tại là tác vụ mới nhưng backend thực sự không ghi:

- Đây mới là lỗi cần kiểm tra

Đừng nhầm lẫn hai trường hợp này thành một vấn đề.

### 1.3 "Chi tiết hoặc tải xuống báo lỗi không hỗ trợ tác vụ cũ"

Đây là một loại vấn đề khác, đừng nhầm với `runtime = null`.

Nếu tác vụ vẫn sử dụng:

- Bố cục thư mục cũ `originPDF/jsonPDF/transPDF/typstPDF`
- Lưu trữ artifact đường dẫn tuyệt đối phiên bản cũ

Thì backend hiện tại sẽ từ chối đường dẫn chi tiết/tải xuống và yêu cầu chạy lại.

Đây không phải lỗi tạm thời, cũng không phải lỗi phân tích frontend, mà là luồng chính hiện tại đã ngừng hỗ trợ bố cục tác vụ cũ.

### 1.4 "Luồng sự kiện trống"

Ưu tiên kiểm tra:

1. Giao diện có trả về `200` không
2. `data.items` có khác rỗng không
3. Frontend có đọc nhầm thành `items` cấp cao nhất không

## 2. Bảng giá trị được khuyến nghị cho trang chi tiết tác vụ

- Trạng thái hiện tại: `data.status`
- Giai đoạn hiện tại: `data.stage_snapshot.display_stage`
- Mô tả giai đoạn hiện tại: `data.stage_snapshot.stage_detail`
- Tiến độ giai đoạn hiện tại: `data.stage_snapshot.progress`
- Trạng thái bảng giai đoạn: `data.stages`
- Dòng thời gian quá trình: `data.runtime.stage_history`
- Thời gian giai đoạn hiện tại: `data.runtime.active_stage_elapsed_ms`
- Tổng thời gian: `data.runtime.total_elapsed_ms`
- Tóm tắt thất bại: `data.failure.summary`
- Loại thất bại: `data.failure.category`
- Chế độ dịch công thức: `data.request_payload.translation.math_mode`
- Giao thức thực thi: `data.invocation`
- Tóm tắt chuẩn hóa: `data.normalization_summary`
- Tóm tắt bảng thuật ngữ: `data.glossary_summary`
- Nút tải xuống: `data.actions.*.enabled`

## 3. Bảng giá trị được khuyến nghị cho tab luồng sự kiện

- Mảng sự kiện: `data.items`
- Phân trang limit: `data.limit`
- Phân trang offset: `data.offset`

Mỗi item nên hiển thị:

- `seq`
- `ts`
- `level`
- `stage`
- `event`
- `message`

`payload` khuyến nghị là khu vực mở rộng, không mở hết mặc định.

## 4. Cách kiểm tra trên đĩa

Thư mục gốc của tác vụ thường ở:

`DATA_ROOT/jobs/{job_id}/`

Các vị trí kiểm tra phổ biến:

- `specs/`
- `logs/events.jsonl`
- `artifacts/pipeline_summary.json`
- `ocr/`
- `translated/`
- `rendered/`

Nếu tác vụ thất bại và cần xem chẩn đoán chi tiết hơn, các vị trí bổ sung:

- `logs/failure-ai-diagnosis.request.json`
- `logs/failure-ai-diagnosis.response.json`

Giải thích:

- Hai tệp này chỉ xuất hiện khi loại thất bại chính vẫn là `unknown` và backend kích hoạt chẩn đoán AI bổ sung thành công
- Không có hai tệp này không có nghĩa là phân loại thất bại bị hỏng, nhiều tác vụ có thể phân loại trực tiếp qua quy tắc
- Stage spec trong thư mục `specs/` là giao thức đầu vào thực tế mà worker hiện tại đang thực thi; nếu không có ở đây mà bạn nghĩ là tác vụ mới, hãy kiểm tra xem tác vụ có phải là sản phẩm cũ hay thư mục bán thành phẩm không

## 5. Một ví dụ thực tế

Tác vụ `20260404150516-75857c`:

- Trong giao diện chi tiết, `runtime = null`
- Vì vậy "dòng thời gian quá trình" không hiển thị được
- Nhưng giao diện `/events` có dữ liệu
- Trên đĩa cũng có `logs/events.jsonl`

Điều này cho thấy:

- Tác vụ này thuộc về tác vụ cũ trước khi tính năng lưu thời gian runtime được triển khai
- Không phải luồng sự kiện bị hỏng
- Cũng không phải tab thời gian frontend tự render thất bại

## 6. Kết luận cấp tài liệu

Nếu frontend chỉ cần hiển thị ổn định:

- Dòng thời gian chỉ xem `runtime.stage_history`
- Luồng sự kiện chỉ xem `/events`
- Giao thức thực thi chỉ xem `invocation`
- Tổng quan chuẩn hóa chỉ xem `normalization_summary`
- Không điền ngược qua lại, không trộn lẫn, không suy luận dòng thời gian chính từ luồng sự kiện

## 7. Cách đọc nguyên nhân thất bại hiện tại

Sau khi tác vụ thất bại, khuyến nghị xem theo thứ tự sau:

1. `data.failure.summary`
2. `data.failure.root_cause`
3. `data.failure.suggestion`
4. `data.failure.raw_diagnostic`
5. `data.failure.ai_diagnostic`

Nguyên tắc xác định:

- `failure` là nguồn chính
- `failure.raw_diagnostic` dùng để trả lời "ngoại lệ gốc thực sự là gì"
- `failure.ai_diagnostic` dùng để trả lời "nếu quy tắc không nhận ra, AI cho rằng có khả năng là gì"
- `failure_diagnostic` chỉ là trường cũ để tương thích, đừng coi đó là nguồn chính

Luồng chẩn đoán thất bại của backend hiện tại:

1. Python entry cấp cao xuất JSON thất bại có cấu trúc trước
2. Rust ưu tiên phân tích JSON thất bại có cấu trúc này và phân loại
3. Nếu vẫn là `unknown`, thử thêm chẩn đoán AI bổ sung
4. Kết quả cuối cùng được lưu vào chi tiết tác vụ và luồng sự kiện

## 8. Các sự kiện quan trọng trong luồng sự kiện liên quan đến chẩn đoán thất bại

Thường xem các sự kiện sau:

- `failure_classified`
- `failure_ai_diagnosed`
- `job_terminal`

Ý nghĩa:

- `failure_classified`: Backend đã có phân loại thất bại có cấu trúc
- `failure_ai_diagnosed`: Chỉ xuất hiện với thất bại `unknown`, cho biết AI đã bổ sung chẩn đoán
- `job_terminal`: Tác vụ vào trạng thái cuối cùng, thích hợp để đọc tóm tắt cuối

## 9. Điểm cần lưu ý khi gỡ lỗi phạm vi trang OCR

Trong `POST /api/v1/jobs`, nếu muốn giới hạn phạm vi trang OCR, trường nằm ở:

```json
{
  "ocr": {
    "page_ranges": "1-5"
  }
}
```

Hành vi backend hiện tại:

- `ocr.page_ranges` được đưa vào `request_payload` của tác vụ đã lưu
- Khi `provider=mineru`:
  - Với `source.upload_id`, đường dẫn PDF tải lên sẽ cắt thành PDF con trước khi tải lên
  - Với `source.source_url`, URL từ xa cũng được truyền qua
- Chuỗi rỗng nghĩa là không giới hạn số trang

Nếu `source.upload_id + ocr.page_ranges` đã có hiệu lực, thì `source_pdf` trong thư mục tác vụ, số trang dịch sau đó và PDF cuối cùng đều chỉ bao gồm tập con này, không còn kết quả "chỉ một phần trang trong toàn bộ PDF được dịch".

Nếu nghi ngờ phạm vi trang chưa có hiệu lực, hãy kiểm tra ba lớp sau, đừng đoán frontend:

1. Trong chi tiết yêu cầu, `request_payload.ocr.page_ranges` có khác rỗng không
2. Trong DB `jobs.request_json`, `$.ocr.page_ranges` có khác rỗng không
3. Xem nhật ký thực thi provider, không phải nghi ngờ biểu mẫu trang

## 11. Điểm cần lưu ý khi gỡ lỗi `math_mode`

Nếu bạn đang kiểm tra "tại sao khối công thức chạy chậm" hoặc "tại sao không có placeholder":

1. Xem `request_payload.translation.math_mode` trước
2. `placeholder` nghĩa là tác vụ hiện tại vẫn dùng chuỗi bảo vệ công thức cũ
3. `direct_typst` nghĩa là tác vụ hiện tại đang dùng nhánh xuất trực tiếp công thức thử nghiệm

Nguyên tắc xác định:

- Với `placeholder`, việc kiểm tra placeholder, phân đoạn công thức, windowed formula là dự kiến
- Với `direct_typst`, không nên coi sự ổn định placeholder là vấn đề chính, tập trung vào chất lượng xuất trực tiếp của mô hình, tiếng Anh còn sót và khả năng tương thích render

## 10. Cách xử lý khi tác vụ cũ bị từ chối

Nếu giao diện chi tiết hoặc tải xuống trả về "không hỗ trợ tác vụ cũ, cần chạy lại", kiểm tra theo thứ tự sau:

1. Xem thư mục tác vụ có còn là `originPDF/jsonPDF/transPDF/typstPDF` không
2. Xem lưu trữ artifacts trong DB có còn là đường dẫn tuyệt đối không
3. Xem tác vụ đó có trước lần chuyển đổi spec-only và bố cục artifact mới không

Kết luận:

- Các tác vụ này hiện tại không được tự động di chuyển
- Không khuyến nghị viết mã tương thích tạm thời để xử lý
- Cách xử lý đúng là chạy lại