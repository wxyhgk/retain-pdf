// 装饰位运行时：manifest.ornaments → <html> 上的 CSS 变量和标记属性。
//
// 三段：
//   planOrnaments  纯函数（ornament-plan.ts），manifest → { vars, names, hideNames }
//   apply / clear  副作用，写/清 document.documentElement
//   bootOrnaments  没有 DecorStage 的页面（阅读页）用：按当前主题的装饰包拉 manifest、
//                  注入、换主题时重来。首页由 DecorStage 拉到 manifest 后直接调 apply。
//
// 写出的东西（<名字> 来自 ornaments.ts 白名单）：
//   --ornament-<名字>        url("<装饰包>/<src>")
//   --ornament-<名字>-w/-h   宽高 px（缺省不写，用 ornaments.css 里的建议尺寸）
//   --ornament-<名字>-x/-y   偏移 px
//   --ornament-<名字>-hover  悬停时的 transform
//   <html data-ornaments="名字 名字…">       有图的装饰位（CSS 靠它决定显示）
//   <html data-ornaments-hide="名字 …">      要换掉原图标的装饰位
// 显示规则：packages/ui/styles/ornaments.css · 契约：./ornament-contract.ts

import { THEME_CHANGE_EVENT, getTheme, getThemeDefinition } from "@retainpdf/ui/theme";
import { validateDecorManifest } from "./contract.js";
import { defaultDecorManifestPort } from "./decor-manifest-port.js";
import { ORNAMENTS } from "./ornaments.js";
import { ORNAMENT_VAR_SUFFIXES, planOrnaments, type OrnamentPlan } from "./ornament-plan.js";

export { planOrnaments, type OrnamentPlan, type PlanOrnamentsOptions } from "./ornament-plan.js";

export function clearOrnaments(root: HTMLElement | undefined = globalThis.document?.documentElement): void {
  if (!root) return;
  for (const def of ORNAMENTS) {
    for (const suffix of ORNAMENT_VAR_SUFFIXES) root.style.removeProperty(`--ornament-${def.id}${suffix}`);
  }
  root.removeAttribute("data-ornaments");
  root.removeAttribute("data-ornaments-hide");
}

/** 先清掉上一个主题的，再写这一个 */
export function applyOrnaments(
  plan: OrnamentPlan,
  root: HTMLElement | undefined = globalThis.document?.documentElement,
): void {
  if (!root) return;
  clearOrnaments(root);
  for (const [name, value] of Object.entries(plan.vars)) root.style.setProperty(name, value);
  if (plan.names.length) root.setAttribute("data-ornaments", plan.names.join(" "));
  if (plan.hideNames.length) root.setAttribute("data-ornaments-hide", plan.hideNames.join(" "));
}

function currentPack(): string {
  return getThemeDefinition(getTheme())?.decorPack || "";
}

export type BootOrnamentsOptions = {
  manifestPort?: { fetchManifest: (assetBase: string) => Promise<Response> };
  root?: HTMLElement;
};

/**
 * 给没有 DecorStage 的页面用：只注入装饰位，不挂舞台。
 * 返回取消函数。装饰绝不阻塞功能：拉取 / 校验失败只 console.warn。
 */
export function bootOrnaments({ manifestPort = defaultDecorManifestPort, root }: BootOrnamentsOptions = {}): () => void {
  let generation = 0;
  const load = () => {
    const mine = ++generation;
    const pack = currentPack();
    if (!pack) {
      clearOrnaments(root);
      return;
    }
    const assetBase = `decor/${pack}`;
    manifestPort.fetchManifest(assetBase)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((json) => {
        if (mine !== generation) return;
        const result = validateDecorManifest(json);
        if (!result.ok) {
          console.warn(`[decor] 装饰包 ${pack} manifest 校验失败:`, result.errors);
          clearOrnaments(root);
          return;
        }
        applyOrnaments(
          planOrnaments(result.manifest.ornaments, { assetBase, baseHref: globalThis.document?.baseURI }),
          root,
        );
      })
      .catch((error) => {
        if (mine !== generation) return;
        console.warn(`[decor] 装饰包 ${pack} 装饰位加载失败:`, error);
        clearOrnaments(root);
      });
  };
  load();
  window.addEventListener(THEME_CHANGE_EVENT, load);
  return () => {
    generation += 1;
    window.removeEventListener(THEME_CHANGE_EVENT, load);
    clearOrnaments(root);
  };
}
