# Ghi chú tối ưu hóa frontend

Tài liệu này chỉ tập trung vào các khoản nợ kỹ thuật thực sự của `frontend/`, nhằm giúp các thành viên frontend nhanh chóng xác định:

- Vấn đề nào cần sửa trước
- Vấn đề nào ảnh hưởng trực tiếp đến phát triển sau này
- Vấn đề nào chỉ là tối ưu trải nghiệm

## Tổng quan cấu trúc hiện tại

Frontend hiện tại là một trang JS + Tailwind gốc rất nhẹ, không có framework, không có lớp quản lý bundler/runtime state.

Số liệu lượng hóa:

- Điểm vào tương tác chính: [main.js](../../frontend/src/js/main.js) khoảng `1291` dòng
- Lớp render UI: [ui.js](../../frontend/src/js/ui.js) khoảng `624` dòng
- Lớp định hình dữ liệu tác vụ: [job.js](../../frontend/src/js/job.js) khoảng `424` dòng
- Tệp kiểu chính: [components.css](../../frontend/src/styles/components.css) khoảng `1747` dòng
- Tổng mã nguồn frontend khoảng `224K`
- `frontend/node_modules` đã được đưa vào kho, khoảng `16M`

Kết luận: Không phải “chức năng quá nhiều”, mà là “chưa có sự phân tầng ổn định”, nên độ phức tạp tập trung ở một số ít tệp lớn.

## P0: Các vấn đề cần xử lý trước

### 1. Điểm vào chính quá lớn, nghiệp vụ, ràng buộc sự kiện, polling, lắp ráp biểu mẫu đều gắn kết với nhau

Tệp:

- [main.js](../../frontend/src/js/main.js)

Vấn đề:

- `main.js` đồng thời đảm nhiệm:
  - Xác thực token
  - Thu thập biểu mẫu
  - Gửi tác vụ
  - Polling tác vụ
  - Danh sách tác vụ gần đây
  - Cài đặt nhà phát triển
  - Hộp thoại chứng chỉ trình duyệt
  - Tổng ràng buộc sự kiện trang
- Điều này khiến bất kỳ thay đổi nhỏ nào cũng dễ ảnh hưởng đến các luồng khác.

Đề xuất:

- Ít nhất chia thành 4 mô-đun:
  - `job-submit.js`
  - `job-polling.js`
  - `recent-jobs.js`
  - `settings-dialog.js`
- `main.js` chỉ giữ:
  - Khởi tạo trang
  - Lắp ráp mô-đun
  - Xử lý lỗi tầng trên cùng

### 2. Trạng thái biến đổi toàn cục quá thô, không có ranh giới cập nhật

Tệp:

- [state.js](../../frontend/src/js/state.js)
- [main.js](../../frontend/src/js/main.js)
- [ui.js](../../frontend/src/js/ui.js)

Vấn đề:

- `state` là một đối tượng trần, nhiều tệp ghi trực tiếp:
  - `state.currentJobId = ...`
  - `state.recentJobsItems = ...`
  - `state.timer = ...`
- Không có ranh giới mutation, không có cơ chế đăng ký.
- Hiện tại vẫn trụ được vì trang đơn; một khi frontend tiếp tục thêm chức năng, sẽ càng khó tra nguồn trạng thái.

Đề xuất:

- Không nhất thiết phải dùng React/Vue.
- Trước tiên tạo một store nhẹ:
  - `getState()`
  - `patchState(partial)`
  - `subscribe(key, fn)` hoặc `subscribe(fn)` đơn giản
- Ít nhất tách các phần sau:
  - `jobState`
  - `uploadState`
  - `recentJobsState`
  - `developerState`

### 3. Nhiều `innerHTML` nối chuỗi, render và ràng buộc sự kiện khá mong manh

Tệp:

- [ui.js](../../frontend/src/js/ui.js)
- [templates.js](../../frontend/src/js/templates.js)
- [main.js](../../frontend/src/js/main.js)

Vấn đề:

- Nhiều chỗ viết lại toàn bộ đoạn:
  - `document.body.innerHTML = ...`
  - `list.innerHTML = ...`
- Danh sách tác vụ gần đây còn dùng:
  - `list.innerHTML = reset ? markup : \`\${list.innerHTML}\${markup}\``
- Vấn đề của cách viết này:
  - Ràng buộc sự kiện dễ mất
  - Làm mới cục bộ không kiểm soát được
  - Hiệu suất và tính nhất quán trạng thái ở mức trung bình

Đề xuất:

- Không cần tái cấu trúc thành framework component.
- Trước tiên chuyển danh sách tần suất cao sang render node DOM:
  - `document.createElement`
  - `replaceChildren`
  - `append`
- Ưu tiên xử lý:
  - Danh sách luồng sự kiện
  - Lịch sử stage
  - Danh sách tác vụ gần đây

### 4. Mã hóa cứng mật khẩu nhà phát triển trong frontend, đây là vấn đề bảo mật rõ ràng

Tệp:

- [main.js](../../frontend/src/js/main.js)

Vấn đề:

- Tồn tại:
  - `const DEVELOPER_PASSWORD = "Gk265157!";`
- Điều này tương đương với việc công khai mật khẩu frontend, không có bảo mật thực sự.

Đề xuất:

- Nếu chỉ là “ẩn cấu hình nâng cao”, hãy đổi thành:
  - Công tắc local
  - `runtime-config`
  - Điểm vào trang cài đặt desktop
- Nếu thực sự cần xác thực, phải chuyển sang backend hoặc tầng host desktop.

## P1: Các vấn đề ảnh hưởng rõ rệt đến hiệu quả bảo trì

### 5. Lớp định hình dữ liệu Job quá dày, frontend đảm nhận quá nhiều logic tương thích backend

Tệp:

- [job.js](../../frontend/src/js/job.js)

Vấn đề:

- `normalizeJobPayload()` đang làm rất nhiều “tương thích dự phòng”:
  - Fallback nhiều trường
  - Bổ sung URL tuyệt đối
  - Tương thích hai nguồn actions / artifacts
  - Tích hợp các trường phong cách runtime / failure / legacy
- Điều này cho thấy mặc dù hợp đồng phản hồi backend đã ổn định, frontend vẫn đang viết theo kiểu “tương thích lỏng lẻo”.

Đề xuất:

- Thành viên frontend có thể yêu cầu backend cung cấp một view contract ổn định hơn.
- Mục tiêu của `normalizeJobPayload()` nên thu hẹp thành hai loại công việc:
  - unwrap envelope
  - định dạng nhẹ
- Đừng tiếp tục để nó đảm nhận “lớp tương thích giao diện”.

### 6. Logic polling và yêu cầu chi tiết gắn kết quá sâu

Tệp:

- [main.js](../../frontend/src/js/main.js)

Vấn đề:

- `fetchJob(jobId)` thực hiện tuần tự trong một yêu cầu:
  - job detail
  - job events
  - artifacts manifest
- Tần suất polling cố định `3000ms`
- Không điều chỉnh theo trạng thái.

Đề xuất:

- Tách thành:
  - `pollJobSnapshot`
  - `refreshEvents`
  - `refreshArtifactsManifest`
- Chiến lược:
  - `queued/running` polling detail tần suất cao
  - events / manifest làm mới tần suất thấp
  - `succeeded/failed/canceled` dừng ngay lập tức

### 7. Nguồn cấu hình phân tán, logic phiên bản trình duyệt và desktop trộn lẫn

Tệp:

- [config.js](../../frontend/src/js/config.js)
- [desktop.js](../../frontend/src/js/desktop.js)
- [main.js](../../frontend/src/js/main.js)

Vấn đề:

- Hiện có ba nguồn trộn lẫn:
  - runtime config
  - localStorage browser config
  - desktop bridge config
- Logic trang kiểm tra `desktopMode` ở khắp nơi

Tiến độ hiện tại:

- Đã thêm [desktop-host.js](../../frontend/src/js/desktop-host.js), do nó nhận diện thống nhất `retainPdfDesktop`, và chỉ giữ lại `__TAURI_INTERNALS__` tương thích shim.
- [config.js](../../frontend/src/js/config.js) không còn phát hiện trực tiếp tên cầu cũ, gọi desktop thống nhất từ host trừu tượng.

Đề xuất tiếp theo:

- Có thể tiếp tục thu các luồng đặc trưng desktop như “khởi động lần đầu/lưu cấu hình” trong `desktop.js` thêm một tầng host.
- Lớp UI chỉ đọc khả năng, không đọc trực tiếp sự khác biệt host.

### 8. Khối lượng kiểu dáng tập trung vào một tệp, ranh giới thành phần không rõ

Tệp:

- [components.css](../../frontend/src/styles/components.css)

Vấn đề:

- Một tệp khoảng `1747` dòng
- dialog, topbar, hero, bảng nhà phát triển, khu vực trạng thái, danh sách sự kiện đều trộn lẫn

Đề xuất:

- Ít nhất chia theo khu vực:
  - `layout.css`
  - `dialogs.css`
  - `job-status.css`
  - `developer-panel.css`
  - `recent-jobs.css`

## P2: Đề xuất về trải nghiệm và chuẩn kỹ thuật

### 9. `node_modules` không nên có trong kho

Tệp:

- `frontend/node_modules`

Vấn đề:

- Hiện kho chứa toàn bộ thư mục phụ thuộc, khoảng `16M`

Đề xuất:

- Thành viên frontend xóa và xác nhận `.gitignore` có hiệu lực.
- Chỉ giữ:
  - `package.json`
  - `package-lock.json`

### 10. Hiện chưa có kiểm thử frontend và lint cơ bản

Tệp:

- [package.json](../../frontend/package.json)

Vấn đề:

- Chỉ có:
  - `build:css`
  - `watch:css`
- Không có:
  - `lint`
  - `test`
  - `format`

Đề xuất:

- Bổ sung tối thiểu:
  - ESLint
  - Prettier
  - 1~2 bài kiểm thử hàm thuần túy cơ bản, trước tiên phủ [job.js](../../frontend/src/js/job.js) các hàm normalize/summarize

## Thứ tự tối ưu đề xuất

### Giai đoạn một: Thu gọn rủi ro thấp

- Xóa mật khẩu nhà phát triển mã hóa cứng frontend
- Xóa `node_modules`
- Chuyển danh sách tác vụ gần đây / luồng sự kiện / stage history từ nối `innerHTML` sang render DOM
- Tách `main.js`, ít nhất tách thành ba mô-đun: gửi, polling, tác vụ gần đây

### Giai đoạn hai: Quản lý cấu trúc

- Thêm store nhẹ, thu gọn `state`
- Tách nguồn cấu hình, cách ly sự khác biệt host browser/desktop
- Thu hẹp trách nhiệm “lớp tương thích” của [job.js](../../frontend/src/js/job.js)

### Giai đoạn ba: Bổ sung kỹ thuật

- Tách tệp kiểu
- Thêm lint / format / kiểm thử tối thiểu
- Rồi mới quyết định có nên sử dụng framework hay không

## Kết luận cho thành viên frontend

Frontend hiện tại không phải “hiệu suất kém”, mà là “cấu trúc lỏng lẻo”.

Điều cần làm trước nhất không phải thay framework, mà là:

1. Tách [main.js](../../frontend/src/js/main.js)
2. Thu gọn `state` trần
3. Chuyển các khu vực tần suất cao từ `innerHTML` sang render DOM ổn định
4. Xóa các xác thực giả và sự khác biệt host trong frontend

Đến bước này, dù tiếp tục viết JS gốc hay chuyển sang React/Vue, chi phí đều sẽ thấp hơn nhiều.
