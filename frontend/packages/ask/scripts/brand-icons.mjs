// 生成提问窗用的 AI 厂商 / agent 图标（src/window/brand-icons.generated.ts）：从 @lobehub/icons-static-svg（MIT，纯 SVG）只挑用得上的。
// 有彩色版用彩色版（<img> 显示），没有的用单色版（CSS mask，跟着字的颜色走，深色皮肤也看得见）。
// 用法：npm run generate:icons --workspace @retainpdf/ask。图标包只是开发依赖，运行时不装它。

import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** 我们要的图标（图标包里的文件名，不带 -color / .svg）。 */
export const BRANDS = [
  "claude", "claudecode", "anthropic", "openai", "codex", "gemini", "geminicli", "google", "antigravity",
  "qwen", "deepseek", "kimi", "moonshot", "zhipu", "doubao", "minimax", "mistral", "grok", "meta",
  "hunyuan", "wenxin", "yi", "spark", "stepfun", "baichuan", "siliconcloud", "openrouter", "ollama",
  "opencode", "qoder", "kiro", "cline", "goose", "cursor", "amp", "trae", "githubcopilot",
];

export function buildBrandIcons() {
  const require = createRequire(import.meta.url);
  // 包的 exports 不给 package.json：从任意一个图标反推目录。
  const dir = dirname(require.resolve("@lobehub/icons-static-svg/icons/claude.svg"));
  const out = {};
  for (const name of BRANDS) {
    let file = join(dir, `${name}-color.svg`);
    let mode = "color";
    try {
      readFileSync(file);
    } catch {
      file = join(dir, `${name}.svg`);
      mode = "mono";
    }
    const svg = readFileSync(file, "utf8").replace(/\s+/g, " ").trim();
    out[name] = { mode, uri: `data:image/svg+xml,${encodeURIComponent(svg)}` };
  }
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const icons = buildBrandIcons();
  const target = fileURLToPath(new URL("../src/window/brand-icons.generated.ts", import.meta.url));
  writeFileSync(target, `// 生成的，别手改：npm run generate:icons --workspace @retainpdf/ask（scripts/brand-icons.mjs）。
// 图标来自 @lobehub/icons-static-svg（MIT，https://github.com/lobehub/lobe-icons）。

export type BrandIconData = { mode: "color" | "mono"; uri: string };

export const BRAND_ICONS: Record<string, BrandIconData> = ${JSON.stringify(icons, null, 2)};
`);
  console.log(`[brand-icons] ${Object.keys(icons).length} 个 → ${target}`);
}
