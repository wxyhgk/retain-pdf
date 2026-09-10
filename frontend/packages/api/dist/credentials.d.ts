export type CredentialKind = "translation_api_key" | "ocr_provider_token" | string;
export type CredentialMetadata = {
    credential_ref: string;
    kind: CredentialKind;
    provider: string;
    label: string;
    configured: boolean;
    revision: number;
    created_at: string;
    updated_at: string;
};
export type CredentialListView = {
    credentials: CredentialMetadata[];
    revision: number;
};
export type CredentialMutationView = {
    credential: CredentialMetadata;
    revision: number;
};
export type CredentialDeleteView = {
    credential_ref: string;
    deleted: boolean;
    revision: number;
};
export type CreateCredentialInput = {
    kind: CredentialKind;
    provider?: string;
    label?: string;
    secret: string;
    expected_revision?: number;
};
export type UpdateCredentialInput = {
    kind?: CredentialKind;
    provider?: string;
    label?: string;
    secret?: string;
    expected_revision?: number;
    expected_credential_revision?: number;
};
export interface CredentialRequestError extends Error {
    status?: number;
    code?: string;
}
export declare function listCredentials(apiPrefix?: string): Promise<CredentialListView>;
export declare function createCredential(apiPrefix: string | undefined, input: CreateCredentialInput): Promise<CredentialMutationView>;
export declare function updateCredential(apiPrefix: string | undefined, credentialRef: string, input: UpdateCredentialInput): Promise<CredentialMutationView>;
export declare function deleteCredential(apiPrefix: string | undefined, credentialRef: string, expectedRevision?: number): Promise<CredentialDeleteView>;
