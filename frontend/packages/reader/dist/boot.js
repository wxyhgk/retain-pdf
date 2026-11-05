import { jsx as f } from "react/jsx-runtime";
import { createRoot as s } from "react-dom/client";
import { R as p } from "./ReaderApp-_TbWjTsJ.js";
const a = "retainpdf.theme", o = "classic", n = [
  {
    id: "classic",
    label: "经典",
    description: "黑白灰克制，默认观感",
    group: "light",
    order: 10,
    preview: {
      bg: "#f5f5f7",
      paper: "#ffffff",
      accent: "#1d1d1f",
      ink: "#1d1d1f",
      danger: "#ff3b30"
    }
  },
  {
    id: "jiangnan",
    label: "素纸",
    description: "冷石灰底 · 冷青绿强调（去土黄）",
    group: "accent",
    order: 20,
    decorPack: "jiangnan",
    preview: {
      bg: "#f1f0ed",
      paper: "#fbfaf8",
      accent: "#2a5f57",
      ink: "#1b1b1d",
      danger: "#c23b32"
    }
  },
  {
    id: "mojia",
    label: "墨家",
    description: "素绢暖底 · 青铜机关",
    group: "accent",
    order: 25,
    decorPack: "mojia",
    series: "baijia",
    preview: {
      bg: "#f2efe8",
      paper: "#faf8f1",
      accent: "#4c6658",
      ink: "#26221b",
      danger: "#b23b32"
    }
  },
  {
    id: "seacliff",
    label: "雾青",
    description: "冷灰蓝底 · 青灰强调",
    group: "accent",
    order: 30,
    preview: {
      bg: "#eef1f4",
      paper: "#f8f9fb",
      accent: "#2d5f6e",
      ink: "#1a1d21",
      danger: "#c23b32"
    }
  },
  {
    id: "night",
    label: "黛瓦夜色",
    description: "深底阅读 · 黛瓦墨黑",
    group: "dark",
    order: 40,
    preview: {
      bg: "#141618",
      paper: "#1e2226",
      accent: "#5aa88e",
      ink: "#e8e6e3",
      danger: "#e07068"
    }
  }
];
function i() {
  return [...n].sort((e, r) => e.order - r.order || e.id.localeCompare(r.id));
}
function m(e) {
  return n.find((r) => r.id === e);
}
function c(e) {
  return typeof e == "string" && n.some((r) => r.id === e);
}
i().map((e) => e.id);
Object.fromEntries(
  i().map((e) => [e.id, { id: e.id, label: e.label, description: e.description }])
);
const u = "retainpdf:theme-change";
function l() {
  if (typeof localStorage > "u") return o;
  try {
    const e = `${localStorage.getItem(a) || ""}`.trim();
    if (c(e)) return e;
  } catch {
  }
  return o;
}
function g(e) {
  const r = c(e) ? e : o;
  try {
    localStorage.setItem(a, r);
  } catch {
  }
  if (typeof document < "u") {
    document.documentElement.dataset.theme = r;
    const t = m(r);
    document.documentElement.dataset.themeGroup = (t == null ? void 0 : t.group) || "light", document.documentElement.classList.toggle("theme-dark", (t == null ? void 0 : t.group) === "dark");
  }
  if (typeof window < "u")
    try {
      window.dispatchEvent(
        new CustomEvent(u, { detail: { theme: r } })
      );
    } catch {
    }
  return r;
}
function b() {
  return g(l());
}
function h(e = document.body) {
  e.classList.add("reader-body", "reader-mode-compare"), globalThis.window && window.self !== window.top && e.classList.add("reader-embedded");
}
function E(e = document.body, r) {
  Array.from(e.children).forEach((t) => {
    t.tagName !== "SCRIPT" && t.id !== "reader-root" && t !== r && t.remove();
  });
}
function y(e = document.body) {
  let r = document.getElementById("reader-root");
  return r || (r = document.createElement("div"), r.id = "reader-root", e.appendChild(r)), r;
}
function R(e = {}) {
  const r = e.body ?? document.body, t = e.root ?? y(r);
  b(), h(r), e.purgeLegacyMarkup !== !1 && E(r, t);
  const d = s(t);
  return d.render(/* @__PURE__ */ f(p, {})), d;
}
export {
  R as bootReader,
  E as purgeLegacyMarkup,
  y as resolveReaderRoot,
  h as syncReaderBodyClasses
};
//# sourceMappingURL=boot.js.map
