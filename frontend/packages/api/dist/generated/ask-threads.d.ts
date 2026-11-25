import type { AskThreadDeleteResultView, AskThreadListView, AskThreadView, CreateAskThreadInput, PatchAskThreadInput } from "@retainpdf/contracts/ask-threads";
import { type RequestOptions } from "../request.js";
/** GET /api/v1/documents/:document_id/ask-threads */
export declare function listAskThreads(apiPrefix: string | undefined, args: {
    document_id: string;
}, options?: RequestOptions): Promise<AskThreadListView>;
/** POST /api/v1/documents/:document_id/ask-threads */
export declare function createAskThread(apiPrefix: string | undefined, args: {
    document_id: string;
    body: CreateAskThreadInput;
}, options?: RequestOptions): Promise<AskThreadView>;
/** GET /api/v1/documents/:document_id/ask-threads/:thread_id */
export declare function getAskThread(apiPrefix: string | undefined, args: {
    document_id: string;
    thread_id: string;
}, options?: RequestOptions): Promise<AskThreadView>;
/** PATCH /api/v1/documents/:document_id/ask-threads/:thread_id */
export declare function updateAskThread(apiPrefix: string | undefined, args: {
    document_id: string;
    thread_id: string;
    body: PatchAskThreadInput;
}, options?: RequestOptions): Promise<AskThreadView>;
/** DELETE /api/v1/documents/:document_id/ask-threads/:thread_id */
export declare function deleteAskThread(apiPrefix: string | undefined, args: {
    document_id: string;
    thread_id: string;
}, options?: RequestOptions): Promise<AskThreadDeleteResultView>;
