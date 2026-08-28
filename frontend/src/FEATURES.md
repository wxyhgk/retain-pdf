# Bản đồ cây tính năng frontend (`frontend/src`)

Phát triển hàng ngày lấy **`frontend/`** làm chuẩn (không phải `frontend-react/`).  
Bài này giải thích **hai bộ "features"**, hai engine đọc sách, và nơi đặt `js/*` dùng chung.

## Tổng quan

```text
frontend/src/
├── pages/
│   ├── home/          # SPA trang chủ (React shell + lắp ráp)
│   │   ├── composition/   # Chỉ đấu nối: external → js/features + home features
│   │   └── features/      # React UI / store / điều phối riêng trang chủ
│   ├── reader/        # SPA trình đọc (mặc định react-pdf; legacy dự phòng)
│   └── detail/        # SPA chi tiết nhiệm vụ
├── js/
│   ├── api/           # HTTP / hợp đồng backend
│   ├── features/      # Logic miền mệnh lệnh (mount*, ports, state)
│   ├── reader/        # Engine pdf.js cũ + một số ports được engine mới tái sử dụng
│   ├── job-status/ job/ job-detail/ status-detail/  # Logic thuần hiển thị nhiệm vụ
│   ├── state/ config/ mock/ islands/ …
└── styles/ components/ shared/ partials/
```

| Tầng | Đường dẫn | Trách nhiệm | Mã mới đặt ở đâu |
|----|------|------|------------|
| **Trang React** | `pages/*/features` hoặc `pages/reader/*` | UI, hooks, page store | UI mới / tương tác mới |
| **Miền mệnh lệnh** | `js/features/*` | Gắn kết, polling, biểu mẫu, ports | Logic phi UI tái sử dụng xuyên trang |
| **API dùng chung** | `js/api/*` | Đóng gói fetch | Client endpoint backend mới |
| **Lắp ráp** | `pages/home/composition/*` | Đấu nối, không viết nghiệp vụ | Chỉ thay đổi wiring |

---

## Trang chủ: Hai cây features

Trang chủ tồn tại song song:

1. **`src/js/features/*`** — **Miền mệnh lệnh** tách ra từ đường dẫn chính cũ (`mountXxxFeature`, ports, DOM contract, state)
2. **`src/pages/home/features/*`** — View phía **React**, store, hộp thoại, UI kệ sách

Chúng **không phải thư mục trùng lặp**, mà là **tầng UI vs tầng miền**. Quy tắc đấu nối xem tại `pages/home/composition/README.md`:

- Factory miền nên tham chiếu `js/*` qua **`composition/external.ts`** (tránh import `../../../js` tràn lan trong features)
- Ngoại lệ: Một ít kiểu / hàm thuần đã import trực tiếp `js/features` từ `pages/home/features` (nợ lịch sử, mã mới ưu tiên đi qua external)

### Bảng đối chiếu (tên gần giống ≠ cùng module)

| `js/features/` | `pages/home/features/` | Quan hệ |
|----------------|------------------------|------|
| `upload/` | `upload/` | mount miền + form ↔ React upload view store |
| `workflow/` + `translation-workflow-dialog/` | `workflow/` | workflow mệnh lệnh + hợp đồng hộp thoại ↔ React workflow dialog |
| `credentials/` | `credentials/` | mount/DOM thông tin xác thực ↔ React settings UI |
| `glossaries/` | `glossaries/` | controller bảng thuật ngữ ↔ React glossary |
| `app-update/` | `app-update/` | GitHub release / cache ↔ React update bar |
| `app-shell/` | `app-shell/` | idle reset / config ↔ shell UI thanh dưới |
| `app-actions/` | (không cùng tên) | Gửi nhiệm vụ; composition gắn vào status/upload |
| `job-runtime/` | (không cùng tên) | Polling nhiệm vụ hiện tại; status / library tiêu thụ |
| `recent-jobs/` + `documents-library/` | `library/` + `collections/` | Nhiệm vụ gần đây + tài liệu ↔ Thẻ kệ sách / bộ sưu tập |
| `status-detail/` | `status/` + `status-detail/` | Logic chi tiết ↔ Thẻ trạng thái / React detail dialog |
| `reader-dialog/` | `reader/` | Định tuyến/hợp đồng lối vào đọc ↔ Store hộp thoại "mở đọc" trang chủ |
| `home/` | (rải rác) | home state port |
| `artifact-downloads/` | (qua library/status) | Tải xuống sản phẩm |
| (không) | `settings/` | Lối vào cài đặt trang chủ (chủ yếu dựa credentials/update) |

### Công thức sửa mã trang chủ

| Bạn muốn sửa… | Đường dẫn ưu tiên |
|---------|----------|
| Thẻ kệ sách / UI hộp thoại chi tiết | `pages/home/features/library/**` |
| UI biểu mẫu tải lên | `pages/home/features/upload/**` |
| Polling nhiệm vụ, active job | `js/features/job-runtime/**` |
| Gửi nhiệm vụ dịch | `js/features/app-actions/**` + composition |
| Đưa dependency `js` mới vào trang chủ | **Chỉ sửa** `composition/external.ts` + `create-*.ts` tương ứng |

Quy ước thư mục con `library` xem tại `pages/home/features/library/README.md`.

---

## Trình đọc: Ba ranh giới tầng (không liên quan features trang chủ)

| Tầng | Lối vào / Đường dẫn | Cách phụ thuộc js |
|----|-------------|-------------|
| **A Engine mới (mặc định)** | `ReaderAppReactPdf` + `hooks/` `pdf/` `annotations/` `components/react-pdf/` | Chỉ qua **`pages/reader/external.ts`** |
| **B Ports dùng chung** | Tập con `js/reader`: data/config/resource/pdf-document/page-state… | Qua export external; không nhét vào pdf-controller |
| **C Legacy** | `?engine=legacy` → `legacy/**` + **`js/reader` lực lượng chính mệnh lệnh** | Cho phép import trực tiếp `js/reader/**` |

Chi tiết: `pages/reader/README.md`, `js/reader/README.md`.

**Tính năng mới không viết vào `legacy/` hoặc `js/reader/favorites*`.**

## Trang chi tiết

| Đường dẫn | Quy tắc |
|------|------|
| `pages/detail/**` | js chỉ qua **`pages/detail/external.ts`** |
| `js/job-detail/*` | Logic mệnh lệnh overview / markdown / resume |

---

## Các thư mục khác của `js/` (tra nhanh)

| Thư mục | Mục đích |
|------|------|
| `api/` | Client API backend |
| `job-status/`, `job/`, `job-detail/` | Giai đoạn nhiệm vụ / sản phẩm / logic trang chi tiết (detail + home status dùng chung) |
| `status-detail/` | Presenter chi tiết trạng thái (thiên về đường dẫn cũ; khi tồn tại song song với `js/features/status-detail` thì lấy import thực tế làm chuẩn) |
| `state/`, `config/` | Slice store toàn cục, cấu hình runtime |
| `islands/` | Đảo nhỏ gắn được vào HTML cũ (ví dụ library-search, reader-annotations) |
| `mock/` | Kiểm thử và mock cục bộ |
| `app-framework/` | Nguyên ngữ connector/store nhẹ |
| `styles/` | **Đóng gói theo trang** `dist/css/{home,detail,reader}.css`; xem **`styles/README.md`** |

---

## Chiến lược mã chết

- **Ghi nhận trước, xóa sau**: `rg` không thấy importer vẫn có thể là đường dẫn động hoặc dành riêng cho kiểm thử.
- `js/reader` gần như toàn bộ được liên kết chuỗi legacy tham chiếu (bao gồm tham chiếu nội bộ). Đã xóa `ai/remote-answerer.ts` không còn tham chiếu sản xuất.
- **`pages/home/features` → `src/js/*`**: Qua `pages/home/composition/external.ts`.
- **`pages/detail` → `src/js/*`**: Qua `pages/detail/external.ts`.
- **`pages/reader` phi legacy → `src/js/*`**: Qua `pages/reader/external.ts`; ngoại trừ `legacy/**`.
- **Không** xóa hàng loạt `js/reader/favorites/*` hoặc `pdf-renderer` — chúng phục vụ `?engine=legacy` qua `selection-favorites` / `pdf-controller`.

---

## README liên quan

| Tệp | Nội dung |
|------|------|
| `frontend/README.md` | Lối vào, lệnh, quan hệ với frontend-react |
| `pages/home/composition/README.md` | Quy tắc lắp ráp trang chủ |
| `pages/home/features/README.md` | Chỉ mục home React features |
| `pages/home/features/library/README.md` | Thư mục con kệ sách |
| `pages/reader/README.md` | Bố cục trình đọc mới/cũ |
| `js/reader/README.md` | Ranh giới engine cũ và ports dùng chung |
