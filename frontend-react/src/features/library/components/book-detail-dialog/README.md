# Nhóm component Book Detail Dialog

## Ranh giới

`book-detail-dialog` phụ trách hộp thoại chi tiết một cuốn sách. Nó hiển thị tóm tắt sách, nút thao tác và trạng thái nhiệm vụ hiện tại, không phụ trách tải dữ liệu sách hay gọi API tải xuống/đọc.

## Tệp

- `book-detail-dialog.tsx`: Tầng tổ hợp hộp thoại.
- `book-detail-config.ts`: Định nghĩa tab và kích thước bố cục nhóm component này.
- `book-detail-selectors.ts`: Chuyển `LibraryBook` thành view model nội bộ hộp thoại chi tiết.
- `book-detail-cover-panel.tsx`: Vùng bìa trái.
- `book-detail-heading.tsx`: Tiêu đề và tác giả.
- `book-detail-tabs.tsx`: Tầng tổ hợp bốn tab chi tiết, dịch, tệp, tiến độ.
- `book-detail-overview-panel.tsx`: Tầng tổ hợp tab chi tiết.
- `book-detail-fields.tsx`: Số trang, trạng thái, thời gian cập nhật.
- `book-detail-translation-panel.tsx`: Tầng tổ hợp tab dịch.
- `book-detail-field-list.tsx`: Danh sách label-value chung cho trường chi tiết.
- `book-detail-translation.tsx`: Tóm tắt cấu hình nhiệm vụ dịch.
- `book-detail-artifacts.tsx`: Sản phẩm tệp như PDF gốc, PDF dịch, PDF đối chiếu.
- `book-detail-artifacts-panel.tsx`: Tầng tổ hợp tab tệp.
- `book-detail-artifact-row.tsx`: Hàng sản phẩm tệp đơn.
- `book-detail-progress-summary.tsx`: Tóm tắt tiến độ nhiệm vụ giản lược dành riêng cho hộp thoại chi tiết.
- `book-detail-section.tsx`: Khối chung nội bộ hộp thoại chi tiết.
- `book-detail-actions.tsx`: Lối vào đọc đối chiếu và tải xuống.
- `book-detail-status-panel.tsx`: Vùng tiến độ nhiệm vụ bên phải.
- `book-detail-types.ts`: Kiểu props chia sẻ nội bộ nhóm component này.
- `index.ts`: Xuất khẩu công khai của nhóm component.

## Quy tắc

- Bên ngoài chỉ import `BookDetailDialog`.
- Văn bản sản phẩm đến từ `library-config.ts`.
- Kích thước bố cục cố định đến từ `book-detail-config.ts`, không rải rác trong nhiều `.tsx`.
- Phái sinh dữ liệu phức tạp đặt trong `book-detail-selectors.ts`, component hiển thị chỉ nhận props đơn giản.
- `BookDetailDialog` là lối vào component duy nhất được phép nhận `LibraryBook`.
- `BookDetailTabs` và component trong tab nhận `BookDetailViewModel` hoặc props nhỏ hơn, không phụ thuộc trực tiếp `LibraryBook`.
- Hộp thoại chi tiết dùng `BookDetailProgressSummary` nhẹ, không nhúng trực tiếp thẻ trang nhiệm vụ đầy đủ.
- Callback hành động thật truyền từ props `BookDetailDialog`, rồi phân phát xuống component hành động nội bộ.
- Chi tiết sách, tiến độ nhiệm vụ, hành động tải xuống/đọc duy trì trong tệp độc lập, tránh tầng tổ hợp phình to.
- Nội dung hộp thoại phân vùng qua tabs, khi thêm tính năng ưu tiên thêm component trong tab, không chất nội dung trực tiếp vào `book-detail-dialog.tsx`.
