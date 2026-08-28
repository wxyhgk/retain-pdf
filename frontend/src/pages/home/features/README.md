# `pages/home/features` — Miền tính năng React trang chủ

**UI / view-store / hộp thoại** trang chủ đặt tại đây.  
Miền mệnh lệnh (`mount*`, thăm dò, ports) nằm ở **`src/js/features`**, kết nối qua `../composition/external.ts`.

Đối chiếu kép đầy đủ xem **`src/FEATURES.md`**.

## Thư mục

| Miền | Mô tả |
|----|------|
| `library/` | Kệ sách, chi tiết sách, actions thẻ (xem [library/README.md](./library/README.md)) |
| `collections/` | Bộ sưu tập / phân loại liên quan |
| `upload/` | React store / view vùng tải lên |
| `workflow/` | Runtime + UI hộp thoại luồng dịch |
| `status/` | Vùng trạng thái chính, store thẻ trạng thái |
| `status-detail/` | Store / controller hộp thoại chi tiết trạng thái |
| `credentials/` | UI cài đặt thông tin xác thực |
| `glossaries/` | UI bảng thuật ngữ |
| `app-update/` | Thanh cập nhật ứng dụng |
| `app-shell/` | Vỏ thanh dưới cùng |
| `reader/` | Store hộp thoại "Mở đọc" phía trang chủ (không phải trình đọc `pages/reader`) |
| `settings/` | Điều phối lối vào cài đặt |

## Quy tắc

1. **UI mới** ưu tiên đặt vào miền tương ứng trong thư mục này, đừng nhét vào `js/features`.
2. **Cần gọi `src/js/*` (gồm api / config / job-status / features…)**: **Cấm** trực tiếp `import … from "../../../../js/…"`. Luôn lấy từ `../composition/external.js` (điều chỉnh `../` theo độ sâu); khi thiếu ký hiệu **chỉ sửa** `composition/external.ts`. Cổng: `tests/architecture-boundaries.test.mjs`.
3. **Hợp đồng tiến độ library**: Mở hộp thoại workflow dùng `selectJob`; chỉ tiếp tiến độ không bật hộp thoại dùng `attachJobProgress` (xem library README).
4. Không liên quan đến **`pages/reader`**: Mã trang đọc nằm ở `pages/reader/**`.
