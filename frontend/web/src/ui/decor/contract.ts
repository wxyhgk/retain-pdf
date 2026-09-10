// 装饰包 manifest 契约：类型 + 校验 + 资产预算真值。
//
// 一个"装饰主题" = 配色皮肤（themes/<id>.css，既有体系不动）
//                + 装饰包（public 静态目录下 manifest.json + 资产）。
// registry.ts 的 ThemeDefinition.decorPack 指向包名；无 decorPack 的
// 皮肤（classic/night 等）零装饰、零额外下载。
//
// 契约先行：本文件是 manifest 的唯一 schema 真值。舞台引擎、资产管线
// 门禁、AI 产模型的验收标准都只认 validateDecorManifest 的结论。
// 设计文档：docs/core/frontend/theme-system/DECOR_PACKS.md

import { getDecorSlot, isDecorSlotId, type DecorSlotId } from "./slots.js";

export const DECOR_MANIFEST_VERSION = 1;

/* ---------- 资产预算（管线门禁与校验共用的真值） ---------- */

/** 单个 glb 模型体积上限（Draco+KTX2 压缩后） */
export const MODEL_BUDGET_KB = 2048;
/** 单个模型三角面上限（gltf-transform inspect 口径） */
export const MODEL_MAX_TRIANGLES = 50_000;
/** 单张装饰图体积上限（webp） */
export const IMAGE_BUDGET_KB = 512;
/** 单画布同时挂载的 3D 图层上限（超过就该做成图片层） */
export const MAX_MODEL_LAYERS = 3;
/** 单包图层总数上限（防"贴满屏"失控） */
export const MAX_LAYERS = 12;

/* ---------- manifest 类型 ---------- */

export type DecorImageLayer = {
  type: "image";
  slot: DecorSlotId;
  /** 相对包根目录的路径，如 "dragon.webp"；禁止绝对路径 / 协议 / ".." */
  src: string;
  /** 鼠标视差强度 0~0.2（0 或缺省 = 不动） */
  parallax?: number;
  /** 0~1，缺省 1 */
  opacity?: number;
  /** 点击图层时展示的语录（多句用 "\n\n" 分隔轮播；缺省 = 不可点） */
  clickQuote?: string;
};

export type DecorModelLayer = {
  type: "model";
  slot: DecorSlotId;
  /** .glb（Draco/KTX2 压缩后入库） */
  src: string;
  /** 静态图降级（reduced-motion / 无 WebGL / 低端机），必填 */
  fallback: string;
  /** 循环待机动画的 AnimationClip 名（glb 内置） */
  idleClip?: string;
  /** 点击触发的一次性 AnimationClip 名 */
  clickClip?: string;
  parallax?: number;
};

export type DecorLayer = DecorImageLayer | DecorModelLayer;

/** 题字横幅（如"知其所来 明其所往"） */
export type DecorQuote = {
  slot: DecorSlotId;
  text: string;
  /** 缺省 vertical（竖排） */
  writingMode?: "vertical" | "horizontal";
};

export type DecorManifest = {
  version: typeof DECOR_MANIFEST_VERSION;
  /** 包名，与目录名一致，kebab-case */
  id: string;
  layers: DecorLayer[];
  quote?: DecorQuote;
};

/* ---------- 校验 ---------- */

export type DecorManifestValidation =
  | { ok: true; manifest: DecorManifest; errors: [] }
  | { ok: false; manifest: null; errors: string[] };

const PACK_ID_RE = /^[a-z][a-z0-9-]*$/;
const IMAGE_EXT_RE = /\.(webp|png|svg|avif)$/i;
const MODEL_EXT_RE = /\.glb$/i;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** 相对路径且不逃逸包目录 */
function isSafeRelativePath(v: unknown): v is string {
  if (typeof v !== "string" || !v.trim()) return false;
  if (v.startsWith("/") || v.includes("..") || v.includes("\\")) return false;
  if (/^[a-z][a-z0-9+.-]*:/i.test(v)) return false; // http:, data: 等协议
  return true;
}

function checkClipName(v: unknown, label: string, errors: string[]) {
  if (v === undefined) return;
  if (typeof v !== "string" || !v.trim()) {
    errors.push(`${label} 必须是非空字符串（glb 内 AnimationClip 名）`);
  }
}

/**
 * 校验未知 JSON 是否为合法 manifest。
 * 返回 ok:false 时 errors 逐条可读，直接透给管线门禁/控制台。
 */
export function validateDecorManifest(input: unknown): DecorManifestValidation {
  const errors: string[] = [];
  if (!isPlainObject(input)) {
    return { ok: false, manifest: null, errors: ["manifest 必须是 JSON 对象"] };
  }

  if (input.version !== DECOR_MANIFEST_VERSION) {
    errors.push(`version 必须为 ${DECOR_MANIFEST_VERSION}，收到 ${JSON.stringify(input.version)}`);
  }
  if (typeof input.id !== "string" || !PACK_ID_RE.test(input.id)) {
    errors.push(`id 必须是 kebab-case 包名，收到 ${JSON.stringify(input.id)}`);
  }

  const layers = input.layers;
  if (!Array.isArray(layers) || layers.length === 0) {
    errors.push("layers 必须是非空数组");
    return { ok: false, manifest: null, errors };
  }
  if (layers.length > MAX_LAYERS) {
    errors.push(`layers 数量 ${layers.length} 超过上限 ${MAX_LAYERS}`);
  }

  const usedSlots = new Set<string>();
  let modelCount = 0;

  layers.forEach((raw, i) => {
    const at = `layers[${i}]`;
    if (!isPlainObject(raw)) {
      errors.push(`${at} 必须是对象`);
      return;
    }
    const { type, slot } = raw;

    if (type !== "image" && type !== "model") {
      errors.push(`${at}.type 必须是 "image" | "model"，收到 ${JSON.stringify(type)}`);
      return;
    }
    if (!isDecorSlotId(slot)) {
      errors.push(`${at}.slot ${JSON.stringify(slot)} 不在 slots.ts 注册表中`);
      return;
    }
    // 一个 slot 只挂一层：要堆叠就去 slots.ts 开新锚点，别在 manifest 里叠罗汉
    if (usedSlots.has(slot)) {
      errors.push(`${at}.slot "${slot}" 被重复占用（一个 slot 只挂一层）`);
    }
    usedSlots.add(slot);

    if (!isSafeRelativePath(raw.src)) {
      errors.push(`${at}.src 必须是包内相对路径（禁止绝对路径/协议/..）`);
    }

    if (raw.parallax !== undefined) {
      const p = raw.parallax;
      if (typeof p !== "number" || !(p >= 0 && p <= 0.2)) {
        errors.push(`${at}.parallax 必须在 [0, 0.2]，收到 ${JSON.stringify(p)}`);
      }
    }

    if (type === "image") {
      if (typeof raw.src === "string" && !IMAGE_EXT_RE.test(raw.src)) {
        errors.push(`${at}.src 图片仅接受 webp/png/svg/avif`);
      }
      if (raw.opacity !== undefined) {
        const o = raw.opacity;
        if (typeof o !== "number" || !(o > 0 && o <= 1)) {
          errors.push(`${at}.opacity 必须在 (0, 1]`);
        }
      }
      if (raw.clickQuote !== undefined) {
        if (typeof raw.clickQuote !== "string" || !raw.clickQuote.trim()) {
          errors.push(`${at}.clickQuote 必须是非空字符串（多句用 \\n\\n 分隔）`);
        }
      }
    } else {
      modelCount += 1;
      if (typeof raw.src === "string" && !MODEL_EXT_RE.test(raw.src)) {
        errors.push(`${at}.src 模型仅接受 .glb`);
      }
      if (!isSafeRelativePath(raw.fallback) || !IMAGE_EXT_RE.test(String(raw.fallback))) {
        errors.push(`${at}.fallback 必填且必须是包内图片路径（模型的静态降级）`);
      }
      checkClipName(raw.idleClip, `${at}.idleClip`, errors);
      checkClipName(raw.clickClip, `${at}.clickClip`, errors);
      const slotDef = getDecorSlot(slot);
      if (slotDef?.id === "backdrop") {
        errors.push(`${at} 背景 slot 禁止挂 3D 模型（性能红线，用 image + parallax）`);
      }
    }
  });

  if (modelCount > MAX_MODEL_LAYERS) {
    errors.push(`3D 图层 ${modelCount} 个，超过上限 ${MAX_MODEL_LAYERS}（多余的请烘焙成图片层）`);
  }

  const quote = input.quote;
  if (quote !== undefined) {
    if (!isPlainObject(quote)) {
      errors.push("quote 必须是对象");
    } else {
      if (!isDecorSlotId(quote.slot)) {
        errors.push(`quote.slot ${JSON.stringify(quote.slot)} 不在注册表中`);
      } else if (!getDecorSlot(quote.slot)?.textCapable) {
        errors.push(`quote.slot "${quote.slot}" 不支持文字（需 textCapable 锚点）`);
      }
      if (typeof quote.text !== "string" || !quote.text.trim()) {
        errors.push("quote.text 必须是非空字符串");
      }
      if (quote.writingMode !== undefined && quote.writingMode !== "vertical" && quote.writingMode !== "horizontal") {
        errors.push('quote.writingMode 必须是 "vertical" | "horizontal"');
      }
    }
  }

  if (errors.length > 0) return { ok: false, manifest: null, errors };
  return { ok: true, manifest: input as unknown as DecorManifest, errors: [] };
}
