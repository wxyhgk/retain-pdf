import { type MarkdownTextPrimitiveProps, memoizeMarkdownComponents } from "@assistant-ui/react-markdown";
import type { TextMessagePartProps } from "@assistant-ui/react";
type MarkdownTextProps = Partial<TextMessagePartProps> & {
    components?: Parameters<typeof memoizeMarkdownComponents>[0];
    componentsByLanguage?: MarkdownTextPrimitiveProps["componentsByLanguage"];
};
export declare const MarkdownText: import("react").NamedExoticComponent<MarkdownTextProps>;
export {};
//# sourceMappingURL=markdown-text.d.ts.map