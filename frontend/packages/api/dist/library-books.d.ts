import type { LibraryBookListView, LibraryDeleteResultView } from "@retainpdf/contracts/library-books";
export declare function fetchLibraryBookList(apiPrefix: string, { limit, offset, q, jobIds }?: {
    jobIds?: string[];
    limit?: number;
    offset?: number;
    q?: string;
}): Promise<LibraryBookListView>;
export declare function deleteLibraryBook(apiPrefix: string, jobId: string, { force }?: {
    force?: boolean;
}): Promise<LibraryDeleteResultView>;
