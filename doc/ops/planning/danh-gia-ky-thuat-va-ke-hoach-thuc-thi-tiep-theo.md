# Đánh giá kỹ thuật và kế hoạch thực hiện tiếp theo

Tài liệu này dựa trên đánh giá bên ngoài, hiện trạng kho lưu trữ và các vấn đề thực tế gặp phải trong vòng phát triển và bàn giao gần đây.

Mục tiêu không phải lặp lại README, mà trả lời ba câu hỏi:

1. Dự án hiện tại đang ở mức nào
2. Điểm yếu thực sự hiện tại là gì
3. Tiếp theo nên làm theo thứ tự nào

## 1. Dự án hiện đang ở giai đoạn nào

Dự án hiện tại không còn là một tập hợp script đơn thuần, cũng không phải bản demo chỉ để trình diễn.

Nó đã có các đặc điểm sau:

- Có frontend trình duyệt
- Có tầng dịch vụ Rust API
- Có đường ống xử lý Python
- Có hình thức bàn giao Docker
- Có chuỗi đóng gói desktop
- Có các khả năng sản phẩm hóa như thư mục tác vụ, luồng sự kiện, tải xuống sản phẩm, chẩn đoán giai đoạn

Nói chính xác hơn:

- Nó đã là một "nguyên mẫu sản phẩm có thể hoạt động"
- Nhưng chưa hoàn toàn bước vào trạng thái kỹ thuật "chi phí bảo trì thấp, bàn giao ổn định"

## 2. Những đánh giá nào từ bên ngoài là đúng

### 2.1 Ý tưởng điều hướng của README là đúng

Hiện tại kho lưu trữ thực sự không còn là một dự án có thể giải thích bằng một tệp.

Dùng README làm điều hướng tổng thể, thay vì nhồi nhét mọi chi tiết, đó là hướng đi đúng đắn.

### 2.2 Hình thái tổng thể frontend + backend + pipeline là hoàn chỉnh

Kho lưu trữ hiện tại đã bao phủ:

- Tương tác frontend
- Gửi và truy vấn tác vụ
- Tích hợp OCR
- Xử lý dịch thuật
- Tái tạo bố cục
- Tải xuống sản phẩm
- Bàn giao Docker và desktop

Về mặt luồng sản phẩm, dự án này là hoàn chỉnh.

### 2.3 Sự kết hợp Rust API + Python pipeline là hợp lý

Kiến trúc này không lạ, mà rất phù hợp với bối cảnh hiện tại:

- Rust phụ trách phía máy chủ, lập lịch tác vụ, quản lý trạng thái, giao diện và bàn giao
- Python phụ trách OCR, dịch thuật, bố cục, hệ sinh thái mô hình, thử nghiệm nhanh

Con đường công nghệ này không có vấn đề gì.

## 3. Những gì đánh giá bên ngoài chưa chỉ rõ, nhưng là vấn đề quan trọng hơn hiện tại

Đánh giá bên ngoài đề cập đến "tính nhất quán của tài liệu, phân chia ranh giới, xây dựng có thể tái tạo", những điều đó đều đúng.

Nhưng từ những vấn đề thực tế gần đây, vấn đề cốt lõi thực sự là:

## 3.1 Hệ thống vẫn thiếu "nguồn chân lý duy nhất" đủ cứng

Nhiều vấn đề bề ngoài là:

- GitHub Actions báo lỗi
- Xây dựng desktop thất bại
- Frontend không lấy được trường dữ liệu
- Đường dẫn tải xuống thay đổi thì giao diện phải sửa

Thực chất là các nguồn chân lý sau chưa đủ thống nhất:

- Nguồn chân lý tài liệu
- Nguồn chân lý cấu hình
- Nguồn chân lý sản phẩm
- Nguồn chân lý đầu vào xây dựng desktop
- Nguồn chân lý đường dẫn và cấu trúc thư mục

Nghĩa là:

- Tệp có ở local, CI chưa chắc có
- Một tham số mặc định dùng được ở local, môi trường sạch chưa chắc có
- Một đường dẫn tải xuống được suy từ mã, chứ không đăng ký trong cơ sở dữ liệu
- Một trường có trong tài liệu, nhưng giao diện không trả về ổn định

Những vấn đề này không giải quyết, thì mỗi lần thêm tính năng, chi phí bảo trì sẽ tăng.

## 3.2 Điểm yếu lớn nhất hiện tại không phải thuật toán, mà là tính nhất quán kỹ thuật

Điểm bán hàng cốt lõi của dự án tất nhiên là:

- Giữ bố cục
- Chất lượng dịch
- Hiệu quả cuối cùng của PDF

Nhưng vấn đề tiêu tốn thời gian nhất hiện tại không chủ yếu đến từ năng lực mô hình, mà đến từ:

- Dịch khối dài không ổn định
- Bảo vệ chất giữ chỗ công thức chưa đủ
- Chiến lược giảm cấp sau thất bại cấp khối chưa ổn
- Chẩn đoán giai đoạn chưa trực tiếp
- Chuỗi xây dựng không nhất quán giữa local và CI
- Tài liệu và cấu trúc mã thỉnh thoảng tách rời

Nói cách khác:

- Thiếu nhất hiện tại không phải là "kết nối thêm một mô hình mạnh hơn"
- Mà là "làm cho luồng hiện tại ổn định hơn, dễ giải thích hơn, dễ định vị vấn đề hơn"

## 3.3 Kho lớn không phải lỗi, ranh giới không rõ mới là vấn đề

Kho hiện tại là một dự án đa thành phần trong một kho, điều này có thể chấp nhận được.

Vấn đề thực sự không phải là nhiều thư mục, mà là hợp đồng giữa các thư mục này chưa đủ cứng, ví dụ:

- Frontend phụ thuộc vào những giao diện ổn định nào
- Backend hứa hẹn lâu dài những trường nào
- Python chỉ nên nhận những tham số nào
- Chức năng tải xuống dựa vào suy luận thư mục hay đăng ký cơ sở dữ liệu
- Đóng gói desktop phụ thuộc vào những tệp rõ ràng nào

Miễn là ranh giới rõ ràng, kho đơn hoàn toàn có thể bảo trì.

## 4. Giai đoạn hiện tại nên đánh giá dự án "đủ trưởng thành" như thế nào

Để đánh giá dự án này có thực sự trưởng thành hay không, đừng chỉ nhìn "có thể tạo ra PDF hay không", mà nên nhìn bốn điều sau.

### 4.1 Môi trường sạch có thể xây dựng ổn định không

Tiêu chí:

- Chuyển sang máy khác hoặc GitHub Actions
- Không phụ thuộc vào tệp lịch sử local
- Không phụ thuộc vào bổ sung thủ công tài nguyên
- Có thể tạo ra gói có thể chạy

GitHub Actions gần đây liên tục báo lỗi, cho thấy phần này vẫn đang trong giai đoạn bổ sung.

### 4.2 Hợp đồng giao diện có ổn định không

Tiêu chí:

- Các trường đã viết trong tài liệu, giao diện trả về ổn định
- Frontend hiển thị dòng thời gian, không cần phải đoán cách lắp ráp luồng sự kiện
- Đường dẫn tải sản phẩm do backend phơi bày thống nhất, frontend không cần đoán thư mục

### 4.3 Nhiệm vụ và sản phẩm có thể truy vết không

Tiêu chí:

- Mỗi nhiệm vụ đã xảy ra gì có thể kiểm tra
- Thời gian mỗi giai đoạn có thể kiểm tra
- Tại sao thất bại có thể định vị
- Tệp cuối cùng cần tải xuống có thể lấy ổn định

### 4.4 Luồng dịch có cơ chế ổn định không

Tiêu chí:

- Đoạn dài không dễ bị hỏng
- Công thức/giữ chỗ không dễ mất
- Khi xảy ra lỗi có thể tự động giảm cấp
- Người dùng thấy nguyên nhân thất bại có thể giải thích, thay vì chỉ một câu "nhiệm vụ thất bại"

## 5. Hướng tiếp theo đáng đầu tư nhất

Nếu nhìn từ cả "hiệu quả sản phẩm" và "lợi nhuận kỹ thuật", hướng tiếp theo đáng đầu tư nhất không phải mở rộng chức năng mù quáng, mà là ba luồng chính sau.

### 5.1 Luồng chính thứ nhất: Thu gọn bàn giao kỹ thuật

Mục tiêu:

- GitHub Actions đóng gói ổn định
- Windows desktop có thể xây dựng tái tạo
- Vật liệu bàn giao Docker, frontend, backend rõ ràng
- Không phụ thuộc vào tệp ẩn local

Đây là tiền đề để đưa dự án từ "chạy được trên máy tôi" lên "bàn giao ổn định trên máy người khác".

### 5.2 Luồng chính thứ hai: Làm cứng hợp đồng backend

Mục tiêu:

- Tài liệu API và phản hồi thực tế khớp nhau
- Các cấu trúc như `runtime.stage_history`, `events`, `artifacts` ổn định lâu dài
- Khả năng tải xuống đi qua đăng ký cơ sở dữ liệu, thay vì đoán thư mục
- Tham số yêu cầu, lưu trữ nhiệm vụ, luồng truyền xuống hạ lưu có thể truy vết

Đây là chìa khóa để giảm chi phí tích hợp frontend-backend.

### 5.3 Luồng chính thứ ba: Ưu tiên ổn định dịch hơn "cải tiến hoa mỹ"

Mục tiêu:

- Phân chia khối dài ổn định hơn
- Bảo vệ công thức và giữ chỗ ổn định hơn
- Chiến lược thử lại và giảm cấp khi thất bại ổn định hơn
- Chẩn đoán chất lượng cấp trang trực quan hơn

Đây có độ ưu tiên cao hơn tăng cường RAG, bảng thuật ngữ.

Lý do đơn giản:

- Nếu độ ổn định cơ bản chưa đủ, thêm bao nhiêu tính năng tăng cường cũng bị kết quả không ổn định triệt tiêu
- Chỉ khi luồng cơ bản ổn định, bảng thuật ngữ, bảng viết tắt, RAG mới thực sự phát huy giá trị

## 6. Đề xuất ba giai đoạn tiếp theo

## Giai đoạn một: Thống nhất các nguồn chân lý kỹ thuật

Ưu tiên làm:

- Thống nhất điểm vào tài liệu
- Thống nhất nguồn chân lý phiên bản
- Thống nhất đầu vào đóng gói desktop
- Thống nhất nguồn cấu hình
- Thống nhất cách đăng ký sản phẩm

Tiêu chí:

- Môi trường sạch sẽ không còn thất bại xây dựng vì thiếu tệp local
- Tài liệu không khiến người đọc phân vân đâu là điểm vào hiện tại

## Giai đoạn hai: Làm API và tầng trạng thái nhiệm vụ thành hợp đồng ổn định

Ưu tiên làm:

- Cố định cấu trúc chi tiết nhiệm vụ
- Cố định cấu trúc dòng thời gian giai đoạn
- Cố định cấu trúc luồng sự kiện
- Cố định cấu trúc danh sách sản phẩm
- Cố định cấu trúc chẩn đoán lỗi

Tiêu chí:

- Frontend không cần đoán trường
- Frontend không cần tự tái tạo trạng thái mà backend đáng lẽ đã đưa ra

## Giai đoạn ba: Tập trung mài giũa độ ổn định chất lượng dịch

Ưu tiên làm:

- Chiến lược phân chia khối dài
- Bảo vệ công thức/giữ chỗ
- Thoái lui khi khối thất bại
- Chẩn đoán chất lượng cấp trang
- Quan sát được các vấn đề chất lượng

Tiêu chí:

- Tỷ lệ thành công cho cùng loại PDF tăng rõ rệt
- Người dùng thấy "thất bại" ít hơn
- Ngay cả khi thất bại, cũng biết được hỏng ở giai đoạn nào, khối nào

## 7. Kết luận một câu

Điểm mạnh nhất của dự án này hiện tại không phải là một thuật toán đơn lẻ, mà là đã thực sự xây dựng được toàn bộ luồng "Tải PDF lên -> OCR -> Dịch -> Tái tạo bố cục -> Tải xuống bàn giao".

Điều cần tiếp tục đầu tư nhất hiện tại không phải mù quáng thêm nhiều khả năng, mà là tiếp tục mài giũa:

- Tính nhất quán kỹ thuật
- Tính ổn định của hợp đồng
- Khả năng tái tạo xây dựng
- Độ ổn định dịch thuật

đến mức có thể bảo trì lâu dài.

Nếu bốn điều này được làm vững chắc, dự án sẽ từ "nguyên mẫu rất mạnh" thực sự bước vào giai đoạn "kỹ thuật sản phẩm có thể bàn giao ổn định".
