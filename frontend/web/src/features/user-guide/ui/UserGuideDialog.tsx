// 软件里的使用说明书：左边目录（README 里「按功能查」那张表），右边当前这一页。
// 页面是 guide/<页>.md，打开时才去取、才渲染；页内链接在说明书里翻页，外部链接新窗口打开。

import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { Button, Dialog, DialogCloseButton, DialogContent, DialogShell, DialogTitle } from "@retainpdf/ui";
import { GUIDE_HOME, guideBaseUrl, parseGuideIndex, type GuidePage, type GuideTarget } from "../domain/guide-pages.js";
import { renderGuidePage } from "../domain/render.js";

type PageState =
  | { status: "loading" }
  | { status: "ready"; html: string }
  | { status: "error"; message: string };

/** 取一页 Markdown。cache 是弹窗自己的（弹窗第一次打开后一直挂着），同一页只取一次。 */
function fetchGuidePage(pageCache: Map<string, Promise<string>>, baseUrl: string, page: string): Promise<string> {
  const url = `${baseUrl}${encodeURIComponent(page)}.md`;
  let pending = pageCache.get(url);
  if (!pending) {
    pending = fetch(url).then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.text();
    });
    // 取失败的不留缓存，下次打开再试。
    pending.catch(() => pageCache.delete(url));
    pageCache.set(url, pending);
  }
  return pending;
}

export type UserGuideDialogProps = {
  open: boolean;
  target: GuideTarget;
  onNavigate: (target: GuideTarget) => void;
  onOpenChange: (open: boolean) => void;
};

export function UserGuideDialog({ open, target, onNavigate, onOpenChange }: UserGuideDialogProps) {
  const baseUrl = useMemo(() => guideBaseUrl(globalThis.document?.baseURI || globalThis.location?.href || "http://localhost/"), []);
  const [index, setIndex] = useState<GuidePage[]>([]);
  const [state, setState] = useState<PageState>({ status: "loading" });
  const articleRef = useRef<HTMLElement | null>(null);
  const pageCache = useRef(new Map<string, Promise<string>>()).current;

  // 目录：读首页里的那张表。
  useEffect(() => {
    if (!open || index.length) return;
    fetchGuidePage(pageCache, baseUrl, GUIDE_HOME).then((readme) => setIndex(parseGuideIndex(readme)), () => {});
  }, [open, baseUrl, index.length, pageCache]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setState({ status: "loading" });
    fetchGuidePage(pageCache, baseUrl, target.page).then(
      (markdown) => {
        if (!cancelled) setState({ status: "ready", html: renderGuidePage(markdown, target.page, baseUrl) });
      },
      (error) => {
        if (!cancelled) setState({ status: "error", message: error instanceof Error ? error.message : `${error}` });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [open, baseUrl, target.page, pageCache]);

  // 换页回到顶上；带锚点的滚到那个标题。
  useEffect(() => {
    if (state.status !== "ready") return;
    const article = articleRef.current;
    if (!article) return;
    const heading = target.anchor ? [...article.querySelectorAll("[id]")].find((node) => node.id === target.anchor) : null;
    if (heading && typeof heading.scrollIntoView === "function") heading.scrollIntoView({ block: "start" });
    else article.scrollTop = 0;
  }, [state, target.anchor]);

  function handleArticleClick(event: MouseEvent<HTMLElement>) {
    const link = (event.target as Element | null)?.closest?.("a[data-guide-page]");
    if (!link) return;
    event.preventDefault();
    onNavigate({ page: link.getAttribute("data-guide-page") || GUIDE_HOME, anchor: link.getAttribute("data-guide-anchor") || "" });
  }

  const current = index.find((item) => item.page === target.page);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent id="user-guide-dialog" className="user-guide-dialog" showCloseButton={false} size="wide">
        <DialogShell className="desktop-shell user-guide-shell">
          <aside className="user-guide-rail">
            <DialogTitle asChild>
              <h2>使用说明</h2>
            </DialogTitle>
            <nav className="user-guide-nav" aria-label="说明书目录">
              <Button
                className={target.page === GUIDE_HOME ? "is-active" : ""}
                data-guide-nav={GUIDE_HOME}
                onClick={() => onNavigate({ page: GUIDE_HOME, anchor: "" })}
              >
                快速上手
              </Button>
              {index.map((item) => (
                <Button
                  key={item.page}
                  className={target.page === item.page ? "is-active" : ""}
                  data-guide-nav={item.page}
                  title={item.where || undefined}
                  onClick={() => onNavigate({ page: item.page, anchor: "" })}
                >
                  {item.title}
                </Button>
              ))}
            </nav>
          </aside>
          <div className="user-guide-pane">
            <DialogCloseButton className="user-guide-close" />
            <article
              ref={articleRef}
              className="user-guide-article"
              data-guide-current={target.page}
              aria-label={current?.title || "使用说明"}
              aria-busy={state.status === "loading"}
              onClick={handleArticleClick}
            >
              {state.status === "loading" ? <p className="user-guide-hint">正在打开…</p> : null}
              {state.status === "error" ? (
                <p className="user-guide-hint" role="alert">这一页没打开（{state.message}）。关掉再开一次试试。</p>
              ) : null}
              {state.status === "ready" ? (
                // 内容是跟着软件发的 guide/*.md（见 domain/render.ts）。
                <div className="user-guide-body" dangerouslySetInnerHTML={{ __html: state.html }} />
              ) : null}
            </article>
          </div>
        </DialogShell>
      </DialogContent>
    </Dialog>
  );
}
