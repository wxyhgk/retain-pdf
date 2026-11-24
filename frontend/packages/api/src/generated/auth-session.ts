// 生成文件，不要手改。来源：contracts/auth-session.v1.schema.json 的 endpoints。
// 重新生成：npm --prefix frontend/packages/api run generate:client

import type {
  SessionView,
} from "@retainpdf/contracts/auth-session";
import { encodePathParam, request, type RequestOptions } from "../request.js";

/** GET /api/v1/auth/session */
export function getAuthSession(
  apiPrefix: string | undefined,
  _args: Record<string, never> = {},
  options?: RequestOptions,
): Promise<SessionView> {
  return request<SessionView>({ apiPrefix, method: "GET", path: `auth/session`, options });
}
