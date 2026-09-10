// 行内错误盒(React 版 <inline-error-box>,对照 components/feedback/inline-error-box.js)。
//
// 数据源:text store 的 "error-box" 槽位(镜像 ui/text.js 的 setText("error-box") 特例)。
// value 为 error-diagnostic 对象时展开「查看诊断 + 复制诊断」;字符串时纯文本。
// 保留 <inline-error-box> 标签与 log/error-box/inline-error-box 类(CSS 平权)。

import { useState } from "react";
import { copyText } from "@/platform/utils/clipboard.js";
import { messageForErrorBox } from "@/platform/utils/error-diagnostics.js";
import { useStoreSnapshot } from "@/ui/hooks/use-store.js";
import { useHomeServices } from "@/app/home/home-services-context.js";

const selectErrorBoxValue = (snapshot) => snapshot?.texts?.["error-box"];

export function InlineErrorBox() {
  const services = useHomeServices();
  const value = useStoreSnapshot(services.stores.text, selectErrorBoxValue);
  const [copyLabel, setCopyLabel] = useState("复制诊断");

  const summary = messageForErrorBox(value);
  const text = `${summary ?? ""}`.trim();
  const diagnostic = value && typeof value === "object" && value.kind === "error-diagnostic"
    ? `${value.diagnostic || ""}`.trim()
    : "";
  const hidden = !text || text === "-";

  async function handleCopy() {
    try {
      await copyText(diagnostic);
      setCopyLabel("已复制");
      globalThis.window?.setTimeout(() => setCopyLabel("复制诊断"), 1600);
    } catch {
      setCopyLabel("复制失败");
    }
  }

  return (
    <inline-error-box
      id="error-box-inline"
      class={`log error-box inline-error-box${hidden ? " hidden" : ""}`}
      aria-live="polite"
    >
      {hidden || !diagnostic ? (summary ?? "-") : (
        <>
          <div className="inline-error-summary">{summary}</div>
          <div className="inline-error-actions">
            <details className="inline-error-details">
              <summary>查看诊断</summary>
              <pre>{diagnostic}</pre>
            </details>
            <button type="button" className="inline-error-copy-btn" onClick={handleCopy}>
              {copyLabel}
            </button>
          </div>
        </>
      )}
    </inline-error-box>
  );
}
