# Trang chủ ↔ Trình đọc: Đóng không làm mới (Soft Reader)

**Ngày:** 2026-07-21  
**Phạm vi:** Mở PDF đọc từ trang chủ `frontend`, đóng và quay về kệ sách  
**Trạng thái:** Đã triển khai

---

## 1. Hiện tượng

1. Sau khi vào trình đọc từ trang chủ, góc trên bên phải không có nút «Đóng / Về trang chủ».
2. Sau khi thêm nút đóng: nhấn × sẽ **làm mới toàn bộ trang** chủ, **mất vị trí cuộn** trên kệ sách.
3. Mong đợi của người dùng: sau khi đóng trình đọc, kệ sách xuất hiện ngay lập tức, **không giống như mở lại trang web**.

---

## 2. Lịch sử phát triển

| Giai đoạn | Giải pháp | Vấn đề |
|------|------|------|
| A | Hộp thoại Radix trên trang chủ + **iframe** nhúng `reader.html` | Vòng đời hai tài liệu, postMessage, gói CSS kép, dễ biến thành «cửa sổ nhỏ» |
| B | `location.assign(reader.html)` trên trang chủ, chuyển trang toàn bộ | Chỉ có thể đóng bằng `history.back` / `assign(index.html)` lại, trang chủ bị gỡ, **cảm giác tải lại chắc chắn** |
| C (hiện tại) | **Soft Reader**: Không gỡ trang chủ + lớp đọc toàn màn hình | Nhấn × không làm mới, cuộn giữ nguyên; thanh địa chỉ vẫn là `reader.html?…` |

Người dùng không thích «lớp vỏ iframe hộp thoại», nhưng có thể chấp nhận **lớp máy chủ toàn màn hình để không làm mới trang chủ** (về mặt kỹ thuật vẫn là iframe tải SPA trình đọc đầy đủ, **không có** cửa sổ hộp thoại).

---

## 3. Nguyên nhân gốc

### 3.1 Tại sao lại «làm mới»

```
Trang chủ index.html  ──location.assign──►  reader.html
      ▲                                    │
      └──────── assign(index) / back ──────┘
```

- Khi `assign` rời khỏi trang chủ, **tài liệu trang chủ bị hủy** (cây React, vùng cuộn, trạng thái polling đều mất).
- Khi đóng dù dùng `history.back()`:
  - Nếu có **bfcache**: có thể khôi phục tức thì (trong dự án này, polling thường khiến bfcache **không ổn định**);
  - Nếu không bfcache: trình duyệt **tải lại** `index.html` → người dùng cảm nhận là làm mới.
- Cuộn kệ sách nằm trong `#recent-jobs-scroll-body` (không phải `window`), sau khi tải cứng, trình duyệt cũng **không** tự động khôi phục `scrollTop` của phần tử đó.

### 3.2 Tại sao sessionStorage khôi phục cuộn chưa đủ

Trước đây đã thêm «ghi nhớ cuộn trước khi rời, ghi lại sau khi quay về»:

- Có thể giảm nhẹ việc **mất vị trí khi quay về trang chủ cứng**;
- **Không thể loại bỏ** cảm giác tải lại toàn trang trắng / React khởi động nguội.

Để «không làm mới», phải **giữ cho tài liệu trang chủ luôn sống**.

---

## 4. Giải pháp: Soft Reader (mở mềm)

### 4.1 Ý tưởng

Khi mở trình đọc từ **tài liệu trang chủ**:

1. **Không** dùng `location.assign` để gỡ trang chủ;
2. `history.pushState` thay đổi địa chỉ thành `reader.html?job_id=…` (có thể chia sẻ, làm mới vẫn vào trang đọc thực);
3. Phủ lên trang chủ một **lớp máy chủ toàn màn hình** (`SoftReaderHost`), nhúng `iframe[src=reader.html?…]` chạy trình đọc đầy đủ;
4. DOM trang chủ (bao gồm `#recent-jobs-scroll-body`) **luôn được giữ**.

Khi đóng:

1. Trình đọc (trong iframe) `postMessage` thông báo cho trang cha;
2. Trang cha `history.back()` gỡ lớp soft;
3. Trang chủ hiện ra ngay lập tức, **không tải lại điều hướng**.

```
┌──────────── index.html (luôn sống) ────────────┐
│  Kệ sách / Bộ sưu tập / Yêu thích …  giữ cuộn   │
│  ┌──────── SoftReaderHost (toàn màn hình fixed) ─┐ │
│  │  iframe → reader.html + reader.bundle        │ │
│  │  [× Đóng] → postMessage → history.back       │ │
│  └──────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

### 4.2 Các tệp chính

| Đường dẫn | Trách nhiệm |
|------|------|
| `frontend/src/shared/navigation/soft-reader.ts` | `trySoftOpenReader` / `closeSoftReaderOnHost`, trạng thái history, loại tin nhắn |
| `frontend/src/shared/navigation/home-return-state.ts` | Ảnh chụp cuộn/tab trước khi rời (dự phòng cho chuyển cứng) |
| `frontend/src/pages/home/features/reader/navigate-to-reader.ts` | Mặc định soft open; `replace` vẫn chuyển cứng |
| `frontend/src/pages/home/features/reader/SoftReaderHost.tsx` | Lớp toàn màn hình + iframe + popstate / message |
| `frontend/src/pages/home/features/reader/ReaderDialog.tsx` | Lắng nghe `openReaderRequested` → `navigateToReader` |
| `frontend/src/pages/reader/components/react-pdf/ReaderCloseHome.tsx` | ×: postMessage trong iframe; back/assign cho trang độc lập |
| `frontend/src/pages/home/features/library/page/useHomeReturnRestore.ts` | Khôi phục cuộn khi quay về trang chủ cứng (dự phòng) |
| `frontend/src/styles/pages/home/library-shell.css` | `.soft-reader-host` / `.soft-reader-frame` |

### 4.3 Đường dẫn mở (nhấn sách trên trang chủ)

```
openReaderRequested
  → ReaderDialog
  → navigateToReader(url)
  → captureHomeReturnState({ allowBack: true })
  → trySoftOpenReader(url)          // trên tài liệu trang chủ
       history.pushState({ retainpdfSoftReader, readerUrl }, "", absoluteUrl)
       phát sự kiện retainpdf:soft-reader-open
  → SoftReaderHost hiển thị iframe
```

Chỉ khi **hiện tại không phải là tài liệu trang chủ** (đã ở `reader.html` / `detail.html`) hoặc soft thất bại, mới dùng `location.assign`.

Liên kết sâu `?view=reader&job_id=` vẫn dùng **`replace: true` chuyển cứng** vào `reader.html` (tránh vòng lặp history).

### 4.4 Đường dẫn đóng

**A. Mở mềm (trong iframe)**

```
Nhấn ×
  → navigateReaderToHome()
  → parent.postMessage({ type: "retainpdf:soft-reader-close" }, origin)
  → trang cha closeSoftReaderOnHost()
  → history.back()
  → SoftReaderHost popstate → gỡ iframe
  → Trang chủ vẫn còn, cuộn không thay đổi
```

**B. `reader.html` độc lập (dấu trang / sau làm mới)**

```
× → history.back() (nếu session đánh dấu từ trang chủ)
    hoặc location.assign(index.html)
  + useHomeReturnRestore cố gắng khôi phục cuộn
```

### 4.5 So với «hộp thoại iframe cũ»

| | Hộp thoại iframe cũ | Soft Reader |
|--|------------------|-------------|
| Vỏ | Radix Dialog, dễ thành cửa sổ nhỏ | `position:fixed; inset:0` toàn màn hình thực |
| Trang chủ | Vẫn còn, nhưng vỏ/style ràng buộc nặng | Mục tiêu sản phẩm rõ ràng «giữ trang chủ sống» |
| Giao tiếp | Nhiều postMessage tiến trình | **Chỉ một** tin nhắn đóng |
| URL | Thường là URL trang chủ | **pushState thành URL reader** |
| Làm mới URL đọc | Có thể vẫn ở trang chủ | Mở trực tiếp `reader.html` thực |

---

## 5. Ma trận tình huống

| Tình huống | Hành vi |
|------|------|
| Nhấn thẻ / đọc đối chiếu từ trang chủ → đọc → nhấn × đóng | Soft open, **không làm mới**, giữ cuộn |
| Trình duyệt «Quay lại» | Tương tự soft đóng |
| Mở trực tiếp / làm mới `reader.html` trên thanh địa chỉ | Trang đọc độc lập; × về trang chủ có thể tải lại toàn bộ trang (có thể chấp nhận) |
| Trang chủ `?view=reader&job_id=` | `replace` chuyển cứng vào trang đọc |
| Trong trang đọc, nhấn liên kết sang trang khác | Vẫn điều hướng trong trình đọc |

---

## 6. Xây dựng và xác minh

```bash
cd frontend
npm run build:css
npm run build:js
# Làm mới cứng trình duyệt, sau đó kiểm tra trang chủ → đọc → đóng
```

Đề xuất kiểm thử thủ công:

1. Cuộn kệ sách trang chủ xuống một đoạn;
2. Mở một cuốn sách;
3. Nhấn nút «Đóng» ở góc trên bên phải;
4. Kỳ vọng: kệ sách xuất hiện ngay lập tức, **không tải lại trắng**, vị trí cuộn vẫn giữ nguyên.

Các bài kiểm tra liên quan (hợp đồng điều hướng, sử dụng mock navigate):

- `frontend/tests/reader-dialog-component.test.mjs`
- `frontend/tests/home-app-component.test.mjs`

---

## 7. Tùy chọn tiếp theo

- Lớp phủ loading của Soft (tránh trống trước khi iframe tải xong).
- Khi đóng trang đọc độc lập, cải thiện khôi phục cuộn / thân thiện bfcache (dừng polling tại `pagehide`).
- Nếu sản phẩm cho phép «nhúng `ReaderAppReactPdf` cùng bundle»: có thể bỏ iframe, giảm thêm hai bundle; chi phí là dung lượng bundle home tăng.

---

## 8. Một câu

**Bản chất của đóng trình đọc không làm mới: đừng dùng điều hướng toàn trang để gỡ trang chủ; dùng history + lớp toàn màn hình để giữ trang chủ sống, trình đọc vẫn chạy `reader.html` đầy đủ.**
