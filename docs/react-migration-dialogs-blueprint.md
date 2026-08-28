# Phase 3: Bản thi công nhóm hộp thoại (StatusDetail / Credentials / Glossaries / ReaderDialog / AppUpdate / developer / artifact-downloads)

> Kết hợp với kế hoạch tổng thể ~/.claude/plans/wondrous-baking-donut.md, docs/react-migration-recent-jobs-blueprint.md,
> docs/react-migration-legacy-audit.md. Không lặp lại phạm vi blueprint của recent-jobs.

## 0. Phát hiện toàn cục (bảy miền chia sẻ, bắt buộc đọc trước khi thi công)

1. Hằng số dom-contract (STATUS_DETAIL_DIALOG/CREDENTIAL_DOM_IDS/GLOSSARY_DOM_IDS/READER_DIALOG_IDS/APP_UPDATE_IDS) giữ nguyên, dùng trực tiếp làm JSX id — đường cơ sở thị giác nhấp chính xác theo id, cổng kiểm tra khẳng định theo hằng số, **không được đổi tên/không đổi CSS Modules**.
2. **Ngữ nghĩa `<dialog>` gốc phải được giữ** (showModal()/close()). `app-shell/view.js:bindDialogBackdropClose` gọi getElementById một lần cho id cố định — nếu hộp thoại "chỉ gắn khi mở" sẽ vĩnh viễn hỏng. **Đối sách: 5 hộp thoại được gắn thường trực (tồn tại từ entry), useEffect điều khiển showModal/close dựa trên open, có backdrop-close onClick riêng, không phụ thuộc vào bindDialogBackdropClose cũ.**
3. Trạng thái mở/đóng xuyên cây con: thêm `src/pages/home/state/dialog-store.js` factory chung `createDialogStore()` (open(payload)/close()/subscribe/getState), mỗi hộp thoại một instance, tham khảo mô hình drawer-store.js của reader.
4. **`AppSettingsDialog` là vỏ của ba tab** (cài đặt API / từ vựng / cập nhật), các nút bên trong mở Credentials/Glossaries/AppUpdate. Đề xuất phân loại: hợp nhất vào bên nhận thầu CredentialsDialog, đặt tên `SettingsHubDialog.jsx`.
5. **Rủi ro artifact-downloads**: ủy nhiệm nhấp cấp document + `setLinkBusy` thay đổi DOM trực tiếp, máy chủ nút nằm trong ResultActions.jsx của recent-jobs và StatusDetailDialog của blueprint này. Nếu thành phần cha render lại do thay đổi store sẽ ghi đè văn bản "đang tải...". **Đề xuất phương án hai**: thêm `artifact-download-busy-store.js`, các nút tự đăng ký theo actionId của mình (xem §7.5).
6. APP_EVENTS: openBrowserCredentials (Credentials), refreshGlossaries (Glossaries), openReaderRequested (ReaderDialog, được dispatch bởi React island library-search hiện có). Tất cả được tiêu thụ qua useAppEvent(name, handler), tên sự kiện không đổi.

## 1. StatusDetailDialog (1.511 dòng / 18 tệp)

- **Nguồn dữ liệu độc lập**: chạy song song với statusCardStore của blueprint recent-jobs, không hợp nhất — status-detail tự fetch (events/diagnostics/resumePlan), StatusCard không cần các trường này. Cả hai chia sẻ cùng một điểm chèn callback renderJob.
- Kích hoạt mở: `#status-detail-btn` trong ResultActions.jsx onClick gọi trực tiếp `openStatusDetailDialog("overview")` (không phải sự kiện, gọi hàm trực tiếp).
- **Điểm quyết định**: controller.js / overview-coordinator / translation-tab-coordinator / translation-data-port / resume-actions / formatters (phần thuần định dạng) / status-detail/{snapshot,utils,history,events} (phần thuần hàm) tất cả **giữ nguyên**; translation-renderer.js / navigation-view-port.js / dialog-view-port.js / translation-view-port.js / resume-view-port.js / view.js **chết**; components/dialogs/status-detail-dialog*.js 6 tệp chết (chỉ giữ hằng STATUS_DETAIL_DIALOG).
- **markup→JSX là khối lượng viết lại lớn nhất trong miền này** (ba chỗ history.js/events.js/translation-renderer.js ghép chuỗi HTML → JSX có cấu trúc), chạy từng đoạn theo đường cơ sở thị giác, không thể làm một lần.
- Store mới: `status-detail-store.js` (phần overview + translation) + `status-detail-dialog-store.js` (open/activeTab).
- Thành phần: StatusDetailDialog.jsx (4 tab render thường trực dùng thuộc tính hidden, không gỡ bỏ), StageHistoryList/EventsList (viết JSX có cấu trúc mới), họ TranslationDebugTab, useRerunAction.
- Nghiệm thu: hai đường cơ sở thị giác status-dialog-failed / status-dialog-translation (ngưỡng cutover).

## 2. CredentialsDialog (1.673 dòng / 22 tệp, tính năng đơn lớn nhất toàn dự án)

- **Singleton của `default-state-port.js` phải được tái sử dụng nguyên bản** (không xây dựng lại) — tác dụng phụ mirrorToDom của nó đồng bộ 4 input ẩn (ocr_provider/mineru_token/paddle_token/api_key), các input này được biểu mẫu tải lên của 3a đọc. **Điểm rủi ro cao nhất: composition nếu mỗi miền xây dựng một input ẩn riêng sẽ dẫn đến lỗi im lặng "điền token trong cài đặt, tải lên không đọc được".**
- Quyết định: state.js / default-state-port.js / hidden-input-dom-port.js / selectors-port.js / validation.js / deepseek-flow.js / ocr-readiness-flow.js / persistence.js / dialog-values.js **giữ nguyên**; browser-view-port.js / deepseek-view-port.js / view.js / dialog-sync.js / dialog-elements-port.js / setup-mode-port.js **chết**.
- `updateCredentialGate` (trạng thái khóa nút tải lên) đề xuất **chuyển toàn bộ cho 3a**, miền này chỉ expose đăng ký chỉ đọc.
- `developer-auth-dialog.js` **được xác định là mã chết (thành phần mồ côi)**: ngoài đăng ký của chính nó và tham chiếu danh sách APP_DIALOG_BACKDROP_IDS, toàn bộ kho mã không có bất kỳ kết nối logic mở/kiểm tra nào. **Đề xuất xác nhận với người dùng/sản phẩm trước khi xóa trong Phase 4**, không lặng lẽ vứt bỏ (có thể là yêu cầu dự trữ).
- Đề xuất thực hiện kèm theo SettingsHubDialog.jsx §0.4 và factory dialog-store §0.3 (tái sử dụng cho các miền khác).

## 3. GlossariesDialog (533 dòng)

- Các hàm nghiệp vụ controller.js (reload/select/save/delete/export/applyImport) giữ nguyên, chuyển state từ đối tượng biến đổi sang glossaries-store.js.
- Bảng entries từ thao tác DOM mệnh lệnh chuyển sang mảng có cấu trúc + map — **khi level==="preserve" ngữ nghĩa cũ để target trống và điền lại source phải được giữ nguyên**.
- `refreshWorkflowGlossaries({force, selectedId})` là phụ thuộc callback vào miền workflow của 3a (gọi ngược), composition cần đợi miền workflow sẵn sàng; tham số mặc định giữ lệnh gọi tùy chọn (no-op dự phòng).

## 4. ReaderDialog iframe host (919 dòng, mức độ rủi ro cao)

- **Hợp đồng postMessage phải được kiểm tra từng byte**: type `"retainpdf-reader-progress"`, các trường `{type,percent,text,stage}`, `stage==="ready" && percent>=100` → 180ms sau ẩn; kiểm tra nguồn `isTrustedWindowMessage(event, frameWindow)` không đổi. Đã đối chiếu với đầu gửi src/pages/reader/entry.jsx của Phase2b.
- `reader-embedded` body class đã được xử lý bởi phía reader Phase2b, phía host không cần hành động, chỉ cần tiếp tục dùng `<iframe>` thực.
- **Xác định mã chết của nút tải xuống cần kiểm tra khi chạy**: READER_DIALOG_BUTTON_IDS tương ứng với nút tải xuống phía host không tồn tại trong mẫu hiện tại (đã được ReaderDownloadMenu.jsx của Phase2b thay thế hoàn toàn), bốn hàm handleSourceDownload... trong controller.js nghi là mã chết — **đề xuất agent chạy thử một lần mở reader-dialog trong mock để xác nhận trước khi quyết định cắt bỏ**.
- **Chuyển đổi iframe src phải xử lý bằng ref mệnh lệnh** (setAttribute/removeAttribute), không dùng thuộc tính src khai báo JSX (rủi ro trường hợp biên React diff).
- Đề xuất một agent riêng, theo sau Credentials/StatusDetail, không chạy song song với các miền khác (dễ xung đột cửa sổ liên kết).

## 5. AppUpdateBanner (491 dòng)

- Hoàn toàn khép kín, bộ nhớ cache localStorage TTL 24h + kiểm tra tự động nền.
- **Hai DOM thuộc hai host khác nhau** (nút trong tab "Cập nhật" của SettingsHubDialog, hộp thoại chi tiết hiện nằm trong app-shell-header.js) — Đề xuất React hóa: hợp nhất vào cùng AppUpdateBanner.jsx, đặt trong tab "Cập nhật" của SettingsHubDialog, cần xác nhận với 3a rằng AppShellHeader không còn mẫu update-dialog (nếu không sẽ vi phạm cổng kiểm tra do trùng id).

## 6. Bảng developer (133 dòng, hầu như không thể thi công độc lập)

- **Phụ thuộc mạnh vào miền workflow của 3a**: các trường biểu mẫu (mô hình / luồng công việc / tham số đồng thời) đọc/ghi hoàn toàn từ workflowPorts, bản thân miền developer chỉ có kích hoạt easter egg (chuỗi phím "bbpp") + chuyển tab + mở hộp thoại.
- Logic easter egg (loại trừ mục tiêu phần tử biểu mẫu + khớp cửa sổ trượt 4 ký tự) cần được di chuyển nguyên bản thành hook useDeveloperEasterEgg(), lưu ý StrictMode effect idempotent/cleanup (lắng nghe document keydown toàn cục duy nhất).
- **Đề xuất không thành lập dự án riêng, nhập vào bên nhận thầu workflow hoặc làm nhiệm vụ nhỏ cuối cùng sau khi workflow hoàn thành**.

## 7. artifact-downloads (264 dòng)

- Không có thành phần hiển thị độc lập, là hook hành vi gắn ở gốc composition: useArtifactDownloadsBinding().
- 7 id cố định (#download-btn/#markdown-bundle-btn/#status-markdown-bundle-btn/#source-pdf-btn/#pdf-btn/#markdown-btn/#markdown-raw-btn) phân bố trong ResultActions.jsx của recent-jobs và StatusDetailDialog.
- **Phương án hai (khuyến nghị)**: sửa setLinkBusy thành artifact-download-busy-store.js, các nút tự đăng ký theo actionId của mình. Cần thương lượng giao diện với bên nhận thầu blueprint recent-jobs — nếu họ không muốn sửa, quay lại phương án một (ResultActions bọc React.memo, props chỉ chứa enabled/url, không chứa trường tần suất cao).

## 8. Ma trận phụ thuộc và đề xuất phân tách agent

| Miền | Phụ thuộc (đọc) | Bị phụ thuộc (ghi/khớp nối) |
|---|---|---|
| StatusDetailDialog | job-runtime giữ state engine (không phải statusCardStore) | ResultActions cần gọi openStatusDetailDialog |
| CredentialsDialog | Không | 3a HeroUpload đọc input ẩn + nút đến cài đặt cần open() |
| GlossariesDialog | Không | callback refreshWorkflowGlossaries của workflow 3a (gọi ngược); dropdown bảng thuật ngữ của developer |
| ReaderDialog | Đầu gửi postMessage Phase2b (hợp đồng chỉ đọc) | nút "Đọc đối chiếu" trên card recent-jobs; sự kiện library-search island |
| AppUpdateBanner | Không | 3a AppShellHeader cần loại bỏ mẫu cũ |
| developer | Phụ thuộc mạnh vào workflow 3a | Không |
| artifact-downloads | Không | recent-jobs và các nút tải của blueprint này cần gắn đúng id (+đăng ký phương án hai) |

**Đề xuất 4 agent thực hiện**:
1. CredentialsDialog (+ vỏ SettingsHubDialog + đế dialog-store) — lớn nhất, tự nhất quán, ưu tiên.
2. GlossariesDialog + AppUpdateBanner hợp nhất (khối lượng nhỏ, chia sẻ host SettingsHubDialog).
3. StatusDetailDialog (+ phương án một artifact-downloads dự phòng, tùy thuộc vào việc bên nhận thầu recent-jobs có chấp nhận phương án hai hay không).
4. ReaderDialog riêng (khối lượng nhỏ nhưng rủi ro cao, theo sát sau 1/3, không song song với các miền khác).
Bảng developer thuộc về giai đoạn kết thúc workflow, không thành lập dự án riêng.

**Điều kiện tiên quyết quan trọng: 4 miền của blueprint này khớp nối mạnh với 3a (app-shell/upload/workflow)** (chia sẻ input ẩn, điểm kích hoạt nút đến cài đặt, vị trí mẫu AppShellHeader, callback refreshWorkflowGlossaries) — **phải đợi 3a hoàn thành mới giao việc**, nếu không giao diện không khớp sẽ phải làm lại.

## Tệp chính
- src/js/components/dialogs/status-detail-dialog-dom-contract.js
- src/js/features/status-detail/controller.js
- src/js/features/credentials/default-state-port.js
- src/js/features/reader-dialog/controller.js
- src/pages/reader/entry.jsx (đầu gửi postMessage để đối chiếu)
- src/pages/reader/state/drawer-store.js (tham khảo mô hình dialog-store)
- src/shared/react/use-store.js
