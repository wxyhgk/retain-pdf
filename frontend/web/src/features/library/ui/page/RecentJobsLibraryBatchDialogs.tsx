import { ConfirmDialog } from "@retainpdf/ui";

type RecentJobsLibraryBatchDialogsProps = {
  pendingDeleteIds: string[] | null;
  batchBusy: boolean;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
};

// 批量删除的确认弹窗(从 RecentJobsLibrary 抽出,保持同一 id/文案/回调)。
export function RecentJobsLibraryBatchDialogs({
  pendingDeleteIds,
  batchBusy,
  onCancelDelete,
  onConfirmDelete,
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
    </>
  );
}
