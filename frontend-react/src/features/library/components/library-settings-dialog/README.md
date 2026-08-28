# Nhóm component Library Settings Dialog

## Ranh giới

`library-settings-dialog` phụ trách hộp thoại cài đặt trang chủ thư viện. Hiện chỉ cung cấp placeholder phân vùng cài đặt, không trực tiếp đọc/ghi API, localStorage hoặc trạng thái toàn cục.

## Tệp

- `library-settings-dialog.tsx`: Tầng tổ hợp hộp thoại.
- `library-settings-config.ts`: Class bố cục và cấu hình cục bộ nhóm component.
- `library-settings-selectors.ts`: Chuyển cấu hình thành dữ liệu view cài đặt.
- `library-settings-tabs.tsx`: Chuyển đổi tab phân vùng cài đặt.
- `library-settings-panel.tsx`: Panel phân vùng cài đặt đơn.
- `library-settings-types.ts`: Kiểu nhóm component cài đặt.
- `index.ts`: Xuất khẩu công khai nhóm component.

## Quy tắc

- Văn bản sản phẩm đến từ `library-config.ts`.
- Mục cài đặt thực tế sau này nên bổ sung kiểu và view model trước, rồi mới giao cho component hiển thị render.
- Không đưa trường API backend trực tiếp vào component hiển thị.
