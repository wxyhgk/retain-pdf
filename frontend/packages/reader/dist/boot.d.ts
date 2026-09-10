import { type Root } from "react-dom/client";
export type ReaderBootOptions = {
    body?: HTMLElement;
    root?: HTMLElement;
    purgeLegacyMarkup?: boolean;
};
export declare function syncReaderBodyClasses(body?: HTMLElement): void;
export declare function purgeLegacyMarkup(body?: HTMLElement, preservedRoot?: HTMLElement): void;
export declare function resolveReaderRoot(body?: HTMLElement): HTMLElement;
export declare function bootReader(options?: ReaderBootOptions): Root;
//# sourceMappingURL=boot.d.ts.map