# Library Route

`LibraryRoute` là container tổ hợp trang thư viện.

- Chỉ chịu trách nhiệm nối trạng thái và hành động của `useLibraryController` vào trang, chi tiết, trình đọc và hộp thoại cài đặt.
- Không viết logic nghiệp vụ như lọc, tải xuống, xóa, yêu cầu backend.
- Không đặt văn bản UI cụ thể; văn bản vẫn đi qua `library-config.ts`.
- Trình đọc kết nối tĩnh, khi mở đọc đối chiếu không tải thêm gói component.

Ranh giới này giữ `App.tsx` ở vai trò lối vào, và ngăn trạng thái cấp trang xâm nhập vào component hiển thị thuần túy.
