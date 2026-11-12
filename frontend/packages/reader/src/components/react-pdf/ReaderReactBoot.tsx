import type { ReactElement } from "react";
import { Button } from "@retainpdf/ui";
import { ReaderErrorNotice } from "./ReaderErrorNotice.js";

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

export function ReaderReactBoot({
  loading,
  failed,
  text,
  percent,
  regionsError = false,
  metadataError = false,
  onRetry,
}: ReaderReactBootProps): ReactElement | null {
  if (!loading && !failed) {
    return (
      <ReaderErrorNotice regionsFailed={regionsError} metadataFailed={metadataError} onRetry={onRetry} />
    );
  }

  return (
    <>
      {loading ? (
        <div className="reader-boot-loading" data-reader-boot-loading="true">
          <div className="reader-boot-loading-card">
            <div className="reader-boot-loading-text">{text}</div>
            <div className="reader-boot-loading-track">
              <span
                className="reader-boot-loading-bar"
                style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
              />
            </div>
          </div>
        </div>
      ) : null}
      {failed ? (
        <div className="reader-react-error" role="alert">
          <span className="reader-react-error-text">{text}</span>
          {onRetry ? (
            <Button className="reader-react-error-retry" data-reader-retry="boot" onClick={onRetry}>重试</Button>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
