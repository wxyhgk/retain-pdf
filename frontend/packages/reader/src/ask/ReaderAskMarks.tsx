/** 书页上的「?」：这次打开里问过的地方，书页左边白边里一个小问号，点了重新打开那次问答。
 * 原文、译文两栏都画（两边的页一样大，位置按占整页的比例）。问过的地方从问答记录读（use-ask-threads）。 */
import type { ReactElement } from "react";
import { Button } from "@retainpdf/ui";

import type { ReaderAskAnchor } from "../contracts/ask.js";

/** 书页上的一个「?」：问的哪儿；存进问答记录以后有 threadId 和标题。 */
export type AskMark = { key: number; anchor: ReaderAskAnchor; threadId?: string; title?: string };

export function ReaderAskMarks({
  marks,
  page,
  height,
  onOpen,
}: {
  marks: readonly AskMark[];
  page: number;
  /** 这一页画出来多高（像素）。 */
  height: number;
  onOpen: (mark: AskMark) => void;
}): ReactElement | null {
  const here = marks.filter((mark) => mark.anchor.page === page);
  if (!here.length) return null;
  return (
    <div className="reader-ask-marks" aria-label="这一页问过的地方">
      {here.map((mark) => {
        const label = mark.title || mark.anchor.selection || mark.anchor.sourceText || `第 ${page} 页`;
        return (
          <Button
            key={mark.key}
            className="reader-ask-mark"
            style={{ top: Math.round((mark.anchor.point?.y ?? 0) * height) }}
            aria-label={`打开在这里的提问：${label.slice(0, 40)}`}
            title={`在这里问过：${label.slice(0, 80)}`}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => onOpen(mark)}
          >
            ?
          </Button>
        );
      })}
    </div>
  );
}
