// Cột phải: chuyển đổi thành viên bộ sưu tập.

import { cn } from "@/lib/utils";

/**
 * @param {object} props
 * @param {Array<{ collection_id: string, name: string, member: boolean }>} props.collections
 * @param {string} props.collectionsBusy trước mặt busy của collection_id
 * @param {(collectionId: string, nextMember: boolean) => void} props.onToggle
 */
export function CollectionsPanel({ collections, collectionsBusy, onToggle }) {
  if (!collections?.length) return null;

  return (
    <div className="space-y-1.5 border-t border-border/30 pt-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Bộ sưu tập</p>
      <div className="flex flex-wrap gap-2">
        {collections.map((c) => (
          <button
            key={c.collection_id}
            type="button"
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
