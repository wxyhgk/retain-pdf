import { type MouseEvent as ReactMouseEvent } from "react";
import { type AiCitationLike } from "../../shared/ai/answer-enhance.js";
/**
 * Keep tiny OCR crops legible without stretching them across most of the chat
 * column. Larger figures retain the product-wide 70% answer width.
 */
export declare function syncAnswerImageDisplaySize(image: HTMLImageElement): void;
export type RetainMarkstreamProps = {
    content: string;
    final: boolean;
    indexKey: string;
    jobId: string;
    citations?: AiCitationLike[];
    onJumpCitation?: (citation: AiCitationLike) => void;
    onClickCapture?: (event: ReactMouseEvent<HTMLDivElement>) => void;
};
export declare function RetainMarkstream({ content, final, indexKey, jobId, citations, onJumpCitation, onClickCapture, }: RetainMarkstreamProps): import("react").JSX.Element;
//# sourceMappingURL=RetainMarkstream.d.ts.map