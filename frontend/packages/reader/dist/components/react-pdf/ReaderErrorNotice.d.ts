import { type ReactElement } from "react";
export type ReaderErrorNoticeProps = {
    /** 译文区域（regions）加载失败；可选产物，不阻塞正文阅读。 */
    regionsFailed?: boolean;
    /** 阅读元数据（metadata）加载失败；可选产物，不阻塞正文阅读。 */
    metadataFailed?: boolean;
    /** 「重试」：重新读一遍（会话的 refreshJobArtifacts）；不给就只有关闭。 */
    onRetry?: () => void;
};
/**
 * 可选产物失败的非阻塞提示。
 *
 * regions/metadata 失败时正文仍完全可读，因此不能复用致命错误屏，也不该遮挡
 * 阅读。这里只在外壳上浮一行可关闭的 notice；两端都正常（happy path）时不渲染。
 */
export declare function ReaderErrorNotice({ regionsFailed, metadataFailed, onRetry, }: ReaderErrorNoticeProps): ReactElement | null;
//# sourceMappingURL=ReaderErrorNotice.d.ts.map