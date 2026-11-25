/** 书页上的「?」：这次打开里问过的地方，书页左边白边里一个小问号，点了重新打开那次问答。
 * 原文、译文两栏都画（两边的页一样大，位置按占整页的比例）。问答记录后端能存以后从后端读。 */
import type { ReactElement } from "react";
import { Button } from "@retainpdf/ui";

import type { ReaderAskAnchor } from "../contracts/ask.js";

export type AskMark = { key: number; anchor: ReaderAskAnchor };

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
        const label = mark.anchor.selection || mark.anchor.sourceText || `第 ${page} 页`;
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
