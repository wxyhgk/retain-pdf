import { useEffect, useState, type ReactElement } from "react";
import { Button } from "@retainpdf/ui";

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
export function ReaderErrorNotice({
  regionsFailed = false,
  metadataFailed = false,
  onRetry,
}: ReaderErrorNoticeProps): ReactElement | null {
  const [dismissed, setDismissed] = useState(false);
  // 错误全部消失（如切换到另一个文档）后重新武装：新会话再次失败时提示应再次出现。
  useEffect(() => {
    if (!regionsFailed && !metadataFailed) {
      setDismissed(false);
    }
  }, [regionsFailed, metadataFailed]);

  if (dismissed || (!regionsFailed && !metadataFailed)) {
    return null;
  }

  const failedParts = [
    regionsFailed ? "译文区域" : "",
    metadataFailed ? "阅读元数据" : "",
  ].filter(Boolean);

  return (
    <div className="reader-error-notice" role="status" data-reader-error-notice="true">
      <span className="reader-error-notice-text">
        {failedParts.join("、")}加载失败，正文仍可正常阅读。
      </span>
      {onRetry ? (
        <Button className="reader-error-notice-retry" data-reader-retry="optional" onClick={onRetry}>重试</Button>
      ) : null}
      <button
        type="button"
        className="reader-error-notice-dismiss"
        aria-label="关闭提示"
        onClick={() => setDismissed(true)}
      >
        ×
      </button>
    </div>
  );
}
