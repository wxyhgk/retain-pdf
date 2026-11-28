import { type ReactElement, type ReactNode } from "react";
export declare function HostedDock({ width, onResize, children }: {
    width: number;
    /** 拖的时候一直调（done = false），松手调一次 done = true（记住）。 */
    onResize: (width: number, done: boolean) => void;
    children: ReactNode;
}): ReactElement;
