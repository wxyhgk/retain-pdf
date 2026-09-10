// 舞台计划器：manifest(未知 JSON) → 渲染计划(纯数据)。
//
// DecorStage 组件只消费这里的输出，不自己解析 manifest——校验/降级/路径
// 解析全部收在纯函数里，方便 node:test 直测（不用 jsdom 挂组件）。
//
// 降级链（契约 docs/core/frontend/theme-system/DECOR_PACKS.md）：
// - model 层在图片版舞台/无 WebGL/reduced-motion 下 → 渲染 fallback 静态图
// - reduced-motion → 所有 parallax 归零
// 契约：./contract.ts · 锚点：./slots.ts

import { validateDecorManifest } from "./contract.js";
import { getDecorSlot, type DecorLayerBand, type DecorSlotId } from "./slots.js";

export type StageLayerPlan = {
  key: string;
  slot: DecorSlotId;
  band: DecorLayerBand;
  /** 已拼上 assetBase 的图片地址（model 层在图片版舞台=其 fallback） */
  src: string;
  /** 0 = 不动（reduced-motion 下强制 0） */
  parallax: number;
  opacity: number;
  /** 点击图层展示的语录（image 层可选；多句 "\n\n" 分隔） */
  clickQuote?: string;
};

export type StageQuotePlan = {
  slot: DecorSlotId;
  band: DecorLayerBand;
  text: string;
  writingMode: "vertical" | "horizontal";
};

export type StagePlan = {
  layers: StageLayerPlan[];
  quote: StageQuotePlan | null;
};

export type StagePlanResult =
  | { ok: true; plan: StagePlan; errors: [] }
  | { ok: false; plan: null; errors: string[] };

export type StagePlanOptions = {
  /** 装饰包根 URL（不带尾斜杠），如 "decor/jiangnan" */
  assetBase: string;
  /** prefers-reduced-motion：parallax 归零（图片版舞台本就不渲染 3D） */
  reducedMotion?: boolean;
};

export function planStage(input: unknown, options: StagePlanOptions): StagePlanResult {
  const validated = validateDecorManifest(input);
  if (!validated.ok) {
    return { ok: false, plan: null, errors: validated.errors };
  }
  const { manifest } = validated;
  const base = options.assetBase.replace(/\/+$/, "");
  const reduced = !!options.reducedMotion;

  const layers: StageLayerPlan[] = manifest.layers.map((layer, i) => {
    const band = getDecorSlot(layer.slot)?.band ?? "mid";
    // 图片版舞台：model 层一律走静态降级图（three 引擎接入后再按能力分流）
    const file = layer.type === "model" ? layer.fallback : layer.src;
    return {
      key: `${manifest.id}:${i}:${layer.slot}`,
      slot: layer.slot,
      band,
      src: `${base}/${file}`,
      parallax: reduced ? 0 : layer.parallax ?? 0,
      opacity: layer.type === "image" ? layer.opacity ?? 1 : 1,
      clickQuote: layer.type === "image" ? layer.clickQuote : undefined,
    };
  });

  const quote: StageQuotePlan | null = manifest.quote
    ? {
        slot: manifest.quote.slot,
        band: getDecorSlot(manifest.quote.slot)?.band ?? "mid",
        text: manifest.quote.text,
        writingMode: manifest.quote.writingMode ?? "vertical",
      }
    : null;

  return { ok: true, plan: { layers, quote }, errors: [] };
}
