Bảng giá các mô hình dưới đây tính theo "triệu token". Token là đơn vị nhỏ nhất mà mô hình sử dụng để biểu diễn văn bản ngôn ngữ tự nhiên, có thể là một từ, một số hoặc một dấu câu, v.v. Chúng tôi sẽ tính phí dựa trên tổng số token đầu vào và đầu ra của mô hình.

Chi tiết mô hình
Mô hình	deepseek-v4-flash*	deepseek-v4-pro
BASE URL (định dạng OpenAI)	https://api.deepseek.com
BASE URL (định dạng Anthropic)	https://api.deepseek.com/anthropic
Phiên bản mô hình	DeepSeek-V4-Flash	DeepSeek-V4-Pro
Chế độ suy nghĩ	Hỗ trợ chế độ không suy nghĩ và suy nghĩ (mặc định)
Xem chi tiết cách chuyển đổi tại chế độ suy nghĩ
Độ dài ngữ cảnh	1M
Độ dài đầu ra	Tối đa 384K
Tính năng	Json Output	Hỗ trợ	Hỗ trợ
Tool Calls	Hỗ trợ	Hỗ trợ
Tiếp tục tiền tố hội thoại (Beta)	Hỗ trợ	Hỗ trợ
FIM completion (Beta)	Chỉ hỗ trợ chế độ không suy nghĩ	Chỉ hỗ trợ chế độ không suy nghĩ
Giá	Đầu vào triệu token (cache hit)	0,2 NDT	1 NDT
Đầu vào triệu token (cache miss)	1 NDT	12 NDT
Đầu ra triệu token	2 NDT	24 NDT
* deepseek-chat và deepseek-reasoner sẽ bị loại bỏ trong tương lai. Vì lý do tương thích, chúng tương ứng với chế độ không suy nghĩ và suy nghĩ của deepseek-v4-flash.

Quy tắc trừ phí
Phí trừ = số token tiêu thụ × đơn giá mô hình, khoản phí tương ứng sẽ được trừ trực tiếp từ số dư nạp hoặc số dư tặng. Khi cả số dư nạp và số dư tặng đều có, sẽ ưu tiên trừ số dư tặng.

Giá sản phẩm có thể thay đổi, DeepSeek bảo lưu quyền sửa đổi giá. Vui lòng nạp tiền theo nhu cầu sử dụng thực tế và thường xuyên kiểm tra trang này để biết thông tin giá mới nhất.