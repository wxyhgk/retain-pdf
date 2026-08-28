# display_stage và lane

## display_stage

`display_stage` là giai đoạn chính ổn định cho lớp hiển thị frontend.

Các giá trị cho phép:

- `ocr`
- `translation`
- `render`
- `done`

Nó khác với `stage` nội bộ của backend. Trạng thái chính của frontend không nên sử dụng trực tiếp `stage` nội bộ.

## stage

`stage` là tên giai đoạn nội bộ của backend, ví dụ:

- `ocr_processing`
- `translating`
- `rendering`
- `saving`
- `failed`

Nó được sử dụng cho chẩn đoán và nhóm log và không đảm bảo phù hợp làm giai đoạn chính trong UI.

## substage

`substage` là giai đoạn phụ đọc được bằng máy, ví dụ:

- `ocr_upload`
- `ocr_processing`
- `translation_batches`
- `continuation_review`
- `page_policies`
- `domain_inference`
- `garbled_repair`
- `render_prepare`
- `render_prewarm`
- `render_pages`
- `render_compile`

## lane

`lane` giải quyết vấn đề hiển thị khi dịch và render prewarm chạy đồng thời.

- `main`: luồng chính của tác vụ hiện tại.
- `background`: giai đoạn hỗ trợ nền.

Ví dụ:

```json
{
  "display_stage": "translation",
  "stage": "translating",
  "substage": "translation_batches",
  "lane": "main"
}
```

```json
{
  "display_stage": "render",
  "stage": "rendering",
  "substage": "render_prewarm",
  "lane": "background"
}
```

Frontend nên coi mục đầu tiên là trạng thái chính và mục thứ hai là chuẩn bị nền.
