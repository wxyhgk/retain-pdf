# Di chuyển React: Kiểm tra khả năng truy cập cây kế thừa (Đầu ra Phase 0)

Đối tượng kiểm tra: `src/js/job/` (14 tệp), `src/js/job-status/` (54), `src/js/status-detail/` (5).
Phương pháp: siêu dữ liệu esbuild từ ba điểm vào thực tế (app-bundle-entry.js / reader/index.js / job-detail/index.js) tính tập đạt tới + đồ thị import ngược + quét DOM API.

## Kết luận

| Cây | VM sống | Khung nhìn sống | Chỉ tham chiếu thử nghiệm | Mã chết | Tổng |
|---|---|---|---|---|---|---|
| job/ | 14 | 0 | 0 | 0 | 14 |
| job-status/ | 45 | 0 | 3 | 6 | 54 |
| status-detail/ | 5 | 0 | 0 | 0 | 5 |
| **Tổng** | **64** | **0** | **3** | **6** | **73** |

**Ba cây là lõi logic thuần túy cần được kế thừa nguyên vẹn trong quá trình di chuyển, không phải mã chết.** Tất cả các tệp đạt tới đều là view-model/adapter thuần, không có kết xuất DOM (các khung nhìn DOM nằm trong components/, ui/, job-detail/view.js, v.v.).

## Danh sách có thể xóa trong Phase 4 (9 tệp, tạo thành đồ thị con cô lập, xóa sạch cùng nhau)

**Có thể xóa vô điều kiện (6, không tham chiếu hoặc chỉ được tham chiếu bởi các tệp chết):**
- src/js/job-status/stage-presentation-event.js (gốc cụm)
- src/js/job-status/stage-presentation-fallback.js (hoàn toàn cô lập)
- src/js/job-status/stage-presentation-event-context.js
- src/js/job-status/job-stage-progress-strategy.js
- src/js/job-status/stage-progress-selection.js
- src/js/job-status/stage-progress-view-data.js

**Chỉ được tham chiếu bởi tests/job-stage-contract.test.mjs (dòng 10-12 import) (3):**
- src/js/job-status/canonical-stage-snapshot.js
- src/js/job-status/job-stage-event-selection.js
- src/js/job-status/main-lane-stage-selection.js

Việc xóa 3 tệp này cần xử lý đồng bộ với thử nghiệm đó; nếu giữ lại thử nghiệm thì giữ lại 3 tệp này.

## Ghi chú
- `job/action-model.js`, `job/artifacts.js` có đọc `window.location.href` được bảo vệ (xây dựng URL, không phải kết xuất DOM), được coi là VM sống; được mã sống tham chiếu nhiều, không nằm trong phạm vi xóa.
- Không có import() động nào từ bên ngoài trỏ tới 9 tệp trên (đã xác minh).
