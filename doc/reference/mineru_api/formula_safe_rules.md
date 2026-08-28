# Quy tắc sửa lỗi công thức an toàn cho MinerU

Quy tắc này chỉ áp dụng cho văn bản `raw latex-ish` đầu ra từ OCR công thức như MinerU / UniMERNet.

Mục tiêu không phải là "sửa tất cả công thức đẹp nhất", mà là:

- Chỉ thực hiện sửa lỗi rủi ro thấp, có cấu trúc, có thể giải thích
- Tránh thay thế chuỗi toàn cục phá hỏng công thức phức tạp
- Làm cho Typst / mitex kết xuất ổn định hơn

## Bối cảnh

Đầu ra công thức của MinerU về bản chất là chuỗi LaTeX do mô hình nhận dạng công thức tạo ra, không phải LaTeX chuẩn gốc của PDF.

Các đặc điểm thường gặp:

- Khoảng trắng giữa từ điều khiển và dấu ngoặc nhọn: `\mathrm { C H }`
- Chỉ số dưới / trên bị tách bởi khoảng trắng: `x _ { i , j }`
- Chữ số bị tách rời: `1 . 2 7`
- Lẫn lệnh kiểu cục bộ: `\bf { g }`

## Cho phép sửa

Các quy tắc này có thể giữ lại vì rủi ro thấp, ngữ nghĩa rõ ràng:

- `\mathrm { C H } -> \mathrm{CH}`
- `a _ { b } -> a_{b}`
- `a ^ { b } -> a^{b}`
- `a _ 2 -> a_2`
- `a ^ 2 -> a^2`
- Siết khoảng trắng bên trong số: `1 . 2 7 -> 1.27`
- `\textsuperscript{...} -> ^{...}`
- Sửa một số ít nhiễu OCR rõ ràng, ví dụ `\mathrm { e V } -> \mathrm{eV}`

## Cấm sửa

Các quy tắc này cấm sử dụng thay thế chuỗi toàn cục:

- Toàn cục `"{ -> ("`, `"} -> )"`
- Toàn cục `" _ {" -> "_("`
- Toàn cục `" ^ {" -> "^("`
- Xóa dấu ngoặc nhọn diện rộng dựa trên regex
- Trực tiếp sửa `\frac`, `\sqrt`, `\left...\right` khi chưa xác nhận ranh giới cú pháp
- "Đoán" cấu trúc công thức phức tạp dựa trên độ dài hoặc bộ ký tự

## Nguyên tắc xử lý cấu trúc phức tạp

Đối với các cấu trúc sau, chỉ có thể xử lý ở mức cân bằng ngoặc, có cấu trúc:

- `\frac{...}{...}`
- `\sqrt{...}`
- `\left ... \right`
- `x_{i,j}`
- `E_{g}^{dir}`
- `\Delta G_{H^*}`
- `\mathbf{v}_{t+1}`

Nguyên tắc:

- Trước tiên siết chặt liên kết nguyên tử của `_` / `^`
- Sau đó xử lý đệ quy nội dung trong nhóm
- Không viết lại mạnh mẽ các nhóm chưa biết

## Ranh giới kỹ thuật

Chúng tôi chấp nhận thực tế:

- Đầu ra MinerU không phải là LaTeX cuối cùng
- Công thức phức tạp thà sửa ít còn hơn sửa quá
- Nếu cấu trúc phức tạp đã có thể kết xuất, ưu tiên giữ nguyên
- Khi kết xuất thất bại, ưu tiên làm selective sanitize, không sửa mạnh trên đường dẫn chính

## Chiến lược hiện tại

Mã hiện tại nên tuân theo:

- `normalizer.py` chỉ làm siết chặt rủi ro thấp theo danh sách trắng
- `typst_formula_renderer.py` không thay thế dấu ngoặc nhọn toàn cục
- Cấu trúc kịch bản phức tạp xử lý qua đệ quy cân bằng ngoặc
- Tất cả quy tắc mới phải bổ sung kiểm thử hồi quy trước khi đưa lên
