import type { ReactElement } from "react";

export type ReaderReactBootProps = {
  loading: boolean;
  failed: boolean;
  text: string;
  percent: number;
};

export function ReaderReactBoot({
  loading,
  failed,
  text,
  percent,
}: ReaderReactBootProps): ReactElement | null {
  if (!loading && !failed) {
    return null;
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
          {text}
        </div>
      ) : null}
    </>
  );
}
