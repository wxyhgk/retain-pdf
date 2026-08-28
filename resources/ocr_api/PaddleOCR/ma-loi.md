Mã lỗi
Mã lỗi	Mô tả mã lỗi	Khuyến nghị khắc phục
401	Token không hợp lệ	Kiểm tra token, lấy token từ liên kết: Liên kết
500	Lỗi hệ thống	Vui lòng liên hệ chính thức hoặc thử lại sau
10001	Tệp rỗng (http status tương ứng 400)	Vui lòng kiểm tra tệp
10002	URL tệp không nhận diện được (http status tương ứng 400)	Vui lòng kiểm tra URL
10003	Kích thước tệp vượt giới hạn (http status tương ứng 400)	Vui lòng kiểm tra tệp
10004	Định dạng tệp không được hỗ trợ (http status tương ứng 400)	Vui lòng kiểm tra tệp
10005	Nội dung tệp không thể phân tích (http status tương ứng 400)	Vui lòng kiểm tra tệp
10006	Số trang tệp vượt giới hạn (http status tương ứng 400)	Vui lòng kiểm tra tệp
10007	Lỗi tham số mô hình (http status tương ứng 400)	Mô hình không tồn tại, vui lòng kiểm tra tên mô hình
10008	Lỗi tham số yêu cầu (http status tương ứng 400)	Lỗi tham số optionalPayload hoặc extraFormats, vui lòng sửa theo gợi ý data.errorMsg
10009	Tác vụ cùng batchId chỉ cho phép tạo 100 mục (http status tương ứng 400)	Vui lòng đổi batchId
10010	Hàng đợi gửi tác vụ đã đầy	Vui lòng thử lại sau
11001	jobId không tồn tại (http status tương ứng 404)	Vui lòng kiểm tra jobId
11002	job đã hết hạn (http status tương ứng 400)	Vui lòng đổi JobId
11003	job phân tích thất bại (http status tương ứng 200)	Phân tích thất bại, nguyên nhân cụ thể xem: data.errorMsg
12001	Đã đạt giới hạn số trang mỗi ngày (http status tương ứng 403)	Vượt hạn ngạch hàng ngày, nếu cần tăng vui lòng xem mô tả hạn ngạch
12002	Tần suất yêu cầu quá cao (http status tương ứng 429)	Vui lòng thử lại sau
