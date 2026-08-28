// Bộ lập kế hoạch sân khấu: manifest (JSON chưa biết) → kế hoạch render (dữ liệu thuần).
//
// Component DecorStage chỉ dùng output ở đây và không tự phân tích manifest —
// validation/hạ cấp/phân tích đường dẫn đều nằm trong hàm thuần để node:test
// kiểm tra trực tiếp (không cần mount component bằng jsdom).
//
// Chuỗi hạ cấp (hợp đồng docs/theme-system/DECOR_PACKS.md):
// - lớp model trên sân khấu ảnh/không có WebGL/reduced-motion → render ảnh tĩnh fallback
// - reduced-motion → đưa mọi parallax về 0
// Hợp đồng: ./contract.ts · anchor: ./slots.ts

import { validateDecorManifest } from "./contract.js";
import { getDecorSlot, type DecorLayerBand, type DecorSlotId } from "./slots.js";

export type StageLayerPlan = {
  key: string;
  slot: DecorSlotId;
  band: DecorLayerBand;
  /** Địa chỉ ảnh đã ghép assetBase (model trên sân khấu ảnh chính là fallback của nó) */
  src: string;
  /** 0 = không chuyển động (bắt buộc 0 khi reduced-motion) */
  parallax: number;
  opacity: number;
  /** Trích dẫn hiển thị khi click vào layer (tùy chọn cho layer image; phân cách nhiều câu bằng "\n\n") */
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
  /** URL gốc của gói trang trí (không có dấu gạch cuối), ví dụ "decor/jiangnan" */
  assetBase: string;
  /** prefers-reduced-motion: parallax về 0 (sân khấu bản ảnh vốn không render 3D) */
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
    // Sân khấu bản ảnh: layer model luôn dùng ảnh fallback tĩnh (sau khi tích hợp engine three sẽ phân luồng theo khả năng)
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
