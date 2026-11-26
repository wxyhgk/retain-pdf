import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/** 回答里的互动块（```openui-lang 代码块）：OpenUI 的渲染器 + 去掉外网组件的组件库（library.ts）。单独一块，第一次出现时才加载。
 *
 * - 流式时边收边画（isStreaming 时表单不能点）。
 * - 写错了（解析出错、组件不认识）：答完以后显示原文和错误，「让它修」把错误发回给 agent。
 * - 按钮：@ToAssistant 当作用户的下一问发出去（带上表单里填的值）；@OpenUrl 只开 http(s)，新标签页、不带 opener。
 * 方案：docs/ops/planning/reader-ask/20261126-互动块分层提示词.md。
 */
import { Component, useMemo, useState } from "react";
import { Renderer } from "@openuidev/react-lang";
import { ThemeProvider } from "@openuidev/intelligent-ui-library";
import { Wrench } from "lucide-react";
import { Button } from "@retainpdf/ui";
import { askOpenUILibrary } from "./library.js";
/** 只开 http(s)：模型写的 javascript:、data: 这类地址什么都不做。 */
export function safeUrl(value) {
    try {
        const url = new URL(String(value ?? ""));
        return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
    }
    catch {
        return null;
    }
}
/** @ToAssistant 发出去的那句：按钮上的话，加上表单里填的值。 */
export function actionMessage(event) {
    const text = `${event.humanFriendlyMessage || ""}`.trim();
    const values = Object.entries(event.formState || {})
        .filter(([, value]) => value !== null && value !== undefined && `${value}` !== "")
        .map(([key, value]) => `${key}：${Array.isArray(value) ? value.join("、") : typeof value === "object" ? JSON.stringify(value) : value}`);
    return values.length ? `${text}\n（${values.join("；")}）` : text;
}
/** 「让它修」发回去的话。 */
export function fixMessage(problems) {
    const lines = problems.slice(0, 8).map((problem) => `- ${problem.statementId ? `${problem.statementId}：` : ""}${problem.message}`);
    return `上面的互动块画不出来，按下面的错误改一下，重新给完整的互动块：\n${lines.join("\n")}`;
}
class Boundary extends Component {
    state = { error: null };
    static getDerivedStateFromError(error) {
        return { error };
    }
    componentDidCatch(_error, _info) {
        // 画的时候出错：下面显示原文和「让它修」。
    }
    render() {
        return this.state.error ? this.props.fallback(this.state.error) : this.props.children;
    }
}
function Fallback({ code, problems, send }) {
    return (_jsxs("div", { className: "ask-openui-fallback", children: [_jsxs("div", { className: "ask-openui-fallback-head", children: [_jsx("span", { children: "\u4E92\u52A8\u5757\u753B\u4E0D\u51FA\u6765" }), send ? (_jsxs(Button, { className: "ask-openui-fix", title: "\u628A\u9519\u8BEF\u53D1\u56DE\u7ED9 agent\uFF0C\u8BA9\u5B83\u6539", onClick: () => send(fixMessage(problems)), children: [_jsx(Wrench, { size: 12, "aria-hidden": true }), "\u8BA9\u5B83\u4FEE"] })) : null] }), problems.length ? _jsx("ul", { children: problems.slice(0, 8).map((problem, index) => _jsxs("li", { children: [problem.statementId ? `${problem.statementId}：` : "", problem.message] }, index)) }) : null, _jsx("pre", { children: code })] }));
}
export default function OpenUIBlock({ code, streaming, mode, send }) {
    const [problems, setProblems] = useState([]);
    const onAction = useMemo(() => (event) => {
        if (event.type === "continue_conversation") {
            const text = actionMessage(event);
            if (text)
                send?.(text);
            return;
        }
        if (event.type === "open_url") {
            const url = safeUrl(event.params?.url);
            if (url)
                window.open(url, "_blank", "noopener,noreferrer");
        }
    }, [send]);
    const broken = !streaming && problems.length > 0;
    return (_jsx("div", { className: "ask-openui", "data-mode": mode, children: _jsxs(Boundary, { fallback: (error) => _jsx(Fallback, { code: code, problems: [{ message: error.message }], send: send }), children: [broken ? _jsx(Fallback, { code: code, problems: problems, send: send }) : null, _jsx("div", { hidden: broken, children: _jsx(ThemeProvider, { mode: mode, children: _jsx(Renderer, { response: code, library: askOpenUILibrary, isStreaming: streaming, onAction: onAction, onParseResult: (result) => setProblems((result?.meta?.errors || []).map((error) => ({ code: error.code, statementId: error.statementId, message: error.message }))), onError: (errors) => !streaming && errors.length && setProblems(errors.map((error) => ({ code: error.code, message: error.message || String(error) }))) }) }) })] }) }));
}
