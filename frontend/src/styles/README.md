# Kiến trúc CSS frontend (chia theo trang)

Ba trang **không còn dùng chung** một tệp `styles.css` toàn trạm. Build xuất ra ba gói độc lập:

| HTML | Mã nguồn lối vào | Sản phẩm |
|------|----------|------|
| `index.html` | `entries/home.css` | `dist/css/home.css` |
| `detail.html` | `entries/detail.css` | `dist/css/detail.css` |
| `reader.html` | `entries/reader.css` | `dist/css/reader.css` |
| `?engine=legacy` | `entries/reader-legacy.css` | `dist/css/reader-legacy.css` (inject động) |

Tương thích: `styles.css` = bản sao `home.css` (tài liệu/script cũ); **HTML đã đổi trỏ sang `dist/css/*`**.

## Thư mục

```text
src/styles/
  entries/           # Lối vào trang (ai import gì = ranh giới ghép nối)
    home.css
    detail.css
    reader.css          # Mặc định react-pdf
    reader-legacy.css   # Gói bổ sung ?engine=legacy
  core/              # Chia sẻ tối thiểu xuyên trang
    tailwind-theme.css
    download-toast.css
  tokens.css / base.css / shadcn-theme.css / dialog-shell.css
  components*.css    # UI dùng chung (button-link/label/mono…; trình đọc cố gắng không import cả gói)
  pages/home/*       # Miền trang chủ (components.utilities tách ra + library/status/upload…)
  pages.css + pages/detail/*
  reader/ + reader.utilities.css
```

## Quy tắc ghép nối

1. **Kiểu riêng trang chỉ vào entry tương ứng**  
   - Trang chủ: Kệ sách, workflow tải lên, thẻ trạng thái, thông tin xác thực, bộ sưu tập…  
   - Chi tiết: `pages.css` + `pages/detail/*`  
   - Đọc mặc định: `reader/layout|chrome|content|react-pdf|fab*|float-ai*|hud…`  
   - Đọc legacy: `layout-legacy|chrome-legacy|side-drawer|favorites|selection|ai|annotations…`  
2. **Xuyên trang chỉ đặt `core/` + tokens/base/dialog-shell** (và components khi thực sự cần)  
3. **Cấm** nhét lại import toàn trạm vào `src/input.css`  
4. Thêm kiểu mới: Trước tiên xác định thuộc trang nào → Viết vào tệp miền đó → Xác nhận đã được `entries/*.css` tương ứng import  
5. Cổng: `tests/css-page-namespace.test.mjs` (tiền tố selector reader/detail)

## Build

```bash
npm run build:css          # → dist/css/{home,detail,reader,reader-legacy}.css
npm run watch:css          # Các lối vào song song --watch
```

`scripts/stamp-cache-version.mjs` đánh `?v=hash` cho `dist/css/*.css` mà HTML tham chiếu theo trang  
(`reader-legacy.css` do JS inject động, thường không có tham chiếu HTML, không tham gia stamp).

## Dung lượng (sau minify xấp xỉ)

| Gói | Cỡ | Ghi chú |
|----|------|------|
| home | ~175KB | Miền trang chủ nhiều nhất |
| reader | Gói gọn react-pdf mặc định | Không kệ sách/workflow, không ngăn kéo legacy |
| reader-legacy | Gói bổ sung | Chỉ `?engine=legacy` |
| detail | ~86KB | Nhẹ nhất |

Trang đọc không còn tải `library-view` / `translation-workflow-*` và các quy tắc trang chủ khác.

## desktop / button-link

| Ký hiệu | Vị trí chuẩn |
|------|----------|
| `desktop-shell/head/body/dialog` | `dialog-shell.css` (`@utility` duy nhất) |
| `button-link` / `label` / `mono` | `components.utilities.css` (home+detail dùng chung) |
| status-card / app-button / inline-error… | `pages/home/components.utilities.css` (chỉ home) |
| Toast tải xuống | `core/download-toast.css` |

## Liên quan

- `scripts/build-css.mjs` · `scripts/stamp-cache-version.mjs`  
- `src/FEATURES.md` · `frontend/README.md`
