import { type ReactElement } from "react";
import type { ReaderMenuSection } from "../../extensions/registry.js";
import type { ReaderMenuItem } from "../../extensions/types.js";
export type ReaderPageMenuState = {
    x: number;
    y: number;
    page: number;
} | null;
/** 这次右键要不要接（书页区里、没按 Shift、不在输入框里），接的话菜单钉在哪、是第几页（认不出是 0）。 */
export declare function pageMenuFromContextMenu(event: {
    shiftKey: boolean;
    target: EventTarget | null;
    clientX: number;
    clientY: number;
}): ReaderPageMenuState;
export declare function ReaderPageMenu({ menu, onClose, actions, sections, }: {
    menu: ReaderPageMenuState;
    onClose: () => void;
    actions: readonly ReaderMenuItem[];
    sections: readonly ReaderMenuSection[];
}): ReactElement | null;
//# sourceMappingURL=ReaderPageMenu.d.ts.map