import { jsx as a } from "react/jsx-runtime";
import { createRoot as s } from "react-dom/client";
import { ErrorBoundary as p } from "@retainpdf/ui";
import { R as m } from "./ReaderApp-ShKrMwt5.js";
const i = "retainpdf.theme", o = "classic", n = [
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
function c() {
  return [...n].sort((e, r) => e.order - r.order || e.id.localeCompare(r.id));
}
function u(e) {
  return n.find((r) => r.id === e);
}
function f(e) {
  return typeof e == "string" && n.some((r) => r.id === e);
}
c().map((e) => e.id);
Object.fromEntries(
  c().map((e) => [e.id, { id: e.id, label: e.label, description: e.description }])
);
const l = "retainpdf:theme-change";
function g() {
  if (typeof localStorage > "u") return o;
  try {
    const e = `${localStorage.getItem(i) || ""}`.trim();
    if (f(e)) return e;
  } catch {
  }
  return o;
}
function b(e) {
  const r = f(e) ? e : o;
  try {
    localStorage.setItem(i, r);
  } catch {
  }
  if (typeof document < "u") {
    document.documentElement.dataset.theme = r;
    const t = u(r);
    document.documentElement.dataset.themeGroup = (t == null ? void 0 : t.group) || "light", document.documentElement.classList.toggle("theme-dark", (t == null ? void 0 : t.group) === "dark");
  }
  if (typeof window < "u")
    try {
      window.dispatchEvent(
        new CustomEvent(l, { detail: { theme: r } })
      );
    } catch {
    }
  return r;
}
function h() {
  return b(g());
}
function E(e = document.body) {
  e.classList.add("reader-body", "reader-mode-compare"), globalThis.window && window.self !== window.top && e.classList.add("reader-embedded");
}
function y(e = document.body, r) {
  Array.from(e.children).forEach((t) => {
    t.tagName !== "SCRIPT" && t.id !== "reader-root" && t !== r && t.remove();
  });
}
function w(e = document.body) {
  let r = document.getElementById("reader-root");
  return r || (r = document.createElement("div"), r.id = "reader-root", e.appendChild(r)), r;
}
function j(e = {}) {
  const r = e.body ?? document.body, t = e.root ?? w(r);
  h(), E(r), e.purgeLegacyMarkup !== !1 && y(r, t);
  const d = s(t);
  return d.render(/* @__PURE__ */ a(p, { scope: "page", label: "阅读页", children: /* @__PURE__ */ a(m, {}) })), d;
}
export {
  j as bootReader,
  y as purgeLegacyMarkup,
  w as resolveReaderRoot,
  E as syncReaderBodyClasses
};
//# sourceMappingURL=boot.js.map
