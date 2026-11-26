import { Fragment as _Fragment, jsx as _jsx } from "react/jsx-runtime";
// 提问窗里能点的页码：回答正文（markdown-text 的 a 组件）、工具调用的标题和结果都用它。点了交给宿主跳到那一页（AskWindowProps.onJumpToPage）。
import { createContext, useContext } from "react";
import { Button } from "@retainpdf/ui";
import { splitPageRefs } from "./page-citations.js";
export const AskPageContext = createContext(null);
function usable(context, page) {
    return Boolean(context) && page >= 1 && (!context.pageCount || page <= context.pageCount);
}
/** 一个页码标签。跳不了（没给跳转、页码超出这本书）就照原样显示字。 */
export function AskPageLink({ page, children }) {
    const context = useContext(AskPageContext);
    if (!usable(context, page))
        return _jsx(_Fragment, { children: children });
    return (_jsx(Button, { className: "ask-page", title: `跳到第 ${page} 页`, onClick: (event) => {
            // 工具调用的标题在 <summary> 里：点页码不要顺带展开收起。
            event.preventDefault();
            event.stopPropagation();
            context.jump(page);
        }, children: children }));
}
/** 一段纯文字里的页码换成页码标签。 */
export function AskPageText({ text }) {
    const context = useContext(AskPageContext);
    return (_jsx(_Fragment, { children: splitPageRefs(text, context?.pageCount || 0).map((segment, index) => (segment.type === "page"
            ? _jsx(AskPageLink, { page: segment.page, children: segment.value }, index)
            : _jsx("span", { children: segment.value }, index))) }));
}
