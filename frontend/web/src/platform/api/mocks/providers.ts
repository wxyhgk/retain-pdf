// mock-only 适配器:index.ts 的 mockable() 只在 mock 模式调用这些实现。
export async function validateMineruToken(apiPrefix: string, payload: unknown) {
  void apiPrefix;
  void payload;
  return {
    ok: true,
    status: "valid",
    summary: "模拟模式：MinerU Token 检测通过（未访问远端）",
  };
}

export async function validatePaddleToken(apiPrefix: string, payload: unknown) {
  void apiPrefix;
  void payload;
  return {
    ok: true,
    valid: true,
    summary: "mock mode: token validation skipped",
  };
}

export async function validateDeepSeekToken(apiPrefix: string, payload: unknown) {
  void apiPrefix;
  void payload;
  return {
    ok: true,
    valid: true,
    summary: "mock mode: token validation skipped",
  };
}

export async function queryDeepSeekBalance(apiPrefix: string, payload: unknown) {
  void apiPrefix;
  void payload;
  return {
    ok: true,
    status: "available",
    summary: "mock mode: DeepSeek 余额可用：CNY 100.00",
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
