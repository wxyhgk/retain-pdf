import { type ReactElement } from "react";
import type { ReaderExtension } from "../../extensions/types.js";
import type { ReaderAssistantPanel } from "./reader-assistant-types.js";
export type ReaderBarPlace = "top" | "bottom" | "compare";
export declare function ReaderBarTools({ place, active, extensions: registered, }: {
    place: ReaderBarPlace;
    /** 开着哪个面板（顶栏的面板按钮按下）。 */
    active?: ReaderAssistantPanel | null;
    extensions?: readonly ReaderExtension[];
}): ReactElement | null;
//# sourceMappingURL=ReaderBarTools.d.ts.map