import { type ReactElement } from "react";
import type { ReaderMenuContext, ReaderMenuItem } from "../../extensions/types.js";
export type ReaderPageSelection = {
    /** 收拾过的字。 */
    text: string;
    page: number;
    pane: "source" | "translated";
    /** 选区开头所在的文字层（给扩展的右键项认是哪一页）。 */
    layer: Element;
};
/** 现在书页文字层里选着的字；没选着、选的不是书页上的字是 null。 */
export declare function readPageSelection(selection?: Selection | null): ReaderPageSelection | null;
/** 写剪贴板：先用 clipboard API；不行（局域网 http 打开的页面没有）就让浏览器复制现在的选区，copy 事件里换成收拾过的字。 */
export declare function copySelectionText(text: string): Promise<boolean>;
/** 右键时选着书页上的字：菜单最上面的「复制」「收藏这段」（提问扩展的「问这段」跟在后面）。 */
export declare function selectionMenuItems(scope: string): ReaderMenuItem[];
/** 松手时：选区的头或尾在行内公式里，就撑到整个公式。改了返回 true。 */
export declare function snapSelectionToFormulas(selection: Selection | null): boolean;
export declare function ReaderSelectionLayer({ scope, menuItemsAt }: {
    /** 收藏存在哪本书下（和书签同一个 scope）；没有就不给收藏。 */
    scope: string;
    /** 扩展的右键项（取标了 inSelectionBar 的放进浮条）。 */
    menuItemsAt: (context: ReaderMenuContext) => readonly ReaderMenuItem[];
}): ReactElement;
//# sourceMappingURL=ReaderSelectionLayer.d.ts.map