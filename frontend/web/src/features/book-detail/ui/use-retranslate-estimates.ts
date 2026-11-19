// 重新翻译下拉里每个模型的估价：清单打开时每条连接问一次后端（GET /documents/:id/usage/estimate），
// 答案按「服务商::模型」记着，同一本书、同一批连接不重问。问失败的就不显示估价。
import { useEffect, useState } from "react";
import type { UsageEstimateView } from "@/platform/api/index.js";
import { estimateText, type RetranslateModelOption } from "../domain/retranslate-model.js";

export function useRetranslateEstimates(
  options: readonly RetranslateModelOption[],
  estimate: ((baseUrl: string, model: string) => Promise<UsageEstimateView | null>) | undefined,
  enabled: boolean,
): (value: string) => string {
  const [prices, setPrices] = useState<Record<string, string>>({});
  const key = options.map((option) => option.value).join("|");
  useEffect(() => {
    if (!enabled || !estimate) return undefined;
    let disposed = false;
    for (const option of options) {
      const connection = option.connection;
      if (!connection) continue;
      estimate(connection.baseUrl, connection.model)
        .then((view) => {
          if (disposed) return;
          const text = estimateText(view);
          setPrices((current) => (current[option.value] === text ? current : { ...current, [option.value]: text }));
        })
        .catch(() => {});
    }
    return () => { disposed = true; };
    // options 跟着 key 变；estimate 是同一本书的同一个函数。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled, estimate]);
  return (value) => prices[value] || "";
}
