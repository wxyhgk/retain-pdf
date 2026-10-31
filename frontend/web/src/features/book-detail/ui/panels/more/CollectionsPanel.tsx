// 概览信息区「合集」一行：合集成员切换。
// 标签文字由概览的行标题提供，这里只放切换按钮 —— 按钮本身就带「已加入 / 未加入」状态，
// 所以概览不再另写一份「合集：未加入」。按钮是 @retainpdf/ui 的 Button，已加入的是按下状态（aria-pressed）。

import { Button } from "@retainpdf/ui";

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
        <Button
          key={c.collection_id}
          variant="secondary"
          size="sm"
          aria-pressed={c.member}
          disabled={collectionsBusy === c.collection_id}
          onClick={() => onToggle(c.collection_id, !c.member)}
        >
          {c.member ? "✓ " : "+ "}
          {c.name}
        </Button>
      ))}
    </div>
  );
}
