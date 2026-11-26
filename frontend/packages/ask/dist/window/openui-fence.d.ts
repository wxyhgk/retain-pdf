/** 回答里 ```openui-lang 代码块的位置（markdown-text 按语言换掉代码块）：懒加载 OpenUIBlock，判断深浅色、是不是还在流式。 */
import { type ReactElement } from "react";
import type { SyntaxHighlighterProps } from "@assistant-ui/react-markdown";
export declare const OPENUI_FENCES: readonly ["openui-lang", "openui"];
/** 底色的亮度（0–1）：提问窗不认识宿主的皮肤列表，按自己的底色判断深浅。 */
export declare function luminance(color: string): number | null;
export declare function OpenUIFence({ code }: SyntaxHighlighterProps): ReactElement;
/** 互动块不要代码块的标题栏（语言名、复制）。 */
export declare function NoHeader(): null;
/** 给 markdown-text 的 componentsByLanguage。 */
export declare const OPENUI_COMPONENTS_BY_LANGUAGE: {
    [k: string]: {
        CodeHeader: typeof NoHeader;
        SyntaxHighlighter: typeof OpenUIFence;
    };
};
