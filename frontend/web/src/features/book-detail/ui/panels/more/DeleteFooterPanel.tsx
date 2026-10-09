// 概览底部危险操作区：删除按钮 + 删除确认（ConfirmDialog 二次确认）。
// 错误提示由概览信息区统一展示（阅读状态 / 合集 / 删除共用一个 error）。

import { useState } from "react";
import { ConfirmDialog } from "@/ui/components/confirm-dialog.js";
import { Trash2 } from "lucide-react";

type DeleteFooterPanelProps = {
  busy?: string | boolean;
  onDelete: () => void;
  /** 确认框展示的书名 */
  title?: string;
};

export function DeleteFooterPanel({
  busy,
  onDelete,
  title = "",
}: DeleteFooterPanelProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const bookName = `${title || ""}`.trim();
  return (
    <>
      <div className="book-detail-delete-panel">
        <button
          id="book-detail-delete-btn"
          type="button"
          disabled={Boolean(busy)}
          onClick={() => setConfirmOpen(true)}
          className="book-detail-delete-btn"
        >
          <Trash2 aria-hidden="true" />
          删除这本书
        </button>
        <ConfirmDialog
          id="book-detail-delete-confirm"
          title="删除书籍"
          description={bookName ? `确定删除「${bookName}」吗？关联的任务与文件将一并删除，无法恢复。` : "确定删除这本书吗？关联的任务与文件将一并删除，无法恢复。"}
          confirmLabel="删除"
          tone="danger"
          level="nested"
          open={confirmOpen}
          pending={busy === "delete"}
          onOpenChange={(next) => { if (!next) setConfirmOpen(false); }}
          onConfirm={() => { setConfirmOpen(false); onDelete(); }}
        />
      </div>
    </>
  );
}
