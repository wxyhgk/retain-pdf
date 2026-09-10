import { useEffect, useRef, useState } from "react";
import { ExternalLink, FileText } from "lucide-react";
import type { AgentOperationView } from "../../domain/operations/types.js";

export function AgentCandidatePreview({
  operation,
  loadCandidate,
}: {
  operation: AgentOperationView;
  loadCandidate: (operation: AgentOperationView) => Promise<Blob>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [objectUrl, setObjectUrl] = useState("");
  const [error, setError] = useState("");
  const objectUrlRef = useRef("");

  useEffect(() => {
    let cancelled = false;
    setError("");
    void loadCandidate(operation)
      .then((blob) => {
        if (cancelled) return;
        const nextUrl = URL.createObjectURL(blob);
        if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = nextUrl;
        setObjectUrl(nextUrl);
      })
      .catch(() => {
        if (!cancelled) setError("候选 PDF 加载失败，请重试。");
      });
    return () => {
      cancelled = true;
    };
  }, [loadCandidate, operation.operation_id, operation.current_attempt]);

  useEffect(() => () => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
  }, []);

  return (
    <div className="home-ask-operation-candidate">
      <div className="home-ask-operation-candidate-head">
        <span><FileText size={14} aria-hidden />候选 PDF</span>
        <div>
          <button type="button" disabled={!objectUrl} onClick={() => setExpanded((value) => !value)}>
            {!objectUrl ? "加载中…" : expanded ? "收起预览" : "预览"}
          </button>
          <button
            type="button"
            disabled={!objectUrl}
            onClick={() => window.open(objectUrl, "_blank", "noopener,noreferrer")}
          >
            新窗口打开<ExternalLink size={12} aria-hidden />
          </button>
        </div>
      </div>
      {error ? <p className="home-ask-operation-error" role="alert">{error}</p> : null}
      {expanded ? (
        <iframe className="home-ask-operation-candidate-frame" src={objectUrl} title="Agent 候选 PDF 预览" />
      ) : null}
    </div>
  );
}
