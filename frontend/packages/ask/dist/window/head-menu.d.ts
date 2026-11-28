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
/** 下拉里的一项：左边图标、名字（下面一行灰的说明）、右边可以再放一点东西（条数）。宿主的下拉（阅读页的对话菜单）也用它，不用直接写这里的类名。 */
export declare function AskHeadMenuItem({ icon, label, hint, trailing, current, disabled, onClick }: {
    icon?: ReactNode;
    label: ReactNode;
    hint?: ReactNode;
    trailing?: ReactNode;
    /** 现在看的就是这一项。 */
    current?: boolean;
    disabled?: boolean;
    onClick: () => void;
}): ReactElement;
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
