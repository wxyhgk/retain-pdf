import { ConfirmDialog } from "@/ui/components/confirm-dialog.js";
import type { DeleteBlockedDocument } from "../../domain/types.js";

type RecentJobsLibraryBatchDialogsProps = {
  pendingDeleteIds: string[] | null;
  pendingBlockedDelete: DeleteBlockedDocument[] | null;
  blockedFavoriteTotal: number;
  batchBusy: boolean;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
  onCancelBlocked: () => void;
  onConfirmBlocked: () => void;
};

// 批量删除的两步确认弹窗(从 RecentJobsLibrary 抽出,保持同一 id/文案/回调)。
export function RecentJobsLibraryBatchDialogs({
  pendingDeleteIds,
  pendingBlockedDelete,
  blockedFavoriteTotal,
  batchBusy,
  onCancelDelete,
  onConfirmDelete,
  onCancelBlocked,
  onConfirmBlocked,
}: RecentJobsLibraryBatchDialogsProps) {
  return (
    <>
      <ConfirmDialog
        id="batch-delete-confirm-dialog"
        open={Boolean(pendingDeleteIds)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) onCancelDelete();
        }}
        title="删除所选文档？"
        description={`将永久删除选中的 ${pendingDeleteIds?.length || 0} 篇文档，此操作无法撤销。`}
        confirmLabel="确认删除"
        pending={batchBusy}
        tone="danger"
        onConfirm={onConfirmDelete}
      />
      <ConfirmDialog
        id="batch-delete-favorites-confirm-dialog"
        open={Boolean(pendingBlockedDelete)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) onCancelBlocked();
        }}
        title="部分文档被收藏引用"
        description={`选中的文档里有 ${pendingBlockedDelete?.length || 0} 篇被收藏引用（共 ${blockedFavoriteTotal} 条收藏）。一并删除收藏后才能删除这些文档，此操作无法撤销。`}
        confirmLabel="一并删除收藏并删除"
        pending={batchBusy}
        tone="danger"
        onConfirm={onConfirmBlocked}
      />
    </>
  );
}
