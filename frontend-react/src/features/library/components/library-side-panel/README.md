# Nhóm component Library Side Panel

## Ranh giới

`library-side-panel` phụ trách lối vào chức năng có thể thu gọn bên trái trang chủ. Nó chỉ hiển thị lối vào và panel thao tác nhẹ, hành động thực tế được giao cho container trang qua callback.

## Tệp

- `library-side-panel.tsx`: Tầng tổ hợp mở/thu gọn.
- `library-side-panel-trigger.tsx`: Nút nhỏ trạng thái thu gọn.
- `library-side-panel-item.tsx`: Mục chức năng đơn trạng thái mở rộng, hỗ trợ trạng thái kích hoạt và callback nhấp.
- `library-side-panel-config.ts`: Class bố cục.
- `library-side-panel-types.ts`: Kiểu nhóm component.
- `index.ts`: Xuất khẩu công khai.

## Quy tắc

- Văn bản chức năng và danh sách biểu tượng đến từ `library-config.ts`.
- Chức năng thực tế truyền qua callback, không yêu cầu API trực tiếp trong component item.
- Chế độ đa chọn chỉ hiển thị số lượng chọn và nút thao tác hàng loạt ở đây, tập hợp chọn do container trang duy trì.
