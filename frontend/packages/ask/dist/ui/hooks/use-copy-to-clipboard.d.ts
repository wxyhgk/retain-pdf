export type UseCopyToClipboardOptions = {
    copiedDuration?: number;
};
export declare const useCopyToClipboard: ({ copiedDuration, }?: UseCopyToClipboardOptions) => {
    isCopied: boolean;
    copyToClipboard: (value: string) => void;
};
