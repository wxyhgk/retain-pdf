// 批量选择工具栏(照搬 PDF_MD_lib 的 LibraryBatchToolbar,按我们后端能力收窄:
// 没有批量删除端点,逐个复用 deleteDocument;加入合集本身就是批量端点,直接
// 传数组)。视觉上不搬参考项目的"贴底通栏",改成和本项目已有的
// library-search-dock/library-bottom-actions 同一套"悬浮圆角胶囊"语言——
// 批量模式下占用搜索框原来的底部居中位置(RecentJobsLibrary 切换时隐藏
// LibrarySearchDock,两者不会同时出现)。按钮和「加入合集」菜单用 @retainpdf/ui。

import type { SVGProps } from "react";
import { Button, Menu } from "@retainpdf/ui";
import type { CollectionRecord } from "@/features/collections/index.js";

type LibraryBatchToolbarProps = {
  count: number;
  totalSelectable: number;
  allSelected: boolean;
  onSelectAll: () => void;
  onCancel: () => void;
  onDelete: () => void;
  collections?: CollectionRecord[];
  /** 合集 id 取自 CollectionRecord，记录上可能缺省，原样上抛。 */
  onAddToCollection?: (collectionId: CollectionRecord["collection_id"]) => void;
  busy?: boolean;
};

function IconTrash(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="14" height="14" {...props}>
      <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-9 0 1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconFolderPlus(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="14" height="14" {...props}>
      <path d="M3 7a1 1 0 0 1 1-1h4l2 2h10a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7Z" strokeLinejoin="round" />
      <path d="M12 11v5m-2.5-2.5h5" strokeLinecap="round" />
    </svg>
  );
}

export function LibraryBatchToolbar({
  count,
  totalSelectable,
  allSelected,
  onSelectAll,
  onCancel,
  onDelete,
  collections = [],
  onAddToCollection,
  busy = false,
}: LibraryBatchToolbarProps) {
  const hasSelection = count > 0;

  return (
    <div className="library-search-dock" aria-label="批量操作工具栏">
      <div className="flex min-h-[52px] flex-wrap items-center gap-2 rounded-full border border-[color-mix(in_srgb,color-mix(in_srgb,var(--line)_85%,var(--muted))_82%,transparent)] bg-paper/82 p-2 pl-4 shadow-[0_18px_46px_color-mix(in_srgb,var(--shadow-color)_12%,transparent)] backdrop-blur-[18px]">
        <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={onCancel}>取消</Button>

        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          已选 {count}{Number.isFinite(totalSelectable) ? ` / ${totalSelectable}` : ""}
        </span>

        <Button variant="secondary" size="sm" disabled={busy || !totalSelectable} onClick={onSelectAll}>
          {allSelected ? "取消全选" : `全选已加载${Number.isFinite(totalSelectable) ? `(${totalSelectable})` : ""}`}
        </Button>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <Menu
            align="end"
            label="选择合集"
            trigger={(
              <Button variant="secondary" size="sm" disabled={busy || !hasSelection || collections.length === 0}>
                <IconFolderPlus className="opacity-70" />
                加入合集
              </Button>
            )}
            items={collections.map((c) => ({
              key: `${c.collection_id}`,
              label: c.name,
              onSelect: () => onAddToCollection?.(c.collection_id),
            }))}
          />

          <Button variant="danger" size="sm" disabled={busy || !hasSelection} onClick={onDelete}>
            <IconTrash />
            删除
          </Button>
        </div>
      </div>
    </div>
  );
}
