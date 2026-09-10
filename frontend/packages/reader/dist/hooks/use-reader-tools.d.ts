import type { ReaderToolId } from "../tools/registry.js";
export type ReaderToolsApi = {
    active: ReaderToolId | null;
    open: (id: ReaderToolId) => void;
    close: (id?: ReaderToolId | null) => void;
    toggle: (id: ReaderToolId) => void;
    isOpen: (id: ReaderToolId) => boolean;
};
export declare function useReaderTools(): ReaderToolsApi;
//# sourceMappingURL=use-reader-tools.d.ts.map