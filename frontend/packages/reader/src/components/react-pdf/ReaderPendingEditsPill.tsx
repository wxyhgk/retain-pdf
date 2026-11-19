// 右下角的小条：改了几处还没排进 PDF、点「重新排版」；排版中、排失败也在这里说。编辑框收起来也看得到。
import { Button } from "@retainpdf/ui";
import type { ReaderBlockEdit } from "../../hooks/use-reader-block-edit.js";

export function ReaderPendingEditsPill({ edit }: { edit: ReaderBlockEdit }) {
  const count = edit.pendingEdits.size;
  const { rerender } = edit;
  if (rerender.phase === "running" || rerender.phase === "submitting") {
    return (
      <div className="reader-pending-edits is-running" role="status" data-block-edit-rerender="running">
        正在重新排版，排完译文 PDF 会自动换成新的（大书要几分钟）。
      </div>
    );
  }
  if (!count && rerender.phase !== "failed") return null;
  return (
    <div className="reader-pending-edits" role="status" data-block-edit-pending={count}>
      <span>{rerender.phase === "failed" ? rerender.message : `改了 ${count} 处，还没排进 PDF`}</span>
      {count ? (
        <Button
          className="reader-pending-edits-act"
          size="sm"
          variant="primary"
          data-block-edit-action="rerender"
          onClick={() => { void edit.startRerender(); }}
        >重新排版</Button>
      ) : null}
    </div>
  );
}
