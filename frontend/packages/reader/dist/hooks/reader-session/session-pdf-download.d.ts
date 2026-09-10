import { type ProtectedPdfFile } from "../../pdf/useProtectedPdfFile.js";
import type { BootState } from "./types.js";
export type BootSetter = React.Dispatch<React.SetStateAction<BootState>>;
export type SessionLoadFence = {
    readonly signal: AbortSignal;
    isClosedOrStale: () => boolean;
    isInactive: () => boolean;
    markFailed: () => void;
};
export declare function createSessionLoadFence(options: {
    sessionEpochRef: React.MutableRefObject<{
        identity: string;
        value: number;
    }>;
    closingRef: React.MutableRefObject<boolean>;
    abort: AbortController;
    sessionEpoch: number;
}): SessionLoadFence;
export declare function downloadOnePdf(options: {
    url: string;
    label: string;
    percentStart: number;
    percentEnd: number;
    fence: SessionLoadFence;
    setBoot: BootSetter;
}): Promise<ProtectedPdfFile | null>;
export type JobPdfDownloadResult = {
    status: "downloaded";
    sourceBytes: ProtectedPdfFile | null;
    translatedBytes: ProtectedPdfFile | null;
} | {
    status: "inactive";
}
/** 需要的 PDF 未取到字节（调用方发布“PDF 下载失败，请重试”终态）。 */
 | {
    status: "incomplete";
};
/** 先下完所有 PDF 再返回；任一下载抛错时直接抛给调用方处理。 */
export declare function downloadJobPdfs(options: {
    sourceFinal: string;
    translatedFinal: string;
    fence: SessionLoadFence;
    setBoot: BootSetter;
}): Promise<JobPdfDownloadResult>;
//# sourceMappingURL=session-pdf-download.d.ts.map