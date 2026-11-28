import { type ReactElement } from "react";
import type { AskAttachTool } from "../contract.js";
export type AttachToolsUi = {
    tools: readonly AskAttachTool[];
    add: (file: File) => Promise<void>;
};
export declare const AttachToolsContext: import("react").Context<AttachToolsUi>;
export declare function AttachTools(): ReactElement | null;
/** AskWindow 用：宿主的按钮、塞进来的附件（id 变了就加），都加进输入框（runtime 的附件适配器管类型、大小上限）。 */
export declare function useHostAttachments(runtime: {
    thread: {
        composer: {
            addAttachment: (file: File) => Promise<void>;
        };
    };
}, tools: readonly AskAttachTool[] | undefined, request: {
    id: number;
    files: readonly File[];
} | null | undefined): {
    attachUi: AttachToolsUi;
    attachError: string;
};
