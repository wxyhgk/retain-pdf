# Đánh giá tầng đầu pretext

Đối tượng đánh giá:

- <https://github.com/chenglou/pretext>
- <https://github.com/chenglou/pretext/blob/main/STATUS.md>

Kết luận đánh giá:

`pretext` xứng đáng vào danh sách ứng viên của `layout-fit`, nhưng giai đoạn đầu không nên đặt nó làm nhân đo lường duy nhất. Định vị an toàn hơn là: song song với bộ đo HTML/DOM gốc, làm phương án đo bố cục văn bản cấp khối可控 hơn, có thể cache, ít reflow để đối chiếu mẫu nhỏ.

## Điểm phù hợp với layout-fit

Vấn đề quan trọng nhất hiện tại của `layout-fit` là khớp cấp khối: cho trước văn bản, font, chiều rộng/cao đích và tham số dàn trang ứng viên, tính ổn định số dòng, chiều cao, tràn chiều rộng, rồi chọn bộ tham số gần khung đích nhất.

Hướng cốt lõi của `pretext` vừa khớp phần vấn đề này:

- Nó tách bố cục văn bản thành bước chuẩn bị và bố cục có thể lập trình, thay vì phụ thuộc hoàn toàn vào DOM reflow.
- Nó phơi các lối vào cơ sở như `prepare()` và `layout()`, phù hợp làm quét "cùng một đoạn văn bản, nhiều bộ tham số đo lặp lại".
- Nó hỗ trợ các giao diện hạt mịn hơn như `layoutWithLines()`, `prepareWithSegments()`, `measureLineStats()`, phù hợp lấy kết quả từng dòng và thống kê dòng.
- Nó nhấn mạnh đường dẫn bố cục văn bản phân bổ thấp, độ trễ thấp, phù hợp sau này làm quét mẫu hàng loạt hoặc tinh chỉnh tham số thời gian thực.

## Khả năng có thể phục vụ trực tiếp

Khả năng tái sử dụng tầng đầu chủ yếu là đo lường và bố cục, không phải khôi phục PDF hoàn chỉnh:

- Sau khi cho ràng buộc chiều rộng, tính văn bản ngắt dòng thế nào.
- Lấy các chỉ số bố cục như số dòng, chiều rộng dòng và chiều cao tổng thể.
- Hỗ trợ chạy lại bố cục dưới các tham số khác nhau, dùng cho quét kích thước chữ, chiều cao dòng và chiều rộng đoạn.
- Hỗ trợ đầu vào đoạn văn bản mịn hơn, tạo không gian cho xử lý sau này như trộn Trung-Anh, kiểu nhấn mạnh hoặc giữ chỗ placeholder.

## Vấn đề không thể giải quyết trực tiếp

Những khả năng này vẫn cần `layout-fit` tự đóng gói tầng trên:

- Trích xuất mẫu cấp khối từ `document.v1.json`, `translated/page-XXX-deepseek.json`.
- Định nghĩa định dạng mẫu `fixtures` và định dạng đầu ra thí nghiệm.
- Ánh xạ kết quả đo sang tham số kích thước chữ, chiều cao dòng, đoạn văn của Typst.
- Làm phát lại đa khối cấp trang, phát hiện va chạm và khôi phục trộn hình-văn bản.
- Xác minh sai số thực tế dưới CJK, trộn Trung-Anh, công thức nội dòng và tọa độ khung OCR.
- Đối chiếu số dòng và chiều cao của DOM, `pretext`, Typst trên cùng một lô mẫu.

## Rủi ro hiện tại

Rủi ro chính không nằm ở việc `pretext` có giá trị hay không, mà ở việc nó có đủ gần với mục tiêu dàn trang cuối cùng của chúng ta hay không:

- Mô hình dàn trang của nó không tương đương Typst, không thể coi đầu ra là chân lý Typst.
- Tính nhất quán đo font vẫn có thể bị ảnh hưởng bởi trình duyệt, tải font Canvas và khác biệt font nền tảng.
- Nếu cần kiểm soát chặt `letter-spacing`, khoảng cách đoạn, nén dấu câu tiếng Trung hoặc chiều rộng placeholder công thức, có thể cần adapter bổ sung.
- Nếu mẫu chủ yếu đến từ khung OCR, mục tiêu là khớp kích thước khối PDF gốc, chỉ số bố cục văn bản thông thường có thể chưa đủ, cần thêm chấm điểm đối chiếu OCR/Typst.

## Định vị khuyến nghị

Bước tiếp theo không chỉ làm bộ đo HTML/DOM đơn tuyến, mà chuyển sang kép:

- Tuyến A: Bộ đo cơ sở HTML/DOM.
- Tuyến B: Bộ đo ứng viên `pretext`.

Hai tuyến dùng cùng lô `fixtures`, xuất cùng bộ chỉ số:

- `lineCount`
- `height`
- `maxLineWidth`
- `overflowX`
- `overflowY`
- `score`

PoC vòng đầu chỉ cần trả lời một câu hỏi: Trên 5 đến 10 mẫu khối văn bản thực tế, phán đoán số dòng, chiều cao và tràn của `pretext` có ổn định hơn, dễ quét tham số hơn so với cơ sở DOM hay không.

Nếu kết quả PoC ổn định, mới cân nhắc đóng gói `pretext` thành adapter đo chính thức dưới `scripts/` hoặc `html/`; nếu kết quả chênh lệch quá lớn so với DOM/Typst, thì chỉ giữ làm phương án tham khảo.

## Trạng thái cài đặt hiện tại

`layout-fit` đã bổ sung lối vào PoC phía trình duyệt:

- `html/pretext.html`
- `package.json`

Phụ thuộc cài đặt bình thường qua mirror nội địa:

- `npm install --registry=https://registry.npmmirror.com`

Ngoài ra đã xác nhận một sự thật quan trọng:

- `@chenglou/pretext` có thể được import trong môi trường Node hiện tại.
- Nhưng khi thực sự thực thi `prepare()` / `prepareWithSegments()` thì cần `OffscreenCanvas` hoặc DOM canvas context.
- Do đó vị trí PoC hợp lý nhất hiện tại là phía trình duyệt, không phải script CLI Node thuần.
