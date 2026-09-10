import type { RefObject } from "react";
import { type ReaderPaneId } from "./reader-dom-contract.js";
export declare function useCurrentPage(scrollRef: RefObject<HTMLElement | null>, numPages: number, enabled?: boolean, 
/** 缩放 / 模式导致节点变化时重绑 */
observeKey?: string | number, 
/** 只看某一栏的页；空则看全部 */
pane?: ReaderPaneId | null): number;
//# sourceMappingURL=useCurrentPage.d.ts.map