import { isMockMode } from "../config/runtime.js";
import { buildApiEndpoint, submitJson } from "./http.js";

export async function validatePaddleToken(apiPrefix, payload) {
  if (isMockMode()) {
    void apiPrefix;
    void payload;
    return {
      ok: true,
      valid: true,
      summary: "mock mode: token validation skipped",
    };
  }
  return submitJson(buildApiEndpoint(apiPrefix, "providers/paddle/validate-token"), payload);
}

export async function validateDeepSeekToken(apiPrefix, payload) {
  if (isMockMode()) {
    void apiPrefix;
    void payload;
    return {
      ok: true,
      valid: true,
      summary: "mock mode: token validation skipped",
    };
  }
  return submitJson(buildApiEndpoint(apiPrefix, "providers/deepseek/validate-token"), payload);
}

export async function queryDeepSeekBalance(apiPrefix, payload) {
  if (isMockMode()) {
    void apiPrefix;
    void payload;
    return {
      ok: true,
      status: "available",
      summary: "chế độ mock: DeepSeek số dư khả dụng: CNY 100.00",
      is_available: true,
      balance_infos: [
        {
          currency: "CNY",
          total_balance: "100.00",
          granted_balance: "0.00",
          topped_up_balance: "100.00",
        },
      ],
    };
  }
  return submitJson(buildApiEndpoint(apiPrefix, "providers/deepseek/balance"), payload);
}
