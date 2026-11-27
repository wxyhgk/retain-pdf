import { type ReactElement, type ReactNode } from "react";
export type AskHeadMenuProps = {
    /** summary 里的东西（按钮的样子）。 */
    label: ReactNode;
    /** summary 的悬停提示和读屏名。 */
    title: string;
    className?: string;
    /** 下拉里的东西；给函数时拿到 close（点了一项收起）。 */
    children: ReactNode | ((close: () => void) => ReactNode);
    /** 开了 / 收了（宿主按需读列表）。 */
    onOpenChange?: (open: boolean) => void;
};
export declare function AskHeadMenu({ label, title, className, children, onOpenChange }: AskHeadMenuProps): ReactElement;
/** 「···」里的一项。 */
export type AskHeaderMenuItem = {
    key: string;
    label: string;
    /** 一句说明（灰的，写在下面）。 */
    hint?: string;
    icon?: ReactNode;
    onSelect: () => void;
};
/** 标题栏右边的「···」：不常用的（阅读页：记忆）。没有项就不画。 */
export declare function AskMoreMenu({ items }: {
    items: readonly AskHeaderMenuItem[];
}): ReactElement | null;
