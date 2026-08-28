# Cách thêm một bộ skin chủ đề

Mục tiêu: Sau này thêm nhiều chủ đề, **chỉ sửa 3 chỗ**, không động component nghiệp vụ.

---

## Bước (khoảng 10 phút)

### 1. Viết tệp CSS skin

Sao chép mẫu:

```bash
cp frontend/src/styles/themes/classic.css \
   frontend/src/styles/themes/<id>.css
```

Sửa thành:

```css
/* Skin <id>: Mô tả ngắn */
[data-theme="<id>"] {
  --bg: …;
  --paper: …;
  --surface: …;
  --ink: …;
  --muted: …;
  --line: …;

  --accent: …;
  --accent-weak: …;
  --selection: …;

  --danger: …;
  --danger-weak: …;
  --ok: …;
  --ok-weak: …;
  --warn: …;
  --warn-weak: …;

  --gold: …;
  --gold-weak: …;
  --chrome: …;
  --reader-page: …;
}
```

**Biến bắt buộc** xem tại `frontend/src/styles/themes/_contract.css`.

Lưu ý:

- Chữ nút chính dùng `var(--paper)` chồng lên `var(--accent)`, hãy đảm bảo độ tương phản.
- Skin tối: `group: "dark"`, `--ink` nên là chữ sáng, `--bg` nền tối.

### 2. Gắn vào build

`frontend/src/styles/themes/index.css` thêm một dòng:

```css
@import "./<id>.css";
```

### 3. Đăng ký bảng đăng ký

Mảng `THEME_REGISTRY` trong `frontend/src/shared/theme/registry.ts` nối thêm:

```ts
{
  id: "<id>",
  label: "Tên hiển thị",
  description: "Một câu",
  group: "light" | "dark" | "accent",
  order: 50, // Sắp xếp
  preview: {
    bg: "#……",
    paper: "#……",
    accent: "#……",
    ink: "#……",
    danger: "#……",
  },
},
```

`preview` chỉ dùng cho ô màu trang cài đặt, **hãy giữ nhất quán với màu chính CSS**.

### 4. Build

```bash
cd frontend && npm run build:css && npm run build:js
```

### 5. Kiểm chứng

```js
localStorage.setItem("retainpdf.theme", "<id>");
location.reload();
// Hoặc Cài đặt → Giao diện chọn
```

---

## Điều cấm

| Không làm | Lý do |
|------|------|
| Viết `if (theme === 'xxx')` trong component để đổi màu | Nên đi qua biến CSS |
| Viết cứng `#1d1d1f` trong CSS nghiệp vụ | Dùng `var(--ink)` |
| Đổi tên biến shadcn | Chỉ đổi `--accent` v.v. ở tầng dưới |
| Quên import index.css | Skin sẽ không vào dist |

---

## Tăng cường tùy chọn

- Mô tả thiết kế: `docs/theme-system/skins/<id>.md`
- Lắng nghe đổi skin: `window.addEventListener('retainpdf:theme-change', …)`
- Biệt lệ tối: `html.theme-dark` hoặc `[data-theme-group="dark"]`

---

## Danh sách kiểm tra

- [ ] `themes/<id>.css` chứa toàn bộ token bắt buộc  
- [ ] `themes/index.css` đã import  
- [ ] `registry.ts` đã đăng ký và preview khớp  
- [ ] Nút chính / tab đang chọn đọc được dưới skin này  
- [ ] `npm run build:css` thông qua  
