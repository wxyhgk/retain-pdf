import type { SessionView } from "@retainpdf/contracts/auth-session";
import { type RequestOptions } from "../request.js";
/** GET /api/v1/auth/session */
export declare function getAuthSession(apiPrefix: string | undefined, _args?: Record<string, never>, options?: RequestOptions): Promise<SessionView>;
