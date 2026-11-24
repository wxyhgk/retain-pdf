// 生成文件，不要手改。来源：contracts/credentials.v1.schema.json 的 endpoints。
// 重新生成：npm --prefix frontend/packages/api run generate:client

import type {
  CreateCredentialInput,
  CredentialDeleteView,
  CredentialListView,
  CredentialMutationView,
  DeleteCredentialQuery,
  UpdateCredentialInput,
} from "@retainpdf/contracts/credentials";
import { encodePathParam, request, type RequestOptions } from "../request.js";

/** GET /api/v1/credentials */
export function listCredentials(
  apiPrefix: string | undefined,
  _args: Record<string, never> = {},
  options?: RequestOptions,
): Promise<CredentialListView> {
  return request<CredentialListView>({ apiPrefix, method: "GET", path: `credentials`, options });
}

/** POST /api/v1/credentials */
export function createCredential(
  apiPrefix: string | undefined,
  args: { body: CreateCredentialInput },
  options?: RequestOptions,
): Promise<CredentialMutationView> {
  return request<CredentialMutationView>({ apiPrefix, method: "POST", path: `credentials`, body: args.body, options });
}

/** GET /api/v1/credentials/:credential_ref */
export function getCredential(
  apiPrefix: string | undefined,
  args: { credential_ref: string },
  options?: RequestOptions,
): Promise<CredentialMutationView> {
  return request<CredentialMutationView>({ apiPrefix, method: "GET", path: `credentials/${encodePathParam(args.credential_ref)}`, options });
}

/** PUT /api/v1/credentials/:credential_ref */
export function updateCredential(
  apiPrefix: string | undefined,
  args: { credential_ref: string; body: UpdateCredentialInput },
  options?: RequestOptions,
): Promise<CredentialMutationView> {
  return request<CredentialMutationView>({ apiPrefix, method: "PUT", path: `credentials/${encodePathParam(args.credential_ref)}`, body: args.body, options });
}

/** DELETE /api/v1/credentials/:credential_ref */
export function deleteCredential(
  apiPrefix: string | undefined,
  args: { credential_ref: string; query?: DeleteCredentialQuery },
  options?: RequestOptions,
): Promise<CredentialDeleteView> {
  return request<CredentialDeleteView>({ apiPrefix, method: "DELETE", path: `credentials/${encodePathParam(args.credential_ref)}`, query: args.query, options });
}
