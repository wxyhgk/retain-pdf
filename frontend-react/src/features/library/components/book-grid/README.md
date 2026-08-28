# Nhóm component Book Grid

## Ranh giới

`book-grid` phụ trách bố cục lưới bộ sưu tập sách. Nó chỉ nhận `books` đã chuẩn bị sẵn, không phụ trách tìm kiếm, sắp xếp, lọc hay yêu cầu dữ liệu.

## Tệp

- `book-grid.tsx`: Render container cuộn và lưới thẻ sách.
- `index.ts`: Xuất khẩu công khai của nhóm component.

## Quy tắc

- Bên ngoài chỉ import `BookGrid`.
- Trạng thái chọn truyền qua `selectedBookId`.
- Hành vi nhấp giao cho trang hoặc container xử lý qua `onSelectBook`.
- Trạng thái trống, trạng thái tải, thanh công cụ chọn hàng loạt sau này có thể đặt trong thư mục này.
