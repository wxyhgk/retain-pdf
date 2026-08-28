# Hướng dẫn yêu cầu biểu tượng / hiệu ứng RetainPDF

**Mục đích:** Cung cấp cho bạn (hoặc nhà thiết kế) danh sách các hạng mục cần xuất; sản phẩm sẽ dần thay thế SVG khung dây Lucide hiện có và đường dẫn nội tuyến.  
**Ngày:** 2026-07-21  
**Phong cách tham khảo:** Nhẹ nhàng, sản phẩm đọc sách, thiên về Apple / công cụ học thuật — **đường nét mảnh, góc bo tròn, ít trang trí**; màu chính theo giao diện người dùng (`currentColor`), không cố định khối màu đen lớn.

---

## 1. Quy ước bàn giao (vui lòng xuất theo)

### 1.1 Biểu tượng tĩnh (đường nét giao diện người dùng)

| Hạng mục | Yêu cầu |
|----|------|
| Định dạng | Ưu tiên **SVG** (vector); có thể kèm bản xem trước PNG 24/48/96 |
| Khung vẽ | **24×24** viewBox (thống nhất); mục nhập quan trọng có thể xuất thêm biến thể **32×32 / 48×48** |
| Nét vẽ | Độ dày thị giác **1.6–2.0**, mũi tròn (round) |
| Màu sắc | **Đơn sắc**, sử dụng `currentColor` / `#000` để vẽ nét, chúng tôi sẽ đổi màu trong CSS |
| Lề | Để khoảng an toàn khoảng **2px** xung quanh hình, tránh cắt sát mép |
| Đặt tên | Chữ thường, dạng kebab-case, xem tên tệp bên dưới |
| Vị trí | Sau khi hoàn thành, đặt vào `deliverables/` của thư mục này (bạn có thể tự tạo), ví dụ: `docs/icon-design/deliverables/nav-library.svg` |

### 1.2 Biểu tượng động (tùy chọn, điểm cộng)

| Hạng mục | Yêu cầu |
|----|------|
| Định dạng | Ưu tiên **Lottie JSON** (dự án đã có lottie-web) hoặc **APNG / WebM vòng lặp ngắn** |
| Thời lượng | Vòng lặp **1–2s**; loại đang xử lý có thể dài hơn |
| Kích thước | Logic xuất **64×64 hoặc 128×128**, nền trong suốt |
| Đặt tên | `anim-<công dụng>.json`, ví dụ `anim-processing.json` |
| Lưu ý | Tránh hạt quá nặng; sẽ hiển thị rất nhỏ trong thẻ trạng thái |

### 1.3 Hiệu ứng hiện có (có thể thay thế, không cần làm lại ngoài danh sách)

Lottie hiện có trong `frontend/src/assets/animations/`:

| Tệp | Công dụng (giai đoạn đường ống) |
|------|------------------|
| `pdf_upload_Lottie.json` | Tải lên |
| `ocr_Lottie.json` | OCR |
| `deepseek_lottie.json` | Dịch (mô hình) |
| `typst_rendering.json` | Sắp xếp / Kết xuất |
| `pdf_download_Lottie.json` | Tải xuống / Đầu ra |

Nếu bạn muốn hiệu ứng "đẹp hơn", ưu tiên thay 5 cái này + **P0 động** bên dưới.

---

## 2. Tổng quan ưu tiên

| Ưu tiên | Giải thích |
|--------|------|
| **P0** | Nhìn thấy hàng ngày: Tab trên cùng, thanh dưới cùng, chế độ đọc/đóng/FAB, huy hiệu trạng thái thẻ |
| **P1** | Thao tác trên kệ sách, thanh công cụ, trạng thái trống, mục nhập cài đặt |
| **P2** | Toast / đóng hộp thoại chung, trang trí chi tiết |

---

## 3. P0 — Phải làm trước (điều hướng + trình đọc)

### 3.1 Tab trên cùng trang chủ (bộ ba, phong cách thống nhất)

| Tên tệp gợi ý | Ý nghĩa | Văn bản giao diện | Hình dạng hiện tại | Kích thước |
|------------|------|----------|--------------|----------|
| `nav-library.svg` | Thư viện / Kệ sách | Thư viện | Các gáy sách xếp cạnh nhau | 16–18px nội tuyến |
| `nav-collections.svg` | Bộ sưu tập / Đống sách trong thư mục | Bộ sưu tập | Xếp chồng nhiều lớp | Như trên |
| `nav-favorites.svg` | Yêu thích / Trích đoạn đánh dấu | Yêu thích | Dấu trang | Như trên |

**Gợi ý thiết kế:** Ba mục xếp cạnh nhau trong viên thuốc màu trắng; trạng thái được chọn sẽ có nét trắng, **vui lòng đảm bảo rõ nét trên nền tối**.

### 3.2 Thanh dưới cùng trang chủ

| Tên tệp | Ý nghĩa | Văn bản | Hình dạng hiện tại |
|--------|------|------|------|
| `action-add-pdf.svg` | Thêm / Tải lên PDF | Thêm PDF | Dấu **+** đậm |
| `action-settings.svg` | Cài đặt | Cài đặt | Bánh răng |

Tùy chọn: `action-search.svg` (trang trí bên trái hộp tìm kiếm, hiện tại là input thuần).

### 3.3 Chế độ thanh trên cùng trình đọc (bộ ba)

| Tên tệp | Ý nghĩa | Văn bản | Lucide hiện tại |
|--------|------|------|-------------|
| `reader-mode-source.svg` | Một cột gốc | Bản gốc | FileText |
| `reader-mode-translated.svg` | Một cột dịch | Bản dịch | Languages |
| `reader-mode-compare.svg` | Đối chiếu trái phải | Đọc đối chiếu | Columns2 |

### 3.4 Thao tác trình đọc

| Tên tệp | Ý nghĩa | Văn bản / Tình huống | Hình dạng hiện tại |
|--------|------|-------------|------|
| `reader-close.svg` | Đóng / Về trang chủ | Đóng | X |
| `reader-fab.svg` | Biểu tượng chính của nút công cụ nổi | Menu công cụ | Dạng menu / chấm |
| `reader-notes.svg` | Danh sách ghi chú | Ghi chú | StickyNote |
| `reader-download.svg` | Điểm vào tải xuống | Tải xuống | Download |
| `reader-download-source.svg` | Tải PDF gốc | Bản gốc | FileText |
| `reader-download-translated.svg` | Tải PDF dịch | Bản dịch | Languages |
| `reader-download-compare.svg` | Tải PDF đối chiếu | Đối chiếu | Columns2 |
| `reader-note-add.svg` | Thêm ghi chú cho vùng ch��n | Thêm ghi chú | StickyNote |
| `reader-shortcuts.svg` | Trợ giúp phím tắt | Phím tắt | Keyboard |

### 3.5 Huy hiệu trạng thái thẻ kệ sách (nhỏ, 11–14px)

| Tên tệp | Ý nghĩa | Hướng văn bản trạng thái | Key hiện tại |
|--------|------|--------------|----------|
| `badge-archive.svg` | Chỉ lưu trữ / Chưa dịch | Kho lưu trữ | archive |
| `badge-translated.svg` | Đã dịch | Đã dịch | languages |
| `badge-processing.svg` | Đang xử lý | Đang tiến hành | loader (có thể xoay) |
| `badge-failed.svg` | Thất bại | Thất bại | alert |
| `badge-queued.svg` | Đang xếp hàng | Đang xếp hàng | clock |

**Ưu tiên động:** `anim-badge-processing.json` (thay thế loader spin CSS).

---

## 4. P1 — Kệ sách và trạng thái trống

| Tên tệp | Ý nghĩa | Vị trí xuất hiện |
|--------|------|----------|
| `shelf-continue-book.svg` | Chiếm chỗ ảnh bìa tiếp tục đọc | Thanh tiếp tục đọc |
| `shelf-empty-favorites.svg` | Chưa có yêu thích | Trạng thái trống tab Yêu thích |
| `shelf-empty-collection.svg` | Bộ sưu tập trống | Chồng bìa bộ sưu tập trống |
| `shelf-view-grid.svg` | Chế độ xem lưới | Thanh công cụ |
| `shelf-view-list.svg` | Chế độ xem danh sách | Thanh công cụ |
| `shelf-batch-select.svg` | Chọn hàng loạt | Thanh công cụ |
| `shelf-batch-delete.svg` | Xóa hàng loạt | Thanh hàng loạt |
| `shelf-batch-collection.svg` | Thêm vào bộ sưu tập | Thanh hàng loạt |
| `book-read.svg` | Đọc gốc / Mắt | Dòng danh sách, chi tiết |
| `book-compare.svg` | Đọc đối chiếu | Thao tác thẻ |
| `book-translate.svg` | Bắt đầu dịch | Chi tiết / Thẻ |
| `book-cover-fallback.svg` | Chiếm chỗ không có bìa | Bìa thẻ |
| `upload-lock.svg` | Cổng chưa có thông tin xác thực | Khu vực tải lên |
| `collection-manage.svg` | Quản lý bộ sưu tập | Bánh răng thẻ bộ sưu tập |

### Trung tâm cài đặt (Settings Hub ba cột)

| Tên tệp | Ý nghĩa |
|--------|------|
| `settings-api.svg` | Giao diện / Thông tin xác thực |
| `settings-glossary.svg` | Bảng thuật ngữ |
| `settings-about.svg` | Giới thiệu / Cập nhật |

---

## 5. P2 — Hệ thống và phản hồi

| Tên tệp | Ý nghĩa | Hình dạng hiện tại |
|--------|------|------|
| `toast-success.svg` | Thành công | CircleCheck |
| `toast-info.svg` | Thông tin | Info |
| `toast-warning.svg` | Cảnh báo | TriangleAlert |
| `toast-error.svg` | Lỗi | OctagonX |
| `toast-loading.svg` | Đang tải (có thể động) | Loader2 spin |
| `dialog-close.svg` | Đóng hộp thoại | X |

---

## 6. Danh sách "động" ưu tiên

Nếu thời gian có hạn, chỉ làm động những cái này:

| Tên tệp | Tình huống | Giải thích |
|--------|------|------|
| `anim-processing.json` | Thẻ đang xử lý / Thẻ trạng thái | Xoay nhẹ hoặc vòng tiến trình, có thể lặp |
| `anim-upload.json` | Đang tải lên | Có thể thay `pdf_upload_Lottie.json` |
| `anim-ocr.json` | Giai đoạn OCR | Có thể thay `ocr_Lottie.json` |
| `anim-translate.json` | Giai đoạn dịch | Có thể thay `deepseek_lottie.json` |
| `anim-render.json` | Giai đoạn sắp xếp | Có thể thay `typst_rendering.json` |
| `anim-download.json` | Đang/hay tải xuống hoàn tất | Có thể thay `pdf_download_Lottie.json` |
| `anim-empty-favorites.json` (tùy chọn) | Trạng thái trống yêu thích | Dấu trang nhẹ nhàng, không ồn ào |

---

## 7. Gợi ý thống nhất thị giác

1. **Cùng một bộ nét**: Toàn bộ 24 khung vẽ, nét gần giống nhau.  
2. **Hình dạng nhóm ngữ nghĩa**:  
   - Sách / Trang → Hình chữ nhật bo tròn + góc gấp  
   - Dịch → Văn bản / A hoặc bong bóng hai ngôn ngữ  
   - Đối chiếu → Hai cột  
   - Yêu thích → Dấu trang (không dùng hình trái tim, tránh nhầm với "thích")  
3. **Màu trạng thái do giao diện người dùng tô màu**: Bản thân biểu tượng đơn sắc; thất bại/thành công do nền huy hiệu bên ngoài thể hiện.  
4. **Hiệu ứng tiết chế**: Tránh nhấp nháy trong tình huống đọc; khi `prefers-reduced-motion`, chúng tôi sẽ dừng hiệu ứng, vui lòng đảm bảo khung hình tĩnh vẫn dễ hiểu.

---

## 8. Cấu trúc thư mục bàn giao (vui lòng đặt tệp theo đây)

```
docs/icon-design/
  ICON_BRIEF.md          ← Hướng dẫn này
  deliverables/
    svg/
      nav-library.svg
      nav-collections.svg
      ...
    lottie/
      anim-processing.json
      ...
    preview/             ← Tùy chọn: ghép một PNG/PDF tổng quan để tiện đánh giá
```

Sau khi hoàn thành, hãy thông báo cho tôi các tệp đã sẵn sàng, tôi có thể kết nối theo tên tệp vào `frontend/src/assets/icons/` và thay thế Lucide / SVG nội tuyến trong mã.

---

## 9. Gói khởi động tối thiểu (nếu chỉ muốn làm 12 cái trước)

Theo thứ tự độ phơi sáng sản phẩm, **làm 12 cái này trước** là đủ để thay đổi diện mạo:

1. `nav-library`  
2. `nav-collections`  
3. `nav-favorites`  
4. `action-add-pdf`  
5. `action-settings`  
6. `reader-mode-source`  
7. `reader-mode-translated`  
8. `reader-mode-compare`  
9. `reader-close`  
10. `reader-notes`  
11. `badge-processing` (+ tùy chọn `anim-processing`)  
12. `badge-translated`  

Các mục còn lại có thể gửi đợt sau.

---

## 10. Hiện trạng phía mã (để bạn đối chiếu, không cần sửa)

- Trình đọc: nhiều `lucide-react` (ModeTabs / Fab / Close / Selection).  
- Trang chủ: nhiều `<svg>` nội tuyến (TopTabs / BottomBar / Badge / Toolbar).  
- Thương hiệu: `frontend/src/assets/RetainPDF-logo.svg` (Logo tính riêng, không nằm trong phạm vi bắt buộc của danh sách này).  
- Hiệu ứng giai đoạn: Lottie xem §1.3.

Nếu có vấn đề, bạn có thể thêm `notes.md` bên cạnh `deliverables/` ghi rõ tên hoặc biến thể của bạn.
