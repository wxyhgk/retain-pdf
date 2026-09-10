import { useEffect, useId, useMemo, useRef } from "react";
import {
  decorateCitationMarkdown,
  isAgenticCitation,
  renderCitationFooter,
  revokeHydratedImageUrls,
  type AiCitationLike,
} from "../../shared/ai/answer-enhance.js";
import { RetainMarkstream } from "./RetainMarkstream.js";

export type AiMarkdownAnswerProps = {
  content: string;
  streaming?: boolean;
  citations?: AiCitationLike[];
  jobId?: string;
  className?: string;
  streamingClassName?: string;
  pendingClassName?: string;
  finalClassName?: string;
  citationFooterMax?: number;
  onJumpCitation?: (citation: AiCitationLike) => void;
};

/**
 * Single Markstream renderer for Reader and home AI answers. It owns Markdown/Math render,
 * citation injection and authenticated current-job image hydration.
 */
export function AiMarkdownAnswer({
  content,
  streaming = false,
  citations = [],
  jobId = "",
  className = "",
  streamingClassName = "",
  pendingClassName = "",
  finalClassName = "",
  citationFooterMax = 5,
  onJumpCitation,
}: AiMarkdownAnswerProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const rendererId = useId();
  const bodyText = streaming ? `${content || ""}` : `${content || ""}`.trim();
  const resolvedJobId = `${jobId || citations.find((item) => item.job_id)?.job_id || ""}`.trim();

  const citationByRef = useMemo(() => {
    const map = new Map<string, AiCitationLike>();
    for (const citation of citations) {
      if (isAgenticCitation(citation)) map.set(`${citation.ref}`, citation);
    }
    return map;
  }, [citations]);
  const renderedBody = useMemo(
    () => decorateCitationMarkdown(bodyText, citationByRef),
    [bodyText, citationByRef],
  );
  useEffect(() => {
    const root = rootRef.current;
    if (!root || !bodyText) return;
    const bubble = root.parentElement;
    if (!(bubble instanceof HTMLElement)) return;
    if (streaming) {
      bubble.querySelector(".reader-ai-citations")?.remove();
      return;
    }
    renderCitationFooter(bubble, citations, {
      onJump: (citation) => onJumpCitation?.(citation),
      answerText: bodyText,
      max: citationFooterMax,
    });
  }, [streaming, resolvedJobId, citationByRef, citations, onJumpCitation, bodyText, citationFooterMax]);

  useEffect(() => () => revokeHydratedImageUrls(rootRef.current), []);

  if (!bodyText.trim()) return null;
  const stateClassName = streaming
    ? streamingClassName
    : finalClassName || pendingClassName;
  return (
    <div ref={rootRef} className={`${className} ${stateClassName}`.trim()}>
      <RetainMarkstream
        content={renderedBody}
        final={!streaming}
        indexKey={rendererId}
        jobId={resolvedJobId}
        citations={citations}
        onJumpCitation={onJumpCitation}
        onClickCapture={(event) => {
          const target = event.target;
          if (!(target instanceof Element)) return;
          if (target.closest("a[href]")) {
            event.preventDefault();
            event.stopPropagation();
          }
        }}
      />
    </div>
  );
}
