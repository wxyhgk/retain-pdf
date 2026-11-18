// 重新翻译时换翻译方式：选项和添加书时的「翻译质量」一一对应，换成 retry-stage 的 overrides.translation
// （后端按段合并进原任务的设置）。不选 = 沿用原任务的设置，不带 overrides。纯函数，单测直接覆盖。

export type RetranslateQuality = "" | "standard" | "terms" | "refined";

export const RETRANSLATE_QUALITY_OPTIONS: Array<{ value: RetranslateQuality; label: string }> = [
  { value: "", label: "翻译：沿用原来的" },
  { value: "standard", label: "翻译：普通" },
  { value: "terms", label: "翻译：统一术语" },
  { value: "refined", label: "翻译：精翻（翻译 agent）" },
];

/** 选了精翻时确认框里补的一句。 */
export const RETRANSLATE_AGENT_NOTE =
  "这次用翻译 agent：先通读全文定好术语，再逐页翻译并审校，费用和耗时都比普通高；开头通读要一会儿，进度会先停在 0。";

/**
 * 换成 overrides.translation。普通、统一术语显式写回 legacy 引擎并关掉老的渲染前精修，
 * 原来用 agent 或老精翻的书改选它们时才真的换过来；agent 自己会关掉译前准备和渲染前精修。
 */
export function retranslateOverrides(quality: unknown): Record<string, string> | null {
  if (quality === "standard") return { engine: "legacy", preparation: "off", refine: "off" };
  if (quality === "terms") return { engine: "legacy", preparation: "terms+style", refine: "off" };
  if (quality === "refined") return { engine: "agent" };
  return null;
}
