/** 某处前面连着几个反斜杠（奇数个就是转义）。 */
export declare function backslashesBefore(text: string, index: number): number;
export type LatexCommand = {
    /** As typed: `\frac`. */
    name: string;
    /** What is inserted; `‸` is where the caret goes. */
    insert: string;
    /** A formula that shows what it draws. */
    preview: string;
};
/** A change to a formula's text: replace [from, to) with `insert`, then the caret at `caret`. */
export type LatexEdit = {
    from: number;
    to: number;
    insert: string;
    caret: number;
};
/** The commands to complete from: the article's macros first, then LaTeX's. */
export declare function latexCommands(macros?: Record<string, unknown>): LatexCommand[];
/** The command being typed at the caret, `\al|` or `\al|pha`: what it replaces, and its letters before the caret. */
export declare function completionQuery(text: string, caret: number): {
    from: number;
    to: number;
    prefix: string;
} | null;
/**
 * The commands that complete `prefix`: an exact match first, then those it
 * starts with in this case, then in any case; in the list's order (the
 * common ones first). Nothing to offer when the command is already whole.
 */
export declare function completeLatex(prefix: string, commands: LatexCommand[], limit?: number): LatexCommand[];
/** Writes a command in place of what the query covers; the caret where its template says. */
export declare function applyCompletion(text: string, query: {
    from: number;
    to: number;
}, command: LatexCommand): LatexEdit;
/**
 * A brace typed: `{` comes with its `}` (around the selection, if any; `\{`
 * with `\}`), and `}` steps over the `}` already there when the braces pair up.
 * Null: type it as it is.
 */
export declare function typeBrace(text: string, start: number, end: number, brace: '{' | '}'): LatexEdit | null;
/** Backspace between an empty `{}` deletes both. */
export declare function deleteBracePair(text: string, start: number, end: number): LatexEdit | null;
/** Tab: into the next `{…}` after the caret. Null when there is none. */
export declare function nextSlot(text: string, caret: number): number | null;
