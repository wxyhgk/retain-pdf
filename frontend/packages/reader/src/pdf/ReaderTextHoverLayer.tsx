import {
  projectReaderRegion,
  readerRegionKindForRegion,
  type ReaderRegionHighlight,
  type ReaderRegionRect,
} from "../shared/data/reader-regions.js";

export type ReaderTextHoverTarget = {
  itemId: string;
  highlight: ReaderRegionHighlight;
  rect: ReaderRegionRect;
};

export function projectReaderTextHoverTargets(
  regions: readonly ReaderRegionHighlight[],
  width: number,
  height: number,
): ReaderTextHoverTarget[] {
  return regions.flatMap((highlight) => {
    if (readerRegionKindForRegion(highlight.region) !== "text") return [];
    const rect = projectReaderRegion(highlight, width, height);
    return rect ? [{ itemId: highlight.itemId, highlight, rect }] : [];
  });
}

export function hitTestReaderTextHoverTarget(
  targets: readonly ReaderTextHoverTarget[],
  x: number,
  y: number,
): ReaderTextHoverTarget | null {
  let best: ReaderTextHoverTarget | null = null;
  let bestArea = Number.POSITIVE_INFINITY;
  for (const target of targets) {
    const { rect } = target;
    if (x < rect.left || x > rect.left + rect.width || y < rect.top || y > rect.top + rect.height) {
      continue;
    }
    const area = rect.width * rect.height;
    if (area < bestArea) {
      best = target;
      bestArea = area;
    }
  }
  return best;
}

export function ReaderTextHoverLayer({ target }: { target: ReaderTextHoverTarget | null }) {
  if (!target) return null;
  return (
    <div className="reader-text-hover-layer" aria-hidden="true">
      <div
        className="reader-text-hover-frame"
        data-reader-text-hover-id={target.itemId}
        style={target.rect}
      >
        <span className="reader-text-hover-label">文字</span>
      </div>
    </div>
  );
}
