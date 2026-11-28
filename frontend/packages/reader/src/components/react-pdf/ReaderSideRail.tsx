// 书页区右缘的竖图标条（2026-11-28 用户：顶栏右边的「AI 回答 / Markdown」和「下载」拿掉，放到右侧，悬浮）。
// 和左缘的目录短横线对称：竖着居中浮在书页区右边，不占一栏；上面是打开右边停靠栏的面板按钮（提问、Markdown，
// 来自贡献表 place 不写或 "side" 的那些），一道细线，下面是下载（点开往左弹出原文 / 对照 / 译文 PDF）。
// 停靠栏开着时它在书页区里，跟着停在停靠栏左边。
import type { ReactElement } from "react";

import { ReaderBarTools } from "./ReaderBarTools.js";
import { ReaderDownloadActions } from "./ReaderDownloadActions.js";
import type { ReaderAssistantPanel } from "./reader-assistant-types.js";

export function ReaderSideRail({ active }: { active: ReaderAssistantPanel | null }): ReactElement {
  return (
    <div className="reader-side-rail" role="toolbar" aria-orientation="vertical" aria-label="面板和下载">
      <ReaderBarTools place="side" active={active} />
      <span className="reader-side-rail-sep" aria-hidden />
      <ReaderDownloadActions />
    </div>
  );
}
