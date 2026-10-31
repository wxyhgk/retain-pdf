export type FormStatusTone = "valid" | "error" | "pending" | "";
export declare function statusToneOf(status: {
    message?: unknown;
    tone?: unknown;
} | null | undefined): {
    text: string;
    tone: FormStatusTone;
    pending: boolean;
};
export declare function FormStatusLine({ id, status, className, }: {
    id?: string;
    status: {
        message?: unknown;
        tone?: unknown;
    } | null | undefined;
    className?: string;
}): import("react").JSX.Element;
//# sourceMappingURL=form-status-line.d.ts.map