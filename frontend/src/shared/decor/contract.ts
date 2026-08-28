// Contract manifest gói trang trí: Type + Validation + Ngân sách tài sản.
//
// Một "chủ đề trang trí" = Skin phối màu (themes/<id>.css, hệ thống hiện có giữ nguyên)
//                + Gói trang trí (manifest.json + tài sản trong thư mục tĩnh public).
// ThemeDefinition.decorPack trong registry.ts trỏ đến tên gói; skin không có decorPack
// (classic/night v.v.) không có trang trí, không tải thêm.
//
// Contract trước tiên: File này là schema duy nhất cho manifest. Engine sân khấu, pipeline tài sản,
// tiêu chuẩn nghiệm thu model AI đều chỉ công nhận kết luận của validateDecorManifest.
// Tài liệu thiết kế: docs/theme-system/DECOR_PACKS.md

import { getDecorSlot, isDecorSlotId, type DecorSlotId } from "./slots.js";

export const DECOR_MANIFEST_VERSION = 1;

/* ---------- Ngân sách asset (nguồn sự thật dùng chung cho cổng pipeline và validation) ---------- */

/** Giới hạn dung lượng một model glb (sau nén Draco+KTX2) */
export const MODEL_BUDGET_KB = 2048;
/** Giới hạn số mặt tam giác của một model (theo gltf-transform inspect) */
export const MODEL_MAX_TRIANGLES = 50_000;
/** Giới hạn dung lượng một ảnh trang trí (webp) */
export const IMAGE_BUDGET_KB = 512;
/** Giới hạn số layer 3D gắn đồng thời trên một canvas (vượt quá nên chuyển thành layer ảnh) */
export const MAX_MODEL_LAYERS = 3;
/** Giới hạn tổng layer trong một gói (tránh mất kiểm soát vì "dán kín màn hình") */
export const MAX_LAYERS = 12;

/* ---------- Types manifest ---------- */

export type DecorImageLayer = {
  type: "image";
  slot: DecorSlotId;
  /** Đường dẫn tương đối so với gốc gói, ví dụ "dragon.webp"; cấm đường dẫn tuyệt đối / giao thức / ".." */
  src: string;
  /** Cường độ parallax chuột 0~0.2 (0 hoặc mặc định = không động) */
  parallax?: number;
  /** 0~1, mặc định 1 */
  opacity?: number;
  /** Trích dẫn hiển thị khi click vào layer (nhiều câu phân cách bằng "\\n\\n" xoay vòng; mặc định = không thể click) */
  clickQuote?: string;
};

export type DecorModelLayer = {
  type: "model";
  slot: DecorSlotId;
  /** .glb (sau nén Draco/KTX2 trước khi nhập kho) */
  src: string;
  /** Ảnh fallback tĩnh (reduced-motion / không WebGL / máy cấu hình thấp), bắt buộc */
  fallback: string;
  /** Tên AnimationClip của animation standby vòng lặp (built-in trong glb) */
  idleClip?: string;
  /** Tên AnimationClip của animation một lần khi click */
  clickClip?: string;
  parallax?: number;
};

export type DecorLayer = DecorImageLayer | DecorModelLayer;

/** Banner đề chữ (ví dụ "Tri kỳ sở lai Minh kỳ sở vãng") */
export type DecorQuote = {
  slot: DecorSlotId;
  text: string;
  /** Mặc định vertical (dọc) */
  writingMode?: "vertical" | "horizontal";
};

export type DecorManifest = {
  version: typeof DECOR_MANIFEST_VERSION;
  /** Tên gói, trùng tên thư mục, kebab-case */
  id: string;
  layers: DecorLayer[];
  quote?: DecorQuote;
};

/* ---------- Validation ---------- */

export type DecorManifestValidation =
  | { ok: true; manifest: DecorManifest; errors: [] }
  | { ok: false; manifest: null; errors: string[] };

const PACK_ID_RE = /^[a-z][a-z0-9-]*$/;
const IMAGE_EXT_RE = /\.(webp|png|svg|avif)$/i;
const MODEL_EXT_RE = /\.glb$/i;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Đường dẫn tương đối và không thoát khỏi thư mục gói */
function isSafeRelativePath(v: unknown): v is string {
  if (typeof v !== "string" || !v.trim()) return false;
  if (v.startsWith("/") || v.includes("..") || v.includes("\\")) return false;
  if (/^[a-z][a-z0-9+.-]*:/i.test(v)) return false; // Các giao thức như http:, data:.
  return true;
}

function checkClipName(v: unknown, label: string, errors: string[]) {
  if (v === undefined) return;
  if (typeof v !== "string" || !v.trim()) {
    errors.push(`${label} phải là chuỗi không rỗng (tên AnimationClip trong glb)`);
  }
}

/**
 * Kiểm tra JSON chưa biết có phải manifest hợp lệ không.
 * Khi trả về ok:false, các lỗi trong errors có thể đọc được, truyền trực tiếp cho gate pipeline/console.
 */
export function validateDecorManifest(input: unknown): DecorManifestValidation {
  const errors: string[] = [];
  if (!isPlainObject(input)) {
    return { ok: false, manifest: null, errors: ["manifest phải là một đối tượng JSON"] };
  }

  if (input.version !== DECOR_MANIFEST_VERSION) {
    errors.push(`version phải là ${DECOR_MANIFEST_VERSION}, nhận được ${JSON.stringify(input.version)}`);
  }
  if (typeof input.id !== "string" || !PACK_ID_RE.test(input.id)) {
    errors.push(`id phải là tên gói kebab-case, nhận được ${JSON.stringify(input.id)}`);
  }

  const layers = input.layers;
  if (!Array.isArray(layers) || layers.length === 0) {
    errors.push("layers phải là mảng không rỗng");
    return { ok: false, manifest: null, errors };
  }
  if (layers.length > MAX_LAYERS) {
    errors.push(`Số lượng layers ${layers.length} vượt quá hạn mức ${MAX_LAYERS}`);
  }

  const usedSlots = new Set<string>();
  let modelCount = 0;

  layers.forEach((raw, i) => {
    const at = `layers[${i}]`;
    if (!isPlainObject(raw)) {
      errors.push(`${at} phải là một đối tượng`);
      return;
    }
    const { type, slot } = raw;

    if (type !== "image" && type !== "model") {
      errors.push(`${at}.type phải là "image" | "model", nhận được ${JSON.stringify(type)}`);
      return;
    }
    if (!isDecorSlotId(slot)) {
      errors.push(`${at}.slot ${JSON.stringify(slot)} không nằm trong registry slots.ts`);
      return;
    }
    // Mỗi slot chỉ gắn một layer: muốn xếp chồng hãy mở anchor mới trong slots.ts,
    // không xếp chồng trong manifest.
    if (usedSlots.has(slot)) {
      errors.push(`${at}.slot "${slot}" bị chiếm dụng lặp lại (một slot chỉ treo một layer)`);
    }
    usedSlots.add(slot);

    if (!isSafeRelativePath(raw.src)) {
      errors.push(`${at}.src phải là đường dẫn tương đối trong gói (cấm đường dẫn tuyệt đối/giao thức/..)`);
    }

    if (raw.parallax !== undefined) {
      const p = raw.parallax;
      if (typeof p !== "number" || !(p >= 0 && p <= 0.2)) {
        errors.push(`${at}.parallax phải nằm trong [0, 0.2], nhận được ${JSON.stringify(p)}`);
      }
    }

    if (type === "image") {
      if (typeof raw.src === "string" && !IMAGE_EXT_RE.test(raw.src)) {
        errors.push(`${at}.src ảnh chỉ chấp nhận webp/png/svg/avif`);
      }
      if (raw.opacity !== undefined) {
        const o = raw.opacity;
        if (typeof o !== "number" || !(o > 0 && o <= 1)) {
          errors.push(`${at}.opacity phải nằm trong (0, 1]`);
        }
      }
      if (raw.clickQuote !== undefined) {
        if (typeof raw.clickQuote !== "string" || !raw.clickQuote.trim()) {
          errors.push(`${at}.clickQuote phải là chuỗi không rỗng (phân cách nhiều câu bằng \\n\\n)`);
        }
      }
    } else {
      modelCount += 1;
      if (typeof raw.src === "string" && !MODEL_EXT_RE.test(raw.src)) {
        errors.push(`${at}.src model chỉ chấp nhận .glb`);
      }
      if (!isSafeRelativePath(raw.fallback) || !IMAGE_EXT_RE.test(String(raw.fallback))) {
        errors.push(`${at}.fallback bắt buộc và phải là đường dẫn ảnh trong gói (fallback tĩnh của model)`);
      }
      checkClipName(raw.idleClip, `${at}.idleClip`, errors);
      checkClipName(raw.clickClip, `${at}.clickClip`, errors);
      const slotDef = getDecorSlot(slot);
      if (slotDef?.id === "backdrop") {
        errors.push(`${at} slot backdrop cấm treo model 3D (giới hạn hiệu năng, hãy dùng image + parallax)`);
      }
    }
  });

  if (modelCount > MAX_MODEL_LAYERS) {
    errors.push(`${modelCount} layer 3D vượt quá giới hạn ${MAX_MODEL_LAYERS} (hãy chuyển phần dư thành layer ảnh)`);
  }

  const quote = input.quote;
  if (quote !== undefined) {
    if (!isPlainObject(quote)) {
      errors.push("quote phải là một đối tượng");
    } else {
      if (!isDecorSlotId(quote.slot)) {
        errors.push(`quote.slot ${JSON.stringify(quote.slot)} không có trong registry`);
      } else if (!getDecorSlot(quote.slot)?.textCapable) {
        errors.push(`quote.slot "${quote.slot}" không hỗ trợ văn bản (cần anchor textCapable)`);
      }
      if (typeof quote.text !== "string" || !quote.text.trim()) {
        errors.push("quote.text phải là chuỗi không rỗng");
      }
      if (quote.writingMode !== undefined && quote.writingMode !== "vertical" && quote.writingMode !== "horizontal") {
        errors.push('quote.writingMode phải là "vertical" | "horizontal"');
      }
    }
  }

  if (errors.length > 0) return { ok: false, manifest: null, errors };
  return { ok: true, manifest: input as unknown as DecorManifest, errors: [] };
}
