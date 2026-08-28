# Library Model

`model` chứa trạng thái và điều phối hành động trang thư viện.

- `useLibraryController` phụ trách tải danh sách, cache chi tiết, tải xuống, xóa, lọc, sắp xếp, bật/tắt hộp thoại và trạng thái đa chọn.
- `useLibraryData` phụ trách tải danh sách, cache chi tiết, sách hiện tại và xóa khỏi danh sách cục bộ.
- `useLibraryFeedback` phụ trách thông báo lỗi và toast ngắn.
- Component không trực tiếp yêu cầu backend, cũng không trực tiếp đọc mock data.
- Phản hồi backend vẫn đi qua adapter `api` chuyển thành `LibraryBook` trước khi vào trạng thái trang.

Sau này nếu tiếp tục phình to, tiếp tục tách theo trách nhiệm thành `use-library-selection`, `use-library-downloads`, đừng nhét logic trở lại component.
