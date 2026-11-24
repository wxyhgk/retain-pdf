// 生成文件，不要手改。来源：contracts/provider-probes.v1.schema.json 的 endpoints。
// 重新生成：npm --prefix frontend/packages/api run generate:client

import type {
  DeepSeekBalanceView,
  DeepSeekTokenValidationRequest,
  MineruTokenValidationRequest,
  PaddleTokenValidationRequest,
  ProviderProbeView,
} from "@retainpdf/contracts/provider-probes";
import { encodePathParam, request, type RequestOptions } from "../request.js";

/** POST /api/v1/providers/mineru/validate-token */
export function validateMineruToken(
  apiPrefix: string | undefined,
  args: { body: MineruTokenValidationRequest },
  options?: RequestOptions,
): Promise<ProviderProbeView> {
  return request<ProviderProbeView>({ apiPrefix, method: "POST", path: `providers/mineru/validate-token`, body: args.body, options });
}

/** POST /api/v1/providers/paddle/validate-token */
export function validatePaddleToken(
  apiPrefix: string | undefined,
  args: { body: PaddleTokenValidationRequest },
  options?: RequestOptions,
): Promise<ProviderProbeView> {
  return request<ProviderProbeView>({ apiPrefix, method: "POST", path: `providers/paddle/validate-token`, body: args.body, options });
}

/** POST /api/v1/providers/deepseek/validate-token */
export function validateDeepSeekToken(
  apiPrefix: string | undefined,
  args: { body: DeepSeekTokenValidationRequest },
  options?: RequestOptions,
): Promise<ProviderProbeView> {
  return request<ProviderProbeView>({ apiPrefix, method: "POST", path: `providers/deepseek/validate-token`, body: args.body, options });
}

/** POST /api/v1/providers/deepseek/balance */
export function queryDeepSeekBalance(
  apiPrefix: string | undefined,
  args: { body: DeepSeekTokenValidationRequest },
  options?: RequestOptions,
): Promise<DeepSeekBalanceView> {
  return request<DeepSeekBalanceView>({ apiPrefix, method: "POST", path: `providers/deepseek/balance`, body: args.body, options });
}
