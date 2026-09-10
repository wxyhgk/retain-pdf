import { buildApiHeaders, unwrapEnvelope } from "./internal/runtime.js";
import { buildApiEndpoint } from "./http.js";

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

async function credentialRequest<T>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...buildApiHeaders(),
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...((options.headers as Record<string, string>) || {}),
    },
  });
  const envelope: any = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(
      `${envelope?.message || envelope?.error?.message || "凭据操作失败"}(${response.status})`,
    ) as CredentialRequestError;
    error.status = response.status;
    error.code = `${envelope?.code || envelope?.error_code || envelope?.error?.code || envelope?.details?.code || ""}`.trim();
    throw error;
  }
  return unwrapEnvelope<T>(envelope);
}

export function listCredentials(apiPrefix?: string): Promise<CredentialListView> {
  return credentialRequest(buildApiEndpoint(apiPrefix, "credentials"));
}

export function createCredential(
  apiPrefix: string | undefined,
  input: CreateCredentialInput,
): Promise<CredentialMutationView> {
  return credentialRequest(buildApiEndpoint(apiPrefix, "credentials"), {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateCredential(
  apiPrefix: string | undefined,
  credentialRef: string,
  input: UpdateCredentialInput,
): Promise<CredentialMutationView> {
  return credentialRequest(
    buildApiEndpoint(apiPrefix, `credentials/${encodeURIComponent(credentialRef)}`),
    { method: "PUT", body: JSON.stringify(input) },
  );
}

export function deleteCredential(
  apiPrefix: string | undefined,
  credentialRef: string,
  expectedRevision?: number,
): Promise<CredentialDeleteView> {
  const query = Number.isFinite(expectedRevision)
    ? `?expected_revision=${encodeURIComponent(String(expectedRevision))}`
    : "";
  return credentialRequest(
    `${buildApiEndpoint(apiPrefix, `credentials/${encodeURIComponent(credentialRef)}`)}${query}`,
    { method: "DELETE" },
  );
}
