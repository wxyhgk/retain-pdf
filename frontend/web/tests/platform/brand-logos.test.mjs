// 厂商 / 模型标志登记表（platform/config/brand-logos.ts）和显示组件（ui/icons/BrandLogo.tsx）。
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  MODEL_LOGOS,
  VENDOR_LOGOS,
  modelLogoFor,
  vendorLogoForBaseUrl,
} from "../../src/platform/config/brand-logos.ts";
import { BrandLogo } from "../../src/ui/icons/BrandLogo.tsx";

const WEB_ROOT = fileURLToPath(new URL("../../", import.meta.url));
// 这两个不是 currentColor 画的（MinerU 官方图是近黑色、飞桨来自 Simple Icons 不写颜色），也按单色处理。
const MONO_WITHOUT_CURRENT_COLOR = new Set(["src/assets/providers/mineru.svg", "src/assets/providers/paddlepaddle.svg"]);

test("登记的每个标志文件都在，单色标记和文件对得上", () => {
  const all = [...Object.values(VENDOR_LOGOS), ...Object.values(MODEL_LOGOS)];
  assert.ok(all.length >= 50, `只登记了 ${all.length} 个`);
  for (const logo of all) {
    const path = `${WEB_ROOT}${logo.src}`;
    assert.ok(existsSync(path), `缺文件：${logo.src}`);
    const usesCurrentColor = readFileSync(path, "utf8").includes("currentColor");
    if (MONO_WITHOUT_CURRENT_COLOR.has(logo.src)) {
      assert.equal(logo.mono, true, `${logo.src} 要按单色处理`);
    } else {
      assert.equal(logo.mono, usesCurrentColor, `${logo.src} 的 mono 和文件不符（文件${usesCurrentColor ? "是" : "不是"} currentColor）`);
    }
  }
});

test("按模型名认家族：带路由前缀、大小写都认；认不出返回 null", () => {
  const family = (name) => modelLogoFor(name)?.src.match(/models\/(\w+)\.svg$/)?.[1] || null;
  assert.equal(family("claude-haiku-5-5"), "claude");
  assert.equal(family("anthropic/claude-sonnet-5"), "claude");
  assert.equal(family("gpt-5.6-luna"), "gpt");
  assert.equal(family("o3-mini"), "gpt");
  assert.equal(family("deepseek-v4.1-flash"), "deepseek");
  assert.equal(family("Qwen/Qwen3-235B"), "qwen");
  assert.equal(family("qwq-32b"), "qwen");
  assert.equal(family("GLM-5.3-Flash"), "glm");
  assert.equal(family("kimi-k2"), "kimi");
  assert.equal(family("gemini-3-pro"), "gemini");
  assert.equal(family("doubao-seed-1.6"), "doubao");
  assert.equal(family("ernie-4.5"), "ernie");
  assert.equal(family("hunyuan-turbos"), "hunyuan");
  assert.equal(family("MiniMax-M2"), "minimax");
  assert.equal(family("codestral-latest"), "mistral");
  assert.equal(family("meta-llama/Llama-4"), "llama");
  assert.equal(family("grok-4"), "grok");
  assert.equal(family("yi-lightning"), "yi");
  assert.equal(family("step-2-mini"), "step");
  assert.equal(family("my-own-model"), null);
  assert.equal(family(""), null);
});

test("按接口地址认厂商：子域名也算，本机 11434 是 Ollama，认不出返回 null", () => {
  const vendor = (url) => vendorLogoForBaseUrl(url)?.src.match(/providers\/(\w+)\.svg$/)?.[1] || null;
  assert.equal(vendor("https://api.siliconflow.cn/v1"), "siliconcloud");
  assert.equal(vendor("https://openrouter.ai/api/v1"), "openrouter");
  assert.equal(vendor("https://ark.cn-beijing.volces.com/api/v3"), "volcengine");
  assert.equal(vendor("https://my-res.openai.azure.com/openai"), "azure");
  assert.equal(vendor("https://api.moonshot.cn/v1"), "moonshot");
  assert.equal(vendor("https://dashscope.aliyuncs.com/compatible-mode/v1"), "bailian");
  assert.equal(vendor("http://localhost:11434/v1"), "ollama");
  assert.equal(vendor("http://localhost:8000/v1"), null);
  assert.equal(vendor("https://evil-openrouter.ai.example.com/v1"), null, "只认后缀，不认包含");
  assert.equal(vendor("不是地址"), null);
  assert.equal(vendor(""), null);
});

test("显示组件：彩色用 <img>，单色用 mask 画成文字颜色；没有标志什么都不画", () => {
  const color = renderToStaticMarkup(createElement(BrandLogo, { logo: VENDOR_LOGOS.deepseek, className: "x" }));
  assert.match(color, /<img class="brand-logo x" src="src\/assets\/providers\/deepseek\.svg"/);
  const mono = renderToStaticMarkup(createElement(BrandLogo, { logo: VENDOR_LOGOS.openai }));
  assert.match(mono, /^<span class="brand-logo" data-mono="true"/);
  assert.match(mono, /mask-image:url\(&quot;src\/assets\/providers\/openai\.svg&quot;\)/);
  assert.equal(renderToStaticMarkup(createElement(BrandLogo, { logo: null })), "");
});
