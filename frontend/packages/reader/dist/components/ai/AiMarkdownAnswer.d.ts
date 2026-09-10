import { type AiCitationLike } from "../../shared/ai/answer-enhance.js";
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
export declare function AiMarkdownAnswer({ content, streaming, citations, jobId, className, streamingClassName, pendingClassName, finalClassName, citationFooterMax, onJumpCitation, }: AiMarkdownAnswerProps): import("react").JSX.Element;
//# sourceMappingURL=AiMarkdownAnswer.d.ts.map