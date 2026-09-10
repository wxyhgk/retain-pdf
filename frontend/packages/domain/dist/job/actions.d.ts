export declare function resolveJobActions(job: any): {
    cancelEnabled: boolean;
    rerunEnabled: boolean;
    bundleEnabled: boolean;
    pdfEnabled: boolean;
    markdownJsonEnabled: boolean;
    markdownRawEnabled: boolean;
    cancel: string;
    rerun: string;
    bundle: string;
    pdf: string;
    markdownJson: string;
    markdownRaw: string;
};
export declare function resolveJobMarkdownBundleAction(job: any, manifestPayload?: any): {
    ready: boolean;
    url: string;
};
export declare function resolveJobSourcePdfAction(job: any, manifestPayload?: any): {
    ready: boolean;
    url: string;
};
