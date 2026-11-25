export type MathMarkdownEditorProps = {
    value: string;
    onChange: (value: string) => void;
    /** Esc、⌘/Ctrl+回车：写完了。 */
    onDone?: () => void;
    autoFocus?: boolean;
    placeholder?: string;
    className?: string;
};
export declare function MathMarkdownEditor({ value, onChange, onDone, autoFocus, placeholder, className }: MathMarkdownEditorProps): import("react").JSX.Element;
