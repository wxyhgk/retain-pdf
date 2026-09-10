// 右栏：合集成员切换。

import { cn } from "@/ui/lib/utils";
import { Layers3 } from "lucide-react";

/**
 * @param {object} props
 * @param {Array<{ collection_id: string, name: string, member: boolean }>} props.collections
 * @param {string} props.collectionsBusy 当前 busy 的 collection_id
 * @param {(collectionId: string, nextMember: boolean) => void} props.onToggle
 */
export function CollectionsPanel({ collections, collectionsBusy, onToggle }) {
  if (!collections?.length) return null;

  return (
    <div className="book-detail-collections-panel space-y-1.5 border-t border-border/30 pt-3">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        <Layers3 className="h-3.5 w-3.5" aria-hidden="true" />合集
      </p>
      <div className="flex flex-wrap gap-2">
        {collections.map((c) => (
          <button
            key={c.collection_id}
            type="button"
            aria-pressed={c.member}
            disabled={collectionsBusy === c.collection_id}
            onClick={() => onToggle(c.collection_id, !c.member)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs transition-colors disabled:opacity-55",
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
    </div>
  );
}
