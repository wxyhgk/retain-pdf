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

/** 演示模式：假装从服务商拉回几个模型（带单价），不访问远端。 */
export async function fetchTranslationProviderModels(apiPrefix: string, payload: unknown) {
  void apiPrefix;
  void payload;
  const price = (input: number, output: number) => ({ input, output, cache_read: null, cache_write: null, peak_multiplier: null });
  return {
    ok: true,
    status: "ok",
    summary: "模拟模式：拉到 4 个模型（未访问远端）",
    source: "provider",
    chat_models: 3,
    models: [
      { id: "demo-flash", kind: "chat", price: price(0.05, 0.4) },
      { id: "demo-pro", kind: "chat", price: price(0.5, 2) },
      { id: "demo-mini", kind: "chat", price: null },
      { id: "demo-embedding", kind: "other", price: null },
    ],
  };
}

/** mock 模式没有错误码目录，失败卡片就只显示后端给的说法。 */
export async function fetchProviderErrorHint(apiPrefix: unknown, target: unknown) {
  void apiPrefix;
  void target;
  return null;
}
