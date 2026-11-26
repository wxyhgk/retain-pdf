// 提问窗里能点的页码：回答正文（markdown-text 的 a 组件）、工具调用的标题和结果都用它。点了交给宿主跳到那一页（AskWindowProps.onJumpToPage）。
import { createContext, useContext, type ReactElement, type ReactNode } from "react";
import { Button } from "@retainpdf/ui";

import { splitPageRefs } from "./page-citations.js";

export type AskPageJump = { pageCount: number; jump: (page: number) => void };

export const AskPageContext = createContext<AskPageJump | null>(null);

function usable(context: AskPageJump | null, page: number): context is AskPageJump {
  return Boolean(context) && page >= 1 && (!context!.pageCount || page <= context!.pageCount);
}

/** 一个页码标签。跳不了（没给跳转、页码超出这本书）就照原样显示字。 */
export function AskPageLink({ page, children }: { page: number; children: ReactNode }): ReactElement {
  const context = useContext(AskPageContext);
  if (!usable(context, page)) return <>{children}</>;
  return (
    <Button
      className="ask-page"
      title={`跳到第 ${page} 页`}
      onClick={(event) => {
        // 工具调用的标题在 <summary> 里：点页码不要顺带展开收起。
        event.preventDefault();
        event.stopPropagation();
        context.jump(page);
      }}
    >
      {children}
    </Button>
  );
}

/** 一段纯文字里的页码换成页码标签。 */
export function AskPageText({ text }: { text: string }): ReactElement {
  const context = useContext(AskPageContext);
  return (
    <>
      {splitPageRefs(text, context?.pageCount || 0).map((segment, index) => (segment.type === "page"
        ? <AskPageLink key={index} page={segment.page}>{segment.value}</AskPageLink>
        : <span key={index}>{segment.value}</span>))}
    </>
  );
}
