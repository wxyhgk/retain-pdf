# Nhóm component Book Card

## Ranh giới

`book-card` phụ trách thẻ sách đơn trong trang chủ thư viện. Nó là một nhóm component, mã bên ngoài nên import từ lối vào `./book-card`, không phụ thuộc trực tiếp tệp nội bộ.

## Tệp

- `book-card.tsx`: Tầng tổ hợp, chuyển `LibraryBook` thành props cần thiết cho các phần của thẻ.
- `book-card-shell.tsx`: Vỏ có thể nhấp, hiệu ứng hover và trạng thái chọn.
- `book-card-meta.tsx`: Bố cục vùng tiêu đề và tác giả.
- `book-status-badge.tsx`: Component đánh dấu trạng thái cũ, thẻ hiện tại không hiển thị trạng thái, giữ lại để tái sử dụng cho chế độ mật độ danh sách sau này.
- `index.ts`: Xuất khẩu công khai của nhóm component.

## Quy tắc

- Văn bản sản phẩm và định nghĩa trạng thái đặt trong `library-config.ts`.
- Định nghĩa cấu trúc dữ liệu đặt trong `types.ts`.
- Sau này只要是 khả năng hiển thị riêng của thẻ sách, ưu tiên đặt trong thư mục này.
- Bên ngoài chỉ import `BookCard`, component nhỏ nội bộ mặc định không phơi ra ngoài.
- Nhấp vào thân thẻ để vào chi tiết.
- Hover giữa bìa xuất hiện nút mắt, nhấp mắt để vào đọc đối chiếu.
- Hover góc trên phải bìa xuất hiện nút xóa, nhấp xóa chỉ kích hoạt callback xóa, không mở chi tiết.
