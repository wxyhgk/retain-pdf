// manifest.ornaments 的类型与校验（装饰位的契约真值；白名单在 ornaments.ts）。
//
// 用户能写的只有：白名单里的名字 + 包内相对图片路径 + 限了范围的数字 + 一个枚举。
// 路径字符收紧到 [A-Za-z0-9._/-]，因为运行时会把它拼进 CSS 的 url("...")，
// 引号、括号、空白、反斜杠一概进不来。

import { ORNAMENT_HOVERS, getOrnament, isOrnamentId, type OrnamentHover, type OrnamentId } from "./ornaments.js";

export type DecorOrnament = {
  /** 相对包根目录的图片路径（webp/png/svg/avif） */
  src: string;
  /** 显示宽高 px，缺省用 ornaments.ts 的建议尺寸；铺满型装饰位不接受 */
  width?: number;
  height?: number;
  /** 相对默认位置的偏移 px（右、下为正） */
  offsetX?: number;
  offsetY?: number;
  /** 用这张图替换宿主原有的图标 / 底板（仅 canHideIcon 的装饰位） */
  hideIcon?: boolean;
  /** 悬停动效：rotate 转 45°，lift 上抬 2px（仅按钮 / 页签类装饰位） */
  hover?: OrnamentHover;
};

export type DecorOrnaments = Partial<Record<OrnamentId, DecorOrnament>>;

/** 单个包里最多挂几个装饰位（白名单本来就有限，这里只是兜底） */
export const MAX_ORNAMENTS = 16;
/** 尺寸上限 px；偏移范围 px */
export const ORNAMENT_MAX_SIZE = 512;
export const ORNAMENT_MAX_OFFSET = 200;

const SAFE_PATH_CHARS_RE = /^[A-Za-z0-9._/-]+$/;
const IMAGE_EXT_RE = /\.(webp|png|svg|avif)$/i;

/** 相对路径、不逃逸包目录、字符只限 [A-Za-z0-9._/-]（可以安全拼进 url("...")） */
export function isSafeRelativePath(v: unknown): v is string {
  if (typeof v !== "string" || !v.trim()) return false;
  if (v.startsWith("/") || v.includes("..") || v.includes("\\") || v.includes("//")) return false;
  if (/^[a-z][a-z0-9+.-]*:/i.test(v)) return false; // http:, data: 等协议
  return SAFE_PATH_CHARS_RE.test(v);
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function checkRange(v: unknown, min: number, max: number): boolean {
  return typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
}

/** 校验 manifest.ornaments；有问题就往 errors 里追加可读信息 */
export function checkOrnaments(input: unknown, errors: string[]): void {
  if (input === undefined) return;
  if (!isPlainObject(input)) {
    errors.push("ornaments 必须是对象（{ \"装饰位名\": { src, … } }）");
    return;
  }
  const names = Object.keys(input);
  if (names.length > MAX_ORNAMENTS) {
    errors.push(`ornaments 数量 ${names.length} 超过上限 ${MAX_ORNAMENTS}`);
  }
  for (const name of names) {
    const at = `ornaments["${name}"]`;
    const raw = input[name];
    if (!isOrnamentId(name)) {
      errors.push(`${at} 不在装饰位白名单（ornaments.ts）里`);
      continue;
    }
    if (!isPlainObject(raw)) {
      errors.push(`${at} 必须是对象`);
      continue;
    }
    const def = getOrnament(name);
    if (!isSafeRelativePath(raw.src)) {
      errors.push(`${at}.src 必须是包内相对路径（只许字母数字 . _ - /，禁止绝对路径/协议/..）`);
    } else if (!IMAGE_EXT_RE.test(raw.src)) {
      errors.push(`${at}.src 图片仅接受 webp/png/svg/avif`);
    }
    for (const key of ["width", "height"] as const) {
      if (raw[key] === undefined) continue;
      if (def && def.size === null) {
        errors.push(`${at}.${key} 不能写：这个装饰位铺满宿主`);
      } else if (!checkRange(raw[key], 1, ORNAMENT_MAX_SIZE)) {
        errors.push(`${at}.${key} 必须在 [1, ${ORNAMENT_MAX_SIZE}]，收到 ${JSON.stringify(raw[key])}`);
      }
    }
    for (const key of ["offsetX", "offsetY"] as const) {
      if (raw[key] !== undefined && !checkRange(raw[key], -ORNAMENT_MAX_OFFSET, ORNAMENT_MAX_OFFSET)) {
        errors.push(`${at}.${key} 必须在 [-${ORNAMENT_MAX_OFFSET}, ${ORNAMENT_MAX_OFFSET}]，收到 ${JSON.stringify(raw[key])}`);
      }
    }
    if (raw.hideIcon !== undefined) {
      if (typeof raw.hideIcon !== "boolean") {
        errors.push(`${at}.hideIcon 必须是布尔值`);
      } else if (raw.hideIcon && def && !def.canHideIcon) {
        errors.push(`${at}.hideIcon 这个装饰位没有可替换的原图标`);
      }
    }
    if (raw.hover !== undefined) {
      if (typeof raw.hover !== "string" || !Object.hasOwn(ORNAMENT_HOVERS, raw.hover)) {
        errors.push(`${at}.hover 必须是 ${Object.keys(ORNAMENT_HOVERS).map((k) => JSON.stringify(k)).join(" | ")}`);
      } else if (def && !def.canHover) {
        errors.push(`${at}.hover 这个装饰位的宿主不可悬停`);
      }
    }
  }
}
