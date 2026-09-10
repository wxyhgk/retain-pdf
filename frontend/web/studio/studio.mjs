// Theme Studio M1：点选检查 + 实时调 token + 导出皮肤文件。
// 零后端、零构建：同源 iframe 直改 CSS 变量即预览。
// M2(LLM 配色提案)/M3(gpt-image-2 生图入 slot)挂 ai_service dev 路由后接入。

import {
  CONTRAST_PAIRS,
  REQUIRED_TOKENS,
  SELECTOR_TOKEN_MAP,
  TOKEN_GROUPS,
} from "./token-registry.mjs";

const $ = (sel) => document.querySelector(sel);
const iframe = $("#stage-frame");
const panel = $("#token-panel");
const contrastBox = $("#contrast-box");
const pickBtn = $("#pick-btn");
const baseSelect = $("#base-theme");
const draftName = $("#draft-name");

/** 草稿覆盖集：token → 值（只记与基准不同的） */
const draft = new Map();
let picking = false;

function idoc() {
  return iframe.contentDocument;
}

function iroot() {
  return idoc()?.documentElement;
}

/* ---------- 取值/解析 ---------- */

/** 声明值（可能是 color-mix/var 表达式） */
function declaredValue(token) {
  return getComputedStyle(iroot()).getPropertyValue(token).trim();
}

/** 用探针元素把任意颜色表达式解析成 rgb() */
function resolveColor(expr) {
  const doc = idoc();
  const probe = doc.createElement("div");
  probe.style.cssText = `position:absolute;visibility:hidden;color:${expr}`;
  doc.body.appendChild(probe);
  const rgb = getComputedStyle(probe).color;
  probe.remove();
  return rgb;
}

function rgbToHex(rgb) {
  const m = rgb.match(/rgba?\(([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
  if (!m) return null;
  return `#${[m[1], m[2], m[3]].map((v) => Math.round(Number(v)).toString(16).padStart(2, "0")).join("")}`;
}

function luminance(rgb) {
  const m = rgb.match(/rgba?\(([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
  if (!m) return 0;
  const [r, g, b] = [m[1], m[2], m[3]].map((v) => {
    const c = Number(v) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(fgExpr, bgExpr) {
  const l1 = luminance(resolveColor(fgExpr));
  const l2 = luminance(resolveColor(bgExpr));
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

/* ---------- 面板渲染 ---------- */

function renderPanel(focusTokens = null, focusLabel = "") {
  panel.innerHTML = "";
  if (focusLabel) {
    const head = document.createElement("div");
    head.className = "focus-head";
    head.textContent = `已选中：${focusLabel}`;
    panel.appendChild(head);
  }
  for (const group of TOKEN_GROUPS) {
    const tokens = focusTokens
      ? group.tokens.filter((t) => focusTokens.includes(t.name))
      : group.tokens;
    if (!tokens.length) continue;
    const sec = document.createElement("section");
    sec.innerHTML = `<h3>${group.label}</h3>`;
    for (const t of tokens) {
      sec.appendChild(renderTokenRow(t));
    }
    panel.appendChild(sec);
  }
  renderContrast();
}

function renderTokenRow(t) {
  const row = document.createElement("div");
  row.className = "token-row";
  const declared = draft.get(t.name) ?? declaredValue(t.name);
  const dirty = draft.has(t.name) ? " dirty" : "";
  row.innerHTML = `<label class="tk${dirty}" title="${t.hint || ""}">${t.name}</label>`;

  const text = document.createElement("input");
  text.type = "text";
  text.value = declared;
  text.addEventListener("change", () => applyToken(t.name, text.value.trim()));

  if (t.type === "color") {
    const swatch = document.createElement("input");
    swatch.type = "color";
    const hex = rgbToHex(resolveColor(declared));
    if (hex) swatch.value = hex;
    swatch.addEventListener("input", () => {
      text.value = swatch.value;
      applyToken(t.name, swatch.value);
    });
    row.appendChild(swatch);
  }
  row.appendChild(text);
  return row;
}

function applyToken(token, value) {
  if (!value) {
    draft.delete(token);
    iroot().style.removeProperty(token);
  } else {
    draft.set(token, value);
    iroot().style.setProperty(token, value);
  }
  renderContrast();
  const label = panel.querySelector(`label[title]`);
  void label;
  for (const el of panel.querySelectorAll(".tk")) {
    el.classList.toggle("dirty", draft.has(el.textContent));
  }
  $("#dirty-count").textContent = `${draft.size} 项改动`;
}

function renderContrast() {
  contrastBox.innerHTML = "<h3>对比度自检（WCAG）</h3>";
  for (const pair of CONTRAST_PAIRS) {
    const ratio = contrastRatio(`var(${pair.fg})`, `var(${pair.bg})`);
    const ok = ratio >= pair.min;
    const div = document.createElement("div");
    div.className = `pair ${ok ? "ok" : "bad"}`;
    div.textContent = `${ok ? "✓" : "✗"} ${pair.label} ${ratio.toFixed(2)} (≥${pair.min})`;
    contrastBox.appendChild(div);
  }
}

/* ---------- 点选检查 ---------- */

const HL_CLASS = "__studio-hl";

function injectPickStyles() {
  const doc = idoc();
  if (doc.getElementById("__studio-style")) return;
  const style = doc.createElement("style");
  style.id = "__studio-style";
  style.textContent = `.${HL_CLASS}{outline:2px solid #e0447a !important;outline-offset:2px;cursor:crosshair !important;}`;
  doc.head.appendChild(style);
}

function resolveSelection(el) {
  for (const entry of SELECTOR_TOKEN_MAP) {
    const hit = el.closest(entry.match);
    if (hit) return { entry, hit };
  }
  return null;
}

let hovered = null;

function onHover(e) {
  if (!picking) return;
  hovered?.classList.remove(HL_CLASS);
  const found = resolveSelection(e.target);
  hovered = found?.hit || null;
  hovered?.classList.add(HL_CLASS);
}

function onPick(e) {
  if (!picking) return;
  e.preventDefault();
  e.stopPropagation();
  const found = resolveSelection(e.target);
  if (!found) return;
  if (found.entry.decorSlot) {
    renderPanel([], `${found.entry.label} —— 生图流程在 M3 接入（gpt-image-2），当前请直接替换 decor/<pack>/ 下的文件`);
    return;
  }
  renderPanel(found.entry.tokens, found.entry.label);
  setPicking(false);
}

function setPicking(on) {
  picking = on;
  pickBtn.classList.toggle("active", on);
  pickBtn.textContent = on ? "点选中…（点页面元素）" : "🎯 点选元素";
  if (!on) hovered?.classList.remove(HL_CLASS);
}

/* ---------- 导出 ---------- */

function exportCss() {
  const id = (draftName.value || "draft").trim();
  const lines = [];
  // 必选 20+1 全量写出（当前生效值），可选 token 只写改动项
  for (const token of REQUIRED_TOKENS) {
    lines.push(`  ${token}: ${draft.get(token) ?? declaredValue(token)};`);
  }
  const optional = [...draft.keys()].filter((t) => !REQUIRED_TOKENS.includes(t));
  if (optional.length) {
    lines.push("");
    lines.push("  /* L3 可选覆盖 */");
    for (const token of optional) {
      lines.push(`  ${token}: ${draft.get(token)};`);
    }
  }
  const css = `/* 皮肤 ${id}：Theme Studio 导出（基准：${baseSelect.value}） */\n\n[data-theme="${id}"] {\n${lines.join("\n")}\n}\n`;
  const registry = `// registry.ts 追加：\n{\n  id: "${id}",\n  label: "${id}",\n  description: "Studio 草稿",\n  group: "accent",\n  order: 50,\n  preview: { bg: "${rgbToHex(resolveColor("var(--bg)"))}", paper: "${rgbToHex(resolveColor("var(--paper)"))}", accent: "${rgbToHex(resolveColor("var(--accent)"))}", ink: "${rgbToHex(resolveColor("var(--ink)"))}", danger: "${rgbToHex(resolveColor("var(--danger)"))}" },\n},\n// themes/index.css 追加：@import "./${id}.css";`;
  $("#export-out").value = `${css}\n/* ---------------- */\n${registry}\n`;
  $("#export-dialog").showModal();
}

function downloadCss() {
  const id = (draftName.value || "draft").trim();
  const blob = new Blob([$("#export-out").value.split("/* ---------------- */")[0]], { type: "text/css" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${id}.css`;
  a.click();
  URL.revokeObjectURL(a.href);
}

/* ---------- 装配 ---------- */

function bindIframe() {
  const doc = idoc();
  injectPickStyles();
  doc.addEventListener("mousemove", onHover, true);
  doc.addEventListener("click", onPick, true);
  renderPanel();
}

iframe.addEventListener("load", bindIframe);

baseSelect.addEventListener("change", () => {
  draft.clear();
  $("#dirty-count").textContent = "0 项改动";
  iroot().removeAttribute("style");
  iroot().dataset.theme = baseSelect.value;
  renderPanel();
});

pickBtn.addEventListener("click", () => setPicking(!picking));
$("#export-btn").addEventListener("click", exportCss);
$("#download-btn").addEventListener("click", downloadCss);
$("#copy-btn").addEventListener("click", () => navigator.clipboard.writeText($("#export-out").value));
$("#reset-btn").addEventListener("click", () => {
  draft.clear();
  iroot().removeAttribute("style");
  $("#dirty-count").textContent = "0 项改动";
  renderPanel();
});
