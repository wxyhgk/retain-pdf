# home/composition

Tầng lắp ráp trang chủ. **Chỉ đấu nối, không viết nghiệp vụ.**

Đối chiếu kép features (`js/features` vs `pages/home/features`) xem **`src/FEATURES.md`**.

## Quy tắc (bắt buộc đọc khi bảo trì sau này)

1. **`external.ts` là lối vào duy nhất của trang chủ đến `src/js/*` (tầng features)**  
   - `pages/home/features/**` **cấm** import trực tiếp bất kỳ `src/js/**`; luôn `from "../composition/external.js"` (độ sâu tự điều chỉnh).  
   - Nhà máy miền (`create-*.ts`) cũng nên qua `./external.js`, đừng mở thêm `../../../js/…`.  
   - Kiểu port/store trong `composition/types.ts` cũng lấy từ `./external.js`.  
   - Thiếu ký hiệu chỉ sửa `external.ts`; cổng xem `tests/architecture-boundaries.test.mjs`.  
   Mã nguồn đã toàn bộ TS; đường dẫn import vẫn có thể viết `.js` (esbuild / test loader ánh xạ sang `.ts/.tsx`).

2. **Nhà máy trả về bag, không viết `ctx` khả biến**  
   `createXxx(...)` trả về sản phẩm riêng; `composition.js` gán rõ ràng vào `features` / `domains`.

3. **`features` là bảng đăng ký khả biến duy nhất**  
   Ràng buộc muộn (A lắp ráp thì B chưa tạo) đọc qua `features.xxx`, sau khi lắp ráp xong mới gọi.

4. **Runtime treo đầy đủ một lần**  
   `job-runtime` / `recent-jobs` / `artifact-downloads` tạo ở giai đoạn composition, không đưa vào `if (!feature)` treo lười trong `initialize`.

5. **Thứ tự đăng ký sự kiện có hợp đồng**  
   `workflowDialog.bindEvents()` phải trước `mountRecentJobsFeature`  
   (khi `closeTranslationWorkflow` cần ghi DOM `data-open` trước, recent-jobs mới có thể `scheduleRefresh`).

## Tệp

| Tệp | Trách nhiệm |
|------|------|
| `../composition.js` | Lối vào đấu nối tuần tự |
| `external.js` | Barrel phụ thuộc ngoài |
| `create-bridge.js` | Cầu callback 3b |
| `create-workflow-upload.js` | workflow + upload |
| `create-credentials.js` | Thông tin xác thực |
| `create-glossaries-app-update.js` | Bảng thuật ngữ + cập nhật |
| `create-status-domain.js` | statusCard / detail / reader |
| `create-library-domain.js` | library / recent-jobs ports / collections |
| `create-app-actions.js` | Gửi tác vụ |
| `create-runtime-features.js` | job-runtime / recent-jobs / artifacts |
| `create-lifecycle.js` | initialize / dispose |
| `build-home-services.js` | Bag HomeServices đối ngoại |
