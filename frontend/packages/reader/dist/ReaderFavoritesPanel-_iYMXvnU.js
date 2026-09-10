import { jsx as r, jsxs as o, Fragment as N } from "react/jsx-runtime";
import { useState as m, useCallback as k, useEffect as g } from "react";
import { Bookmark as x } from "lucide-react";
import { c as F, f as b, A as R } from "./ReaderApp-BgACXe1b.js";
import { R as S } from "./ReaderFloatShell-DTFWp_bv.js";
import { normalizeServerFavorite as A } from "./runtime/state.js";
function E(a) {
  const t = `${a || ""}`.trim();
  return t === "figure" ? "图表" : t === "data" ? "数据" : t === "sentence" ? "摘录" : t || "摘录";
}
function B({
  open: a,
  jobId: t,
  documentId: s,
  onClose: h,
  onJumpPage: v
}) {
  const [n, i] = m([]), [l, p] = m(!1), [u, c] = m(""), d = k(async () => {
    if (!t && !s) {
      i([]), c("当前没有可关联的文档");
      return;
    }
    p(!0), c("");
    try {
      let e = [];
      if (t)
        e = await F({ jobId: t }).loadServerFavorites();
      else if (s) {
        const { favorites: f = [] } = await b(R, { documentId: s });
        e = (Array.isArray(f) ? f : []).map((y) => A(y)).filter(Boolean);
      }
      i(e);
    } catch (e) {
      c(e instanceof Error ? e.message : "读取摘录失败"), i([]);
    } finally {
      p(!1);
    }
  }, [t, s]);
  return g(() => {
    a && d();
  }, [a, d]), /* @__PURE__ */ r(
    S,
    {
      id: "reader-favorites-panel",
      open: a,
      title: "摘录",
      subtitle: "本书云端收藏 · 本地保存",
      titleIcon: /* @__PURE__ */ r(x, { size: 14, strokeWidth: 2.25, "aria-hidden": !0 }),
      storageKey: "retainpdf.reader.favorites-float.pos.v1",
      ariaLabel: "摘录",
      onClose: h,
      toolbar: /* @__PURE__ */ o(N, { children: [
        /* @__PURE__ */ r("span", { className: "reader-notes-count", children: l ? "加载中…" : `${n.length} 条` }),
        /* @__PURE__ */ r(
          "button",
          {
            type: "button",
            className: "reader-notes-export",
            disabled: l,
            onClick: () => void d(),
            children: "刷新"
          }
        )
      ] }),
      children: u ? /* @__PURE__ */ r("p", { className: "reader-notes-empty", role: "alert", children: u }) : l ? /* @__PURE__ */ r("p", { className: "reader-notes-empty", children: "正在加载摘录…" }) : n.length === 0 ? /* @__PURE__ */ r("p", { className: "reader-notes-empty", children: "暂无摘录。可从主页收藏内容后在这里定位阅读。" }) : n.map((e) => /* @__PURE__ */ o("article", { className: "reader-notes-item", children: [
        /* @__PURE__ */ o("div", { className: "reader-notes-item-top", children: [
          /* @__PURE__ */ r("span", { className: "reader-notes-kind", children: E(e.kind) }),
          /* @__PURE__ */ r("div", { className: "reader-notes-item-actions", children: /* @__PURE__ */ o(
            "button",
            {
              type: "button",
              className: "reader-notes-link",
              onClick: () => v(Math.max(1, (e.pageIdx || 0) + 1)),
              children: [
                "第 ",
                (e.pageIdx || 0) + 1,
                " 页"
              ]
            }
          ) })
        ] }),
        /* @__PURE__ */ r("p", { className: "reader-notes-quote", children: e.quoteText }),
        e.note ? /* @__PURE__ */ r("p", { className: "reader-notes-note", style: { cursor: "default" }, children: e.note }) : null
      ] }, e.favoriteId))
    }
  );
}
export {
  B as ReaderFavoritesPanel
};
//# sourceMappingURL=ReaderFavoritesPanel-_iYMXvnU.js.map
