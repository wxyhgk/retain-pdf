// providers — pure
import { buildApiEndpoint, submitJson } from "./http.js";

export async function validatePaddleToken(apiPrefix: string, payload: unknown): Promise<any> {
  return submitJson(buildApiEndpoint(apiPrefix, "providers/paddle/validate-token"), payload);
}

export async function validateDeepSeekToken(apiPrefix: string, payload: unknown): Promise<any> {
  return submitJson(buildApiEndpoint(apiPrefix, "providers/deepseek/validate-token"), payload);
}

export async function queryDeepSeekBalance(apiPrefix: string, payload: unknown): Promise<any> {
  return submitJson(buildApiEndpoint(apiPrefix, "providers/deepseek/balance"), payload);
}
