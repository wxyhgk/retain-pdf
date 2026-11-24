import type { CreateCredentialInput, CredentialDeleteView, CredentialListView, CredentialMutationView, DeleteCredentialQuery, UpdateCredentialInput } from "@retainpdf/contracts/credentials";
import { type RequestOptions } from "../request.js";
/** GET /api/v1/credentials */
export declare function listCredentials(apiPrefix: string | undefined, _args?: Record<string, never>, options?: RequestOptions): Promise<CredentialListView>;
/** POST /api/v1/credentials */
export declare function createCredential(apiPrefix: string | undefined, args: {
    body: CreateCredentialInput;
}, options?: RequestOptions): Promise<CredentialMutationView>;
/** GET /api/v1/credentials/:credential_ref */
export declare function getCredential(apiPrefix: string | undefined, args: {
    credential_ref: string;
}, options?: RequestOptions): Promise<CredentialMutationView>;
/** PUT /api/v1/credentials/:credential_ref */
export declare function updateCredential(apiPrefix: string | undefined, args: {
    credential_ref: string;
    body: UpdateCredentialInput;
}, options?: RequestOptions): Promise<CredentialMutationView>;
/** DELETE /api/v1/credentials/:credential_ref */
export declare function deleteCredential(apiPrefix: string | undefined, args: {
    credential_ref: string;
    query?: DeleteCredentialQuery;
}, options?: RequestOptions): Promise<CredentialDeleteView>;
