# Hướng dẫn giao biểu tượng (ghi chú)

## Thông số kỹ thuật

- Bảng vẽ: tất cả `viewBox="0 0 24 24"`, biên an toàn đồ họa khoảng 2px
- Nét vẽ: đầu tròn/góc tròn (round); **bộ chính 1.8**, các biểu tượng huy hiệu (`badge-*`) và `action-add-pdf` dùng **2.0** (rõ hơn ở kích thước nhỏ)
- Màu: đơn sắc `currentColor`, không có giá trị màu cố định; một số yếu tố trang trí nhỏ (lưới FAB, phím bàn phím, tam giác phát, ngôi sao, lỗ khóa, chấm tròn dấu chấm than) dùng `fill="currentColor"` đặc
- Nền tối: đã kiểm tra với nền trắng/tối trong `preview/index.html`

## Mối quan hệ tái sử dụng (cùng hình khác tên, mỗi tên một file theo danh sách)

| Hình giống nhau | File |
|----------|------|
| Tài liệu + góc gập | `reader-mode-source` = `reader-download-source` |
| Chữ A | `reader-mode-translated` = `reader-download-translated` = `book-translate` (`badge-translated` cùng hình nhưng nét 2.0) |
| Hai cột | `reader-mode-compare` = `reader-download-compare` = `book-compare` |
| Bánh răng | `action-settings` = `collection-manage` |
| Vòng tròn i | `settings-about` = `toast-info` |
| Cảnh báo tam giác | `badge-failed` (2.0) = `toast-warning` (1.8) |
| Cung tròn xoay | `badge-processing` (2.0) = `toast-loading` (1.8) |
| Dấu X | `reader-close` = `dialog-close` |

Nếu sau này muốn thay đổi hình dáng của một chỗ nào đó, lưu ý đồng bộ các file cùng họ, hoặc chuyển sang tham chiếu cùng một file.

## Mô tả từng biểu tượng

- `nav-library`: hai cuốn đứng + một cuốn nghiêng (11°) + kệ sách dưới cùng
- `nav-collections`: ba cuốn sách xếp chồng (dưới rộng trên hẹp)
- `nav-favorites`: dấu trang (không dùng hình trái tim, tuân §7)
- `reader-fab`: lưới 3×3 chấm đặc (cảm giác menu, tuân theo gợi ý danh sách)
- `reader-notes` / `reader-note-add`: ghi chú góc dưới bên phải, cái sau có dấu cộng bên trong
- `badge-processing`: cung 288°, CSS `transform: rotate` xoay quanh tâm để thành loading
- `shelf-empty-favorites`: dấu trang + ngôi sao nhỏ (trang trí trạng thái rỗng)
- `shelf-empty-collection` / `shelf-batch-collection`: thư mục / thư mục + dấu cộng
- `settings-api`: chìa khóa (thông tin xác thực); `settings-glossary`: cuốn sách mở; `settings-about`: vòng tròn i

## Lottie

- `anim-processing.json`: 64×64, 30fps, 60 khung (vòng lặp 2s), cung 288° xoay đều
- Màu xám trung tính `#6B7280` (trong JSON là `c.k`, lottie không thể dùng trực tiếp currentColor, khi tích hợp có thể đổi màu theo nhu cầu)
- Khung hình đầu tiên tĩnh có thể đọc được (cung khuyết), `prefers-reduced-motion` dừng khung không vấn đề

## Xem trước

- `preview/index.html`: tổng quan tất cả SVG ở 16/24/48px, nền trắng/tối (được tạo bởi `build_preview.py` ở thư mục gốc)
- `preview/contact-sheet.png`: ảnh chụp màn hình của trang trên
- `preview/anim-processing-frames.png`: ảnh chụp khung thứ 0/15/30 của Lottie
