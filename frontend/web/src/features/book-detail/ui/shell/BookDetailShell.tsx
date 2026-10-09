// BookDetailShell —— 书籍详情弹窗「壳」。
//
// 只负责:
//   - Radix Dialog 开合 / 遮罩 / 关闭钮
//   - 固定 id="book-detail-dialog"（测试与样式锚点）
//   - 双栏布局槽位 left / right
//
// 不负责:
//   - 拉 document、翻译、删除、合集等业务
//   - 决定左栏放哪些按钮、右栏有哪些区块
//
// 用法:
//   <BookDetailShell open={…} onOpenChange={…} left={…} right={…} />

import type { ReactNode } from "react";
import {
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogShell,
  DialogTitle,
} from "@/ui/components/dialog.js";

type BookDetailShellProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus?: (event: Event) => void;
  /** 可见标题（书名；默认「书籍详情」） */
  title?: string;
  /** 左栏（封面、主操作） */
  left: ReactNode;
  /** 右栏（元数据、翻译、合集…） */
  right: ReactNode;
  contentClassName?: string;
};

export function BookDetailShell({
  open,
  onOpenChange,
  onCloseAutoFocus,
  title = "书籍详情",
  left,
  right,
  contentClassName = "",
}: BookDetailShellProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          id="book-detail-dialog"
          className={`book-detail-dialog ${contentClassName}`.trim()}
          onCloseAutoFocus={onCloseAutoFocus}
          showCloseButton={false}
          size="workspace"
        >
          <DialogShell className="book-detail-dialog-shell relative">
            <DialogTitle asChild>
              <h2 className="book-detail-dialog-title">{title}</h2>
            </DialogTitle>
            <DialogCloseButton
              id="book-detail-close-btn"
              className="absolute right-5 top-5 z-[2]"
            />

            <div className="book-detail-shell-grid">
              <div className="book-detail-shell-left">{left}</div>
              <div className="book-detail-shell-right">{right}</div>
            </div>
          </DialogShell>
        </DialogContent>
    </Dialog>
  );
}
