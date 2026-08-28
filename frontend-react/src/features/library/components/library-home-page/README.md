# Nhóm component Library Home Page

## Ranh giới

`library-home-page` phụ trách bố cục cấp trang của trang chủ thư viện. Nó tổ hợp thanh trên, thanh công cụ lọc và lưới sách, nhưng không sở hữu yêu cầu dữ liệu, trạng thái hộp thoại hay API backend.

## Tệp

- `library-home-page.tsx`: Tầng tổ hợp trang chủ.
- `index.ts`: Xuất khẩu công khai nhóm component.

## Quy tắc

- Trạng thái trang do container tầng trên truyền vào.
- Văn bản sản phẩm và mục sắp xếp đến từ `library-config.ts`.
- Lối vào tìm kiếm, lọc, tải lên sau này có thể tiếp tục tách thành vùng độc lập trong nhóm component này.
