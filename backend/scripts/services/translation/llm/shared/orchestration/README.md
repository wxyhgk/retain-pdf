# Điều phối LLM Dịch

Lớp này chỉ chịu trách nhiệm một việc:
Điều phối "yêu cầu dịch cho từng block / từng batch items" thành quy trình gọi provider ổn định, có thể quay lui và có thể chẩn đoán.

Lớp này không chịu trách nhiệm:

- Chi tiết HTTP dành riêng cho provider
- Trích xuất payload OCR
- Ghi đè và lưu payload trang
- Render PDF

## Đọc trước đối với người mới

- Muốn xem điểm vào tổng:
  `retrying_translator.py`
- Muốn xem luồng chính hạ cấp plain-text đơn:
  `single_item_flow.py`
- Muốn xem wrapper định tuyến cho điều phối đơn:
  `single_item_routes.py`
- Muốn xem facade fallback:
  `fallbacks.py`
- Muốn xem định tuyến segment công thức:
  `segment_routing.py`
- Muốn xem yêu cầu/chia cửa sổ/thực thi segment công thức:
  `segment_request.py` / `segment_windows.py` / `segment_executor.py`
- Muốn xem đường dẫn đặc biệt direct-typst:
  `direct_typst.py`
- Muốn xem batch/cache/tail retry:
  `batched_plain.py`

## Ranh giới hiện tại

- `retrying_translator.py`
  Điểm vào ổn định cho shared orchestration.
  Chỉ chịu trách nhiệm cho `translate_batch` / `translate_items_to_text_map`, không chứa logic điều phối thực tế, cũng không còn để lộ các API riêng tư lịch sử `_xxx`.

- `fallbacks.py`
  Facade điều phối plain-text đơn.
  Chịu trách nhiệm:
  - Giữ lại điểm vào gọi/kiểm thử tầng trên
  - Truyền các đối tượng thay thế kiểm thử trên facade vào `single_item_flow.py` thông qua dependency injection tường minh
  - Chuyển tiếp đến `single_item_flow.py`
  Không còn giữ lại các wrapper đường dẫn riêng tư cũ như tagged-placeholder.

- `single_item_flow.py`
  Luồng chính điều phối plain-text đơn.
  Chịu trách nhiệm:
  - Lựa chọn đường dẫn chính direct-typst / segmented / plain-text
  - Quyết định tagged placeholder first
  - Vòng lặp thử plain-text đơn
  - Tích hợp fallback cấp câu

- `single_item_deps.py`
  Đối tượng dependency injection tường minh cho điều phối đơn.
  Chỉ chịu trách nhiệm truyền tập trung các hàm có thể thay thế như gọi provider, gọi segment, fallback cấp câu, validation vào `single_item_flow.py`.

- `single_item_routes.py`
  Wrapper định tuyến cho điều phối đơn.
  Chỉ chịu trách nhiệm về hình dạng gọi của các route có thể thay thế như direct-typst, heavy-formula, tagged-placeholder, tránh để `single_item_flow.py` tiếp tục chứa các điểm vào wrapper lịch sử và đối tượng thay thế kiểm thử.

- `batched_plain.py`
  Điều phối plain-text theo batch.
  Chịu trách nhiệm:
  - cache hit / cache drop
  - Quyết định low-risk batch
  - Chấp nhận một phần batch + chia retry
  - Truyền lại tail retry cho transport

- `direct_typst.py`
  Vòng lặp retry chính cho direct-typst.
  Chịu trách nhiệm:
  - Vòng lặp thử cho hai đường dẫn direct-typst plain/raw
  - Thu gọn cuối cùng sau khi validation failure
  - Tích hợp sentence fallback / degrade transport

- `direct_typst_long_text.py`
  Tiền chia nhỏ văn bản dài cho direct-typst.
  Chỉ chịu trách nhiệm chia khối và ghép lại cấp chunk, không xử lý transport provider.

- `direct_typst_salvage.py`
  Salvage giao thức/json shell cho direct-typst.
  Chỉ chịu trách nhiệm trích xuất bản dịch có thể chấp nhận từ văn bản bất thường và thực hiện partial accept.

- `heavy_formula.py`
  Tiền chia nhỏ block công thức nặng.
  Chỉ chịu trách nhiệm:
  - Có cần heavy split không
  - Cách chia khối theo mật độ placeholder
  - Ghép lại sau khi retry cấp chunk

- `plain_text_validation.py`
  Logic thu gọn sau khi plain-text validation thất bại.
  Chỉ chịu trách nhiệm:
  - Salvage giao thức shell
  - Salvage một phần residue tiếng Anh
  - Quyết định degrade cuối cùng sau khi validation thất bại nhiều lần

- `sentence_level.py`
  Fallback cấp câu.
  Chỉ chịu trách nhiệm chia nhỏ cấp câu, yêu cầu từng câu, ghép lại khi thành công một phần.

- `segment_routing.py`
  Facade định tuyến segment công thức đối ngoại.
  Chỉ chịu trách nhiệm để lộ các điểm vào routing / risk / plan, và chuyển tiếp thực thi cho executor.

- `segment_request.py`
  Yêu cầu provider cho segment công thức.
  Chỉ chịu trách nhiệm yêu cầu định dạng kép tagged/json, phân tích phản hồi và thu gọn lỗi định dạng.

- `segment_windows.py`
  Retry cửa sổ đơn cho segment công thức.
  Chỉ chịu trách nhiệm hợp nhất ngữ cảnh cửa sổ, vòng lặp thử cấp cửa sổ và gọi yêu cầu provider.

- `segment_executor.py`
  Điều phối thực thi segment công thức.
  Chỉ chịu trách nhiệm quy trình tổng thể cửa sổ đơn/đa cửa sổ, ghép lại kết quả, validation và thu gọn thất bại cửa sổ.

- `segment_failures.py`
  Xây dựng payload thất bại cho segment công thức.
  Chỉ chịu trách nhiệm ghi chẩn đoán thất bại cửa sổ thành payload `failed` thống nhất.

- `transport.py`
  Logic chung cho transport tail retry / DLQ.

- `terminal_payloads.py`
  Bộ xây dựng payload trạng thái cuối cho dịch.
  Quy ước:
  - Chỉ sử dụng `kept_origin` cho nội dung rõ ràng không thể dịch/cho phép bỏ qua
  - Thất bại provider, transport, validation, chunk/window đều sử dụng thống nhất `failed`
  - `failed` mặc định mang `fallback_to=retry_required`, để gate xuất khẩu chặn sản phẩm chưa hoàn thiện

- `keep_origin.py`
  Điểm vào tương thích keep-origin.
  Khi thêm trạng thái thất bại mới, ưu tiên sử dụng `terminal_payloads.py`, không ghi thất bại thành keep-origin nữa.

- `metadata.py`
  translation_diagnostics / formula diagnostics / khôi phục term runtime.

- `common.py`
  Các công cụ phán đoán thuần túy như độ dài văn bản, continuation, CJK, số lượng placeholder.

## Chuỗi gọi

Chuỗi gọi phổ biến nhất là:

`retrying_translator.py`
-> `fallbacks.py` / `single_item_flow.py`
-> `direct_typst.py` / `segment_routing.py` / runtime provider plain-text
-> `terminal_payloads.py` / `plain_text_validation.py` / `sentence_level.py`

Đường dẫn batch là:

`retrying_translator.py`
-> `batched_plain.py`
-> `fallbacks.py`

## Quy ước sau này

- Chiến lược degrade mới ưu tiên đặt vào module chịu trách nhiệm tương ứng, không nhồi lại vào `fallbacks.py` hoặc `retrying_translator.py`
- Thất bại không phải là keep-origin. Ngoại trừ các trường hợp cố tình giữ lại như metadata đường dẫn nhanh, nhãn không phải nội dung chính ngắn, văn bản tiếng Trung rõ ràng, tất cả các trạng thái cuối bất thường đều phải ghi thành `failed`.
- `fallbacks.py` giữ nguyên định vị là facade mỏng, không nhét thêm quy trình thực tế hoặc bí danh riêng tư cũ
- `retrying_translator.py` giữ nguyên định vị là điểm vào ổn định, không nhét thêm bí danh lịch sử `_xxx_impl` và quy trình thực tế
- Logic dành riêng cho provider không được vào đây, thống nhất để lại trong các triển khai provider sau `shared/provider_runtime.py`
- Nếu module nào lại vượt quá 400-500 dòng, ưu tiên cắt theo trách nhiệm, không cắt máy móc theo khối code
