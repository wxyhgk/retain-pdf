# Trang Chi Tiết Tác Vụ (`pages/detail`)

SPA độc lập: `detail.html` -> `entry.tsx` -> `DetailApp`.

## Bố cục

```text
pages/detail/
  entry.tsx / DetailApp.tsx
  external.ts              # điểm xuất duy nhất sang src/js/*
  components/              # UI (Header / Artifacts / Events...)
```

## Quy tắc

| Tầng | Quy tắc |
|----|------|
| `DetailApp` / `components/**` | **Cấm** import trực tiếp `... from "../../js/..."` |
| `external.ts` | File duy nhất được import `src/js/*`; thiếu symbol thì chỉ sửa ở đây |
| `js/job-detail/*` | Logic imperative cho overview / markdown / resume (được nối qua external) |

Gate: `tests/architecture-boundaries.test.mjs`
(`detail page must not import src/js/* directly`)

## Chiến lược state (tóm tắt)

- Text / link: React state (`texts` / `links`), được callback job-detail ghi vào.
- Danh sách artifact, debug lỗi, lưới ảnh Markdown: đảo imperative `innerHTML` (xem comment trong component).
- Modal / download toast: React (Radix Dialog + DownloadToastHost).
