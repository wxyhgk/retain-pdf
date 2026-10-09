// 概览：标题 / 标签编辑表单。
// 只读的书名 / 作者已经在弹窗标题和左栏展示，这里只在点了「编辑信息」后出现。

import { btn } from "../ui.jsx";
import { Check, X } from "lucide-react";

type TitleMetaPanelProps = {
  titleText: string;
  busy?: string;
  onCancelEdit: () => void;
  onSave: () => void;
  onTitleChange: (value: string) => void;
};

export function TitleMetaPanel({
  titleText,
  busy,
  onCancelEdit,
  onSave,
  onTitleChange,
}: TitleMetaPanelProps) {
  return (
    <div className="space-y-2.5">
      <div>
        <p className="mb-1 text-xs text-muted-foreground">书名</p>
        <input
          id="book-detail-title-input"
          type="text"
          value={titleText}
          autoFocus
          onChange={(e) => onTitleChange(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        />
      </div>
      <div>
        <p className="mb-1 text-xs text-muted-foreground">标签（逗号或顿号分隔）</p>
        <input
          type="text"
          placeholder="例如：化学、综述"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        />
      </div>
      <div className="flex justify-end gap-2">
        <button className={btn("outline")} disabled={busy === "meta"} onClick={onCancelEdit}>
          <X className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />取消
        </button>
        <button
          id="book-detail-save-btn"
          className={btn("default")}
          disabled={busy === "meta"}
          onClick={onSave}
        >
          <Check className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
          {busy === "meta" ? "保存中…" : "保存"}
        </button>
      </div>
    </div>
  );
}
