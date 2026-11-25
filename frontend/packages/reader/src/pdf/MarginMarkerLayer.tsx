/** 页边小圆点：第二栏开着时，宿主标出书里某些段落（学习系统里是「这一段的知识点会没会」）。
 *
 * 画在页的左边白边里、和那一块的第一行对齐；找不到块（只给了页码）就画在页顶。
 * 颜色只用皮肤语义色，阅读器不知道它们代表什么。 */
import { Button } from "@retainpdf/ui";

import type { ResolvedMarginMarker } from "../hooks/use-reader-side-pane.js";

export type MarginMarkerTarget = { itemId: string; rect: { top: number; height: number } };

/** 同一块上有好几个点时往下错开，不叠在一起。 */
export const MARGIN_MARKER_SIZE = 12;
const STACK_GAP = 4;
const PAGE_TOP_OFFSET = 12;

export function marginMarkerTops(
  markers: readonly ResolvedMarginMarker[],
  targets: readonly MarginMarkerTarget[],
): number[] {
  const used = new Map<string, number>();
  return markers.map((marker) => {
    const target = marker.itemId ? targets.find((item) => item.itemId === marker.itemId) : undefined;
    const base = target
      ? target.rect.top + Math.min(target.rect.height, 24) / 2 - MARGIN_MARKER_SIZE / 2
      : PAGE_TOP_OFFSET;
    const slot = `${target ? marker.itemId : "page-top"}`;
    const index = used.get(slot) ?? 0;
    used.set(slot, index + 1);
    return Math.round(base + index * (MARGIN_MARKER_SIZE + STACK_GAP));
  });
}

export function MarginMarkerLayer({
  markers,
  targets,
  onSelect,
}: {
  markers: readonly ResolvedMarginMarker[];
  targets: readonly MarginMarkerTarget[];
  onSelect?: (key: string) => void;
}) {
  if (!markers.length) return null;
  const tops = marginMarkerTops(markers, targets);
  return (
    <div className="reader-margin-markers">
      {markers.map((marker, index) => (
        <Button
          key={marker.key}
          className={`reader-margin-marker is-${marker.tone}${marker.hollow ? " is-hollow" : ""}`}
          style={{ top: tops[index] }}
          title={marker.label}
          aria-label={marker.label}
          data-reader-margin-marker={marker.key}
          onClick={(event) => {
            event.stopPropagation();
            onSelect?.(marker.key);
          }}
        />
      ))}
    </div>
  );
}
