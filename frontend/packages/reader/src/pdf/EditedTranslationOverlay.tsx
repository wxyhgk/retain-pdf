// 译文栏上「改了、还没排进 PDF」的那几块：把新译文盖在 PDF 原来那段上（和实时译文同一种排字、公式渲染），
// 左上角一个小标「待排版」。重新排版完 PDF 换成新的，这一层就没了。
import { memo } from "react";
import { readerRegionKindForRegion } from "../shared/data/reader-regions.js";
import { LiveTranslationTextItem } from "./LiveTranslationOverlay.js";
import type { ReaderTextHoverTarget } from "./ReaderTextHoverLayer.js";

function EditedTranslationOverlayInner({
  targets,
  edits,
  width,
  excludeId,
}: {
  targets: readonly ReaderTextHoverTarget[];
  /** 正在框里改的那一段：编辑框盖着，这里不画。 */
  excludeId?: string;
  edits: ReadonlyMap<string, string>;
  /** 这一页画出来的宽度（px），和 PDF 的页宽一起算缩放。 */
  width: number;
}) {
  const edited = targets.filter((target) => edits.has(target.itemId) && target.itemId !== excludeId);
  if (!edited.length) return null;
  return (
    <div className="reader-live-translation-overlay reader-edited-overlay" aria-hidden="true">
      {edited.map((target) => {
        const pageWidth = target.highlight.pageSize.width;
        return (
          <div key={target.itemId} className="reader-edited-block" data-reader-edited-id={target.itemId}>
            <LiveTranslationTextItem
              item={{
                itemId: target.itemId,
                translatedText: edits.get(target.itemId) || "",
                status: "edited",
                kind: readerRegionKindForRegion(target.highlight.region),
                sourceText: target.highlight.box.text || "",
                rect: target.rect,
                changedAtSeq: 0,
                changedNow: false,
              }}
              pageScale={pageWidth > 0 ? width / pageWidth : 1}
            />
            <span className="reader-edited-badge" style={{ left: target.rect.left, top: target.rect.top }}>待排版</span>
          </div>
        );
      })}
    </div>
  );
}

export const EditedTranslationOverlay = memo(EditedTranslationOverlayInner);
