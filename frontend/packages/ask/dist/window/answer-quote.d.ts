/** 回答里选字引用回复（2026-11-27）：在提问窗的回答上选一段字，输入框上面出「引用回答 · 37 字」（不弹别的，× 去掉）；
 * 发出去时把这段写成 Markdown 引用（「> …」）放在问题前面，所以 agent 看得到、存进对话、改问题和重新回答都照带。
 * 问题气泡里开头那段引用画成引用框（UserText），其余照旧是纯文字。
 */
import { type ReactElement, type RefObject } from "react";
/** 引用最多带多少字（超出截断加「…」）。 */
export declare const QUOTE_LIMIT = 600;
/** 选区里的字：公式换回 TeX（KaTeX 画出来的字会重复），段落之间换行，空白收拢，超长截断。 */
export declare function rangeText(range: Range, doc?: Document): string;
/** 选区两头都在这个窗口的某条回答里才算；不然 ""。 */
export declare function answerSelectionText(root: Element | null, selection: Selection | null): string;
/** 引用 + 问题 → 发出去的字。问题是空的不加（发不出去，引用留着）。 */
export declare function withQuote(quote: string, text: string): string;
/** 问题开头的引用（连续的「>」行，后面空一行）拆出来；没有是 null。 */
export declare function splitQuote(text: string): {
    quote: string;
    rest: string;
} | null;
type AnswerQuoteUi = {
    quote: string;
    clear: () => void;
};
/** 盯着窗口里的选区：选在回答上就记成下一问的引用。发出去的那段不再带第二次（选区还在也不重新冒出来）。 */
export declare function useAnswerQuote(root: RefObject<HTMLElement | null>, enabled?: boolean): {
    quote: string;
    ui: AnswerQuoteUi;
    prepareSend: (text: string) => string;
};
export declare function AnswerQuoteProvider({ value, children }: {
    value: AnswerQuoteUi;
    children: ReactElement;
}): ReactElement;
/** 输入框上面：「引用回答 · 37 字」，点开看那段，× 去掉。 */
export declare function AnswerQuoteBar(): ReactElement | null;
/** 输入框上面的两条：引用的回答、书上的出处。 */
export declare function ComposerBars(): ReactElement;
/** 问题气泡里的字：开头的引用画成引用框。 */
export declare function UserText({ text }: {
    text: string;
}): ReactElement;
export {};
