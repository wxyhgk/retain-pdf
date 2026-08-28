// BookDetailShell — «vỏ» hộp thoại chi tiết sách.
//
// Chỉ chịu trách nhiệm:
//   - Đóng/mở Radix Dialog / lớp phủ / nút đóng
//   - id cố định="book-detail-dialog" (điểm neo kiểm thử và kiểu dáng)
//   - Bố cục hai cột trái / phải
//
// Không chịu trách nhiệm:
//   - Lấy tài liệu, dịch, xóa, bộ sưu tập v.v.
//   - Quyết định nút nào ở cột trái, khối nào ở cột phải
//
// Cách dùng:
//   <BookDetailShell open={…} onOpenChange={…} left={…} right={…} />

import { Dialog as DialogPrimitive } from "radix-ui";

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {(open: boolean) => void} props.onOpenChange
 * @param {(event: Event) => void} [props.onCloseAutoFocus]
 * @param {string} [props.title] tiêu đề cho trình đọc màn hình (mặc định "Chi tiết sách")
 * @param {import("react").ReactNode} props.left cột trái (bìa, thao tác chính)
 * @param {import("react").ReactNode} props.right cột phải (metadata, dịch, bộ sưu tập…)
 * @param {string} [props.contentClassName]
 */
export function BookDetailShell({
  open,
  onOpenChange,
  onCloseAutoFocus,
  title = "Chi tiết sách",
  left,
  right,
  contentClassName = "",
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="desktop-dialog-overlay" />
        <DialogPrimitive.Content
          id="book-detail-dialog"
          className={`book-detail-dialog-content fixed inset-0 z-[101] m-auto h-fit w-[min(940px,94vw)] max-h-[88vh] overflow-y-auto rounded-2xl border border-border bg-paper p-6 shadow-[0_30px_60px_color-mix(in_srgb,var(--shadow-color)_22%,transparent)] sm:p-7 ${contentClassName}`.trim()}
          onCloseAutoFocus={onCloseAutoFocus}
        >
          <DialogPrimitive.Title asChild>
            <h2 className="sr-only">{title}</h2>
          </DialogPrimitive.Title>
          <DialogPrimitive.Close asChild>
            <button
              id="book-detail-close-btn"
              type="button"
              aria-label="Đóng"
              className="absolute right-4 top-4 z-[2] inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              ×
            </button>
          </DialogPrimitive.Close>

          <div className="book-detail-shell-grid grid grid-cols-1 gap-7 sm:grid-cols-[236px_1fr]">
            <div className="book-detail-shell-left">{left}</div>
            {/* pr-10: chừa chỗ cho nút đóng góc trên phải, tránh tab chạm vào × */}
            <div className="book-detail-shell-right min-w-0 space-y-4 pr-10">{right}</div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
