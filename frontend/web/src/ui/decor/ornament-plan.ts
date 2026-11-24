// 装饰位注入计划（纯函数，不碰 DOM、不依赖主题运行时，node:test 直测）。
// manifest.ornaments → { vars, names, hideNames }；写入 <html> 见 ornament-runtime.ts。

import { ORNAMENTS, ORNAMENT_HOVERS } from "./ornaments.js";
import type { DecorOrnaments } from "./ornament-contract.js";

export type OrnamentPlan = {
  /** 要写到 <html> style 上的变量（名 → 值） */
  vars: Record<string, string>;
  /** 有图的装饰位名字 */
  names: string[];
  /** 其中要换掉原图标的 */
  hideNames: string[];
};

export type PlanOrnamentsOptions = {
  /** 装饰包根 URL（不带尾斜杠），如 "decor/mojia" */
  assetBase: string;
  /**
   * 拼成绝对地址用的基准（运行时传 document.baseURI）。
   * CSS 变量里的相对 url() 按「用到它的样式表」算，样式表在 dist/css/ 下，
   * 相对地址会指到 dist/css/decor/…；所以运行时一律写绝对地址。
   */
  baseHref?: string;
};

export const ORNAMENT_VAR_SUFFIXES = ["", "-w", "-h", "-x", "-y", "-hover"] as const;

export function planOrnaments(
  ornaments: DecorOrnaments | undefined,
  options: PlanOrnamentsOptions,
): OrnamentPlan {
  if (!ornaments) return { vars: {}, names: [], hideNames: [] };
  const base = options.assetBase.replace(/\/+$/, "");
  const vars: Record<string, string> = {};
  const names: string[] = [];
  const hideNames: string[] = [];
  // 按白名单顺序遍历：输出稳定，也自然滤掉白名单外的键
  for (const def of ORNAMENTS) {
    const item = ornaments[def.id];
    if (!item) continue;
    const key = `--ornament-${def.id}`;
    let href = `${base}/${item.src}`;
    if (options.baseHref) {
      try {
        href = new URL(href, options.baseHref).href;
      } catch {
        /* 基准不合法就保留相对地址 */
      }
    }
    vars[key] = `url("${href}")`;
    if (item.width !== undefined) vars[`${key}-w`] = `${item.width}px`;
    if (item.height !== undefined) vars[`${key}-h`] = `${item.height}px`;
    if (item.offsetX !== undefined) vars[`${key}-x`] = `${item.offsetX}px`;
    if (item.offsetY !== undefined) vars[`${key}-y`] = `${item.offsetY}px`;
    if (item.hover) vars[`${key}-hover`] = ORNAMENT_HOVERS[item.hover];
    names.push(def.id);
    if (item.hideIcon) hideNames.push(def.id);
  }
  return { vars, names, hideNames };
}
