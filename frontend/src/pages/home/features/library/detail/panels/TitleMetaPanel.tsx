// Cột phải: tiêu đề / tác giả / thẻ + biểu mẫu chỉnh sửa.

import { btn } from "./ui.jsx";

/**
 * @param {object} props
 * @param {boolean} props.editing
 * @param {string} props.titleText
 * @param {string} props.tagsText
 * @param {string[]} props.tags
 * @param {string[]} props.authors
 * @param {string|number|null|undefined} props.year
 * @param {string} props.displayTitle Tiêu đề để hiển thị
 * @param {string} props.busy
 * @param {() => void} props.onStartEdit
 * @param {() => void} props.onCancelEdit
 * @param {() => void} props.onSave
 * @param {(v: string) => void} props.onTitleChange
 * @param {(v: string) => void} props.onTagsTextChange
 */
export function TitleMetaPanel({
  editing,
  titleText,
  tagsText,
  tags,
  authors,
  year,
  displayTitle,
  busy,
  onStartEdit,
  onCancelEdit,
  onSave,
  onTitleChange,
  onTagsTextChange,
}) {
  return (
    <div className="flex items-start justify-between gap-3 pr-8">
      <div className="min-w-0 flex-1">
        {editing ? (
          <div className="space-y-2.5">
            <input
              id="book-detail-title-input"
              type="text"
              value={titleText}
              autoFocus
              onChange={(e) => onTitleChange(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            />
            <div>
              <p className="mb-1 text-xs text-muted-foreground">Thẻ (phân cách bằng dấu phẩy hoặc dấu gạch chéo)</p>
              <input
                id="book-detail-tags-input"
                type="text"
                value={tagsText}
                placeholder="Ví dụ: Hóa học, Tổng quan"
                onChange={(e) => onTagsTextChange(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button className={btn("outline")} disabled={busy === "meta"} onClick={onCancelEdit}>
                Hủy
              </button>
              <button
                id="book-detail-save-btn"
                className={btn("default")}
                disabled={busy === "meta"}
                onClick={onSave}
              >
                {busy === "meta" ? "Đang lưu…" : "Lưu"}
              </button>
            </div>
          </div>
        ) : (
          <>
            <h1
              className="book-detail-title line-clamp-2 break-words text-xl font-bold leading-snug tracking-tight"
              title={displayTitle}
            >
              {displayTitle || "-"}
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {authors.length ? authors.join("、") : "Không rõ tác giả"}
              {year ? ` · ${year}` : ""}
            </p>
            {tags.length ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {tags.map((t) => (
                  <span key={t} className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
                    {t}
                  </span>
                ))}
              </div>
            ) : null}
          </>
        )}
      </div>
      {!editing ? (
        <button
          id="book-detail-edit-btn"
          type="button"
          onClick={onStartEdit}
          className="shrink-0 rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        >
          Sửa
        </button>
      ) : null}
    </div>
  );
}
