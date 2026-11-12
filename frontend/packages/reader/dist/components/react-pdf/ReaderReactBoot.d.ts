import type { ReactElement } from "react";
export type ReaderReactBootProps = {
    loading: boolean;
    failed: boolean;
    text: string;
    percent: number;
    /** 可选产物失败标记：加载完成后以可关闭 notice 呈现，happy path 不显示。 */
    regionsError?: boolean;
    metadataError?: boolean;
    /** 「重试」：重新读任务和产物、重新下 PDF（会话的 refreshJobArtifacts）。不给就不画按钮。 */
    onRetry?: () => void;
};
export declare function ReaderReactBoot({ loading, failed, text, percent, regionsError, metadataError, onRetry, }: ReaderReactBootProps): ReactElement | null;
//# sourceMappingURL=ReaderReactBoot.d.ts.map