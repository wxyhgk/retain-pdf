// 顶栏左边「对比版本」和对比时书页上方那一条（左栏是哪一份、「用这一份」、关掉；右栏写正在读哪一份）。
// 数据和动作在 hooks/use-reader-version-compare.ts。只有一份译文的书不显示按钮。
import { useEffect, useRef, useState, type ReactElement } from "react";
import { Check, GitCompareArrows, LoaderCircle, X } from "lucide-react";
import { Button } from "@retainpdf/ui";

import type { VersionCompare } from "../../hooks/use-reader-version-compare.js";

/** 「11月18日 18:31」；读不出写空。 */
export function versionTimeText(iso: string): string {
  const date = new Date(iso);
  if (!iso || Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => `${n}`.padStart(2, "0");
  return `${date.getMonth() + 1}月${date.getDate()}日 ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function ReaderVersionCompareToggle({ compare }: { compare: VersionCompare }): ReactElement | null {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  if (!compare.available) return null;
  return (
    <div className="reader-version-compare" ref={root}>
      <Button
        className="reader-finder-toggle"
        aria-pressed={Boolean(compare.compared) || open}
        aria-expanded={open}
        title="和这本书的另一份译文左右对照"
        onClick={() => setOpen((value) => !value)}
      >
        <GitCompareArrows size={16} strokeWidth={2.1} aria-hidden />
        <span>对比版本</span>
      </Button>
      {open ? (
        <div className="reader-version-compare-menu" role="dialog" aria-label="选一份译文放在左边对照">
          <p className="reader-version-compare-hint">选一份放在左边，和右边正在读的这份逐段对着看。</p>
          <ol className="reader-version-compare-list">
            {[...compare.versions].reverse().map((version) => {
              const reading = version.versionId === compare.readingVersionId;
              const active = compare.compared?.versionId === version.versionId;
              const loading = compare.loading === version.versionId;
              return (
                <li key={version.versionId}>
                  <Button
                    className="reader-version-compare-item"
                    data-version-id={version.versionId}
                    aria-current={active ? "true" : undefined}
                    disabled={reading}
                    onClick={() => {
                      compare.choose(version.versionId);
                      setOpen(false);
                    }}
                  >
                    <span className="reader-version-compare-name">{version.name}</span>
                    <span className="reader-version-compare-time">{versionTimeText(version.createdAt)}</span>
                    {reading ? <span className="reader-version-compare-tag">正在读</span> : null}
                    {active ? <Check size={14} aria-hidden /> : null}
                    {loading ? <LoaderCircle size={14} className="reader-version-compare-spin" aria-hidden /> : null}
                  </Button>
                </li>
              );
            })}
          </ol>
          {compare.compared ? (
            <Button className="reader-version-compare-off" onClick={() => { compare.clear(); setOpen(false); }}>
              不对比了，左边换回原文
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** 对比时书页上方一条：左半写左栏是哪一份（「用这一份」、关掉），右半写正在读的那份。 */
export function ReaderVersionCompareBar({ compare }: { compare: VersionCompare }): ReactElement | null {
  const [busy, setBusy] = useState(false);
  if (!compare.compared && !compare.loading && !compare.error) return null;
  const reading = compare.versions.find((version) => version.versionId === compare.readingVersionId);
  const loadingName = compare.versions.find((version) => version.versionId === compare.loading)?.name;
  const comparedVersion = compare.versions.find((version) => version.versionId === compare.compared?.versionId);
  // 好几份常常同名（同一个模型翻过几次）：名字后面跟上时间才分得清。
  const when = (iso?: string) => (iso ? <small>{versionTimeText(iso)}</small> : null);
  return (
    <div className="reader-version-compare-bar" role="status" data-version-compare-bar="true">
      <div className="reader-version-compare-side is-left">
        {compare.error ? (
          <span className="reader-version-compare-error">{compare.error}</span>
        ) : compare.loading ? (
          <span className="reader-version-compare-label"><LoaderCircle size={14} className="reader-version-compare-spin" aria-hidden />正在打开 {loadingName}…</span>
        ) : (
          <span className="reader-version-compare-label" data-compare-side="left">
            <em>对比</em>{compare.compared?.name}{when(comparedVersion?.createdAt)}
          </span>
        )}
        {compare.compared && !compare.loading ? (
          <Button
            size="sm"
            variant="secondary"
            className="reader-version-compare-adopt"
            disabled={busy}
            title="以后阅读就用这一份（和书详情「译文版本」里选的一样）"
            onClick={() => {
              setBusy(true);
              void compare.adopt().finally(() => setBusy(false));
            }}
          >
            用这一份
          </Button>
        ) : null}
        <Button size="sm" variant="ghost" className="reader-version-compare-close" aria-label="不对比了" title="不对比了" onClick={compare.clear}>
          <X size={14} aria-hidden />
        </Button>
      </div>
      <div className="reader-version-compare-side is-right">
        <span className="reader-version-compare-label" data-compare-side="right">
          <em>正在读</em>{reading?.name || "当前译文"}{when(reading?.createdAt)}
        </span>
      </div>
    </div>
  );
}
