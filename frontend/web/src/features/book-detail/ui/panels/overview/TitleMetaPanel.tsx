// 概览：标题 / 标签编辑表单。
// 只读的书名 / 作者已经在弹窗标题和左栏展示，这里只在点了「编辑信息」后出现。

import { Button, Field, Input } from "@retainpdf/ui";
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
      <Field label="书名">
        <Input
          id="book-detail-title-input"
          type="text"
          value={titleText}
          autoFocus
          onChange={(e) => onTitleChange(e.target.value)}
        />
      </Field>
      <Field label="标签（逗号或顿号分隔）">
        <Input type="text" placeholder="例如：化学、综述" />
      </Field>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" size="sm" disabled={busy === "meta"} onClick={onCancelEdit}>
          <X aria-hidden="true" />取消
        </Button>
        <Button
          id="book-detail-save-btn"
          variant="primary" size="sm"
          disabled={busy === "meta"}
          onClick={onSave}
        >
          <Check aria-hidden="true" />
          {busy === "meta" ? "保存中…" : "保存"}
        </Button>
      </div>
    </div>
  );
}
