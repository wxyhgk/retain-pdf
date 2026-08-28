# Thư mục miền library

Chia thư mục theo **vai trò component**, tránh tất cả JSX trải phẳng một tầng.

| Thư mục | Chứa gì | Không chứa gì |
|------|--------|----------|
| **shell/** | Vỏ chung: `BookCard`, `BookListRow` | onClick nghiệp vụ, dữ liệu danh sách |
| **actions/** | Nhà máy nút thẻ: `read` / `translate` | Bố cục UI |
| **display/** | Hook bìa, huy hiệu | Sắp xếp trang |
| **page/** | Trang kệ sách: lưới, thanh công cụ, filter, viewPort | Hộp thoại chi tiết/bộ sưu tập |
| **categories/** | Tab bộ sưu tập | Lưới kệ sách |
| **detail/** | Container chi tiết + store + hooks | Vỏ thẻ |
| **detail/shell/** | `BookDetailShell` (mở/đóng Dialog / khe hai cột) | Logic nghiệp vụ |
| **detail/panels/** | Khu vực hạt mịn (bìa, biểu mẫu tiêu đề, bàn dịch…) | Lắp ghép Tab |
| **detail/tabs/** | Ba component Tab + vỏ điều hướng Tab | API miền |
| **detail/use-book-detail-*.js** | Hooks live item / document / translate | Component UI |
| **domain/** | `controller` (dịch/xóa/nhập kho/tiếp tiến trình im lặng…) | UI thuần túy |

### Hợp đồng lối vào tiến độ (dễ nhầm)

| Phương thức | Ai cung cấp | Làm gì |
|------|--------|--------|
| `selectJob(jobId)` | recent-jobs actions | **Mở hộp thoại workflow** + bắt đầu thăm dò |
| `attachJobProgress(jobId)` | **library domain/controller** | **Chỉ** bắt đầu thăm dò, nối vào statusCardStore; không bật hộp thoại, đóng vùng trạng thái chính |

Tab "Dịch" chi tiết sách chỉ dùng `attachJobProgress`.

Đối ngoại vui lòng dùng `import { … } from "./features/library/index.js"`.

```text
App
 └─ page/RecentJobsLibrary
       └─ shell/BookCard  +  actions/*
             └─ Nhấn mở → detail/BookDetailDialog (container)
                      └─ shell/BookDetailShell
                           ├─ left:  CoverActionsPanel
                           └─ right: BookDetailRightTabs
                                ├─ BookDetailOverviewTab   Giới thiệu sách
                                ├─ BookDetailTranslateTab  Dịch
                                └─ BookDetailMoreTab       Thao tác khác (gồm placeholder)
```
