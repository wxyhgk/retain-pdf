import { type RefObject } from "react";
export type ReaderShellApi = {
    shellRef: RefObject<HTMLDivElement | null>;
    /** same node as shellRef.current; state for children that need re-render when mounted */
    shellEl: HTMLElement | null;
    shellWidth: number;
    /** half width for compare columns, min 160 */
    compareColWidth: number;
    bindShell: (node: HTMLDivElement | null) => void;
};
export declare function useReaderShell(options?: {
    /** called when shellWidth changes (e.g. repinIfRestoring) */
    onWidthChange?: (width: number) => void;
}): ReaderShellApi;
//# sourceMappingURL=use-reader-shell.d.ts.map