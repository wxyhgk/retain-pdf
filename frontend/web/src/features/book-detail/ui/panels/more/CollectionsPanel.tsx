// 概览信息区「合集」一行：合集成员切换。
// 标签文字由概览的行标题提供，这里只放切换按钮 —— 按钮本身就带「已加入 / 未加入」状态，
// 所以概览不再另写一份「合集：未加入」。

import { cn } from "@/ui/lib/utils";

type CollectionsPanelProps = {
  collections: Array<{ collection_id: string; name: string; member: boolean }>;
  /** 当前 busy 的 collection_id */
  collectionsBusy: string;
  onToggle: (collectionId: string, nextMember: boolean) => void;
};

export function CollectionsPanel({ collections, collectionsBusy, onToggle }: CollectionsPanelProps) {
  if (!collections?.length) {
    return <span className="book-detail-collections-empty">还没有合集</span>;
  }

  return (
    <div className="book-detail-collections-panel flex flex-wrap gap-1.5">
      {collections.map((c) => (
        <button
          key={c.collection_id}
          type="button"
          aria-pressed={c.member}
          disabled={collectionsBusy === c.collection_id}
          onClick={() => onToggle(c.collection_id, !c.member)}
          className={cn(
            "rounded-full border px-2.5 py-0.5 text-xs transition-colors disabled:opacity-55",
            c.member
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-paper text-muted-foreground hover:bg-accent",
          )}
        >
          {c.member ? "✓ " : "+ "}
          {c.name}
        </button>
      ))}
    </div>
  );
}
