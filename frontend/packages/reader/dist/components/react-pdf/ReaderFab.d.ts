import type { ReaderDownloadContext } from "../../hooks/use-reader-session.js";
import type { ReaderToolId } from "../../tools/registry.js";
export type ReaderFabProps = {
    /** 当前打开的工具 id；null 表示都关 */
    activeTool: ReaderToolId | null;
    sourceOnly: boolean;
    onToggleTool: (id: ReaderToolId) => void;
    download: ReaderDownloadContext;
};
export declare function ReaderFab({ activeTool, sourceOnly, onToggleTool, download, }: ReaderFabProps): import("react").JSX.Element;
//# sourceMappingURL=ReaderFab.d.ts.map