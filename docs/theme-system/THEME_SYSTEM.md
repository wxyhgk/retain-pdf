# Hệ thống chủ đề giao diện RetainPDF (bản thiết kế)

**Trạng thái:** Thiết kế + hạ tầng đã triển khai; có thể chuyển đổi dùng thử giao diện "Sân vườn Giang Nam"  
**Ngày:** 2026-07-21  
**Mục tiêu:** Xây dựng một **kiến trúc giao diện có thể mở rộng**, sau đó dần thay thế màu cứng bằng token ngữ nghĩa.

---

## 1. Tại sao cần "hệ thống" thay vì chỉ đổi màu trực tiếp

Vấn đề hiện tại:

1. Giá trị màu thực sự nằm trong `tokens.css`, nhưng nhiều trang vẫn viết cứng `#1d1d1f` / `#f5f5f7` v.v.
2. Chỉ có duy nhất `:root`, không thể tồn tại song song hai phong cách "đen trắng tối giản" và "sân vườn Giang Nam".
3. Các biến shadcn (`--primary` v.v.) đã được ánh xạ đến token của dự án — **đổi giao diện chỉ cần đổi token nền**, tầng component có thể giữ nguyên.

Nguyên tắc:

> **Component chỉ nhận tên ngữ nghĩa (`--bg` / `--accent` / `--danger`…), giao diện chỉ chịu trách nhiệm gán giá trị cho tên ngữ nghĩa đó.**

---

## 2. Bảng màu ngữ nghĩa (không phụ thuộc giao diện, tên ổn định)

| Token | Vai trò | Ngữ nghĩa sản phẩm |
|-------|------|----------|
| `--bg` | Nền ứng dụng | Sân / mặt gạch xám |
| `--paper` | Thẻ / mặt giấy | Giấy tuyên, bề mặt nổi |
| `--surface` | Bề mặt kính mờ | Thanh trên, thanh dưới kính mờ |
| `--ink` | Văn bản chính / tương phản mạnh | Màu mực |
| `--muted` | Văn bản phụ | Mực nhạt |
| `--line` | Đường viền / phân cách | Khe gạch, đường nhạt |
| `--accent` | Nút chính / liên kết / tiêu điểm | **Màu đồng xanh / xanh thanh lương** |
| `--accent-weak` | Nền yếu khi chọn | Màu xanh nhạt |
| `--selection` | Trang hiện tại, tài liệu được chọn | Nền nhạt xanh lam (mới) |
| `--danger` | Lỗi / thao tác phá hủy / nhấn mạnh phê bình | Chu sa |
| `--danger-weak` | Nền yếu lỗi | Màu chu sa nhạt |
| `--ok` | Thành công | Có thể giữ xanh chức năng hoặc xanh rêu |
| `--warn` | Cảnh báo | Hổ phách |
| `--gold` | Mô hình cao cấp / trạng thái quan trọng | Mạ vàng (mới) |
| `--chrome` | Thanh trên màu tối / nền chế độ tối | Ngói đen (mới) |
| `--reader-page` | Nền trang PDF | Trắng ngà (mới, trình đọc) |

Tầng shadcn tiếp tục:

- `--background` ← `--bg`
- `--foreground` ← `--ink`
- `--primary` ← `--accent`
- `--destructive` ← `--danger`
- … (xem `shadcn-theme.css`)

**Cấm** giao diện thay đổi trực tiếp tên shadcn; chỉ thay đổi token ngữ nghĩa của dự án.

---

## 3. Danh sách giao diện

Giao diện tích hợp sẵn (đăng ký `THEME_REGISTRY`, Cài đặt → Giao diện hiển thị theo nhóm):

| id | Nhóm | Mô tả |
|----|------|------|
| `classic` | light | Mặc định đen trắng xám |
| `jiangnan` | accent | Gạch xanh · Giấy tuyên · Đồng xanh · Chu sa |
| `seacliff` | accent | Xanh mù sương mũi đá biển · Xanh đá biển |
| `night` | dark | Mái ngói đen (`html.theme-dark`) |

Thêm giao diện mới chỉ cần 3 bước, xem **[ADDING_A_THEME.md](./ADDING_A_THEME.md)**.

Chi tiết bảng màu Giang Nam: `skins/jiangnan.md`.

---

## 4. Cơ chế vận hành

### 4.1 Điểm gắn

```html
<html data-theme="jiangnan">  <!-- hoặc classic -->
```

CSS:

```css
:root,
[data-theme="classic"] { /* giá trị classic */ }

[data-theme="jiangnan"] { /* ghi đè token ngữ nghĩa */ }
```

### 4.2 Lưu trữ bền vững

- Key：`localStorage["retainpdf.theme"]` = `"classic" | "jiangnan" | ...`
- Khởi động: đọc storage sớm nhất có thể và ghi vào `<html data-theme>`, tránh FOUC  
  - Script: `frontend/src/shared/theme/boot-theme.js` (có thể nhúng inline hoặc import dòng đầu entry)

### 4.3 API chuyển đổi (mã)

```ts
import { getTheme, setTheme, listThemes } from "./shared/theme/theme";

setTheme("jiangnan"); // ghi storage + document.documentElement.dataset.theme
```

Trang cài đặt sau này chỉ cần thêm dòng "Giao diện" là kết nối được, không cần sửa component nghiệp vụ.

---

## 5. Bố cục tệp

```
docs/theme-system/
  THEME_SYSTEM.md          ← Bài viết này
  skins/
    jiangnan.md            ← Giải thích bảng màu Giang Nam (hướng thiết kế)

frontend/src/styles/
  tokens.css               ← Hợp đồng ngữ nghĩa + import classic mặc định
  themes/
    classic.css            ← Màu mặc định hiện tại
    jiangnan.css           ← Sân vườn Giang Nam
  shadcn-theme.css         ← Vẫn ánh xạ token ngữ nghĩa (không phụ thuộc giao diện)

frontend/src/shared/theme/
  theme.ts                 ← get/set/list + storage
  boot-theme.ts            ← Ghi data-theme đồng bộ (chống chớp)
```

---

## 6. Các giai đoạn triển khai (đề xuất)

| Giai đoạn | Nội dung | Rủi ro |
|------|------|------|
| **S0** ✅ | Phân tầng token ngữ nghĩa + hai bộ CSS classic / jiangnan + API setTheme | Thấp |
| **S1** ✅ | Thêm tab "Giao diện" trong cài đặt + thẻ chủ đề; ba trang entry `bootTheme()` | Thấp |
| **S2** ✅ | Dọn dẹp mã cứng trung tính hàng loạt → token; trạng thái chọn đi `--accent` | Trung bình |
| **S3** ✅ | Kiến trúc đa giao diện đăng ký; `night`/`seacliff`; UI nhóm giao diện | Trung bình |
| **S4** | Tiếp tục dọn hex còn lại; thống nhất trạng thái chọn nghiệp vụ về `--selection` | Trung bình |
| **S5** | Biểu tượng/hiệu ứng theo chủ đề; cộng đồng/nhập giao diện tùy chỉnh (tùy chọn) | Cao |

**Không** thay đổi lớn giao diện component ở S0; mặc định vẫn classic, giao diện Giang Nam dùng `data-theme` để dùng thử.

---

## 7. Dùng thử giao diện Giang Nam (phát triển)

Bảng điều khiển trình duyệt:

```js
localStorage.setItem("retainpdf.theme", "jiangnan");
document.documentElement.dataset.theme = "jiangnan";
```

Hoặc:

```js
// Nếu đã kết nối shared/theme
import { setTheme } from "/…"; // dùng trang cài đặt sau khi build
```

Khôi phục mặc định:

```js
localStorage.setItem("retainpdf.theme", "classic");
document.documentElement.dataset.theme = "classic";
// hoặc removeItem + removeAttribute
```

---

## 8. Mối quan hệ với hệ thống biểu tượng

- Biểu tượng giữ **đơn sắc currentColor**, đổi giao diện chỉ thay token, biểu tượng tự động theo `--ink` / `--accent`.
- Phê bình chu sa, trạng thái mạ vàng: dùng `--danger` / `--gold` để tô màu badge, không vẽ màu cố định trong SVG.

---

## 9. Ghi chú quyết định

| Quyết định | Lựa chọn | Lý do |
|------|------|------|
| Cách chuyển đổi | Thuộc tính `data-theme` | Không phụ thuộc React vẫn có hiệu lực ngay từ đầu; CSS thuần selector |
| Giao diện mặc định | classic | Không phá vỡ cảm quan hiện tại và ảnh chụp màn hình kiểm thử |
| Màu chính thương hiệu | `--accent` có thể chuyển sang xanh theo giao diện | Nút chính/tiêu điểm thống nhất đi accent |
| Màu nguy hiểm | Các giao diện có thể điều chỉnh nhẹ, ngữ nghĩa vẫn là danger | Xóa/thất bại giữ khả năng nhận diện |
| Dọn mã cứng | Phân kỳ | Đổi hết cùng lúc diff quá lớn |

---

## 10. Một câu

**Giao diện = đổi màu cho cùng một bộ biến CSS ngữ nghĩa; ứng dụng = chỉ viết biến ngữ nghĩa.**  
Sân vườn Giang Nam là giao diện đầu tiên có "câu chuyện"; classic làm nền tảng.
