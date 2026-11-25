import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// 学习区（阅读页「学习」页签的右栏）：顶上是在哪一章，中间按在做什么换画面，底下一直有提问框。
// 设计见 docs/ops/planning/learning-system/20261125-学习区界面.md。
//
// 不认识阅读器：宿主给三样东西（LearningHost）——跳到书里、设页边小圆点、现在第几页。
import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { Button } from "@retainpdf/ui";
import { findPoint, initialSession, sessionReducer } from "../state/session.js";
import { AskView, ChapterMap, ExplainView, PointCard, QuizCard, STATUS_LABEL } from "./screens.js";
const STATUS_TONE = {
    known: { tone: "ok" },
    stuck: { tone: "danger" },
    suspect: { tone: "warn" },
    untested: { tone: "muted", hollow: true },
};
export function pointMarkers(course, statuses) {
    return course.points.map((point) => ({
        key: point.id,
        anchor: point.anchor,
        ...STATUS_TONE[statuses[point.id]],
        label: `${point.name}：${STATUS_LABEL[statuses[point.id]]}`,
    }));
}
/** 提问框自动带上的「上下文」：正在看的知识点，否则是这一页上的第一个点。 */
export function contextPointId(course, state, currentPage) {
    const screen = state.screen;
    if (screen.kind === "point" || screen.kind === "quiz" || screen.kind === "explain")
        return screen.pointId;
    if (screen.kind === "ask" && screen.pointId)
        return screen.pointId;
    return course.points.find((point) => point.anchor.page === currentPage)?.id;
}
export function LearningPane({ course, host }) {
    const [state, dispatch] = useReducer((current, action) => sessionReducer(course, current, action), course, initialSession);
    // 页边小圆点跟着状态走；点了圆点打开那个知识点。
    const { setMarkers } = host;
    const markers = useMemo(() => pointMarkers(course, state.statuses), [course, state.statuses]);
    useEffect(() => {
        setMarkers(markers, (key) => dispatch({ type: "openPoint", pointId: key }));
    }, [markers, setMarkers]);
    useEffect(() => () => setMarkers([]), [setMarkers]);
    // 换画面时把主区滚回顶上。
    const mainRef = useRef(null);
    useEffect(() => {
        mainRef.current?.scrollTo?.({ top: 0 });
    }, [state.screen.kind, state.screen.kind === "quiz" ? state.screen.itemIndex : 0]);
    const contextId = contextPointId(course, state, host.currentPage);
    const [question, setQuestion] = useState("");
    const [withContext, setWithContext] = useState(true);
    useEffect(() => setWithContext(true), [contextId]);
    const contextPoint = withContext ? findPoint(course, contextId) : undefined;
    const ask = (event) => {
        event.preventDefault();
        if (!question.trim())
            return;
        dispatch({ type: "ask", question, contextPointId: contextPoint?.id, currentPage: host.currentPage });
        setQuestion("");
    };
    const props = { course, state, dispatch, navigate: host.navigate, currentPage: host.currentPage };
    const screen = state.screen;
    return (_jsxs("div", { className: "lp-root", "data-lp-course": course.id, children: [_jsxs("header", { className: "lp-head", children: [_jsx("strong", { className: "lp-chapter", children: course.chapter }), host.close ? (_jsx(Button, { variant: "ghost", size: "sm", className: "lp-close", "aria-label": "\u5173\u6389\u5B66\u4E60", title: "\u5173\u6389\u5B66\u4E60", onClick: host.close, children: "\u2715" })) : null] }), state.notice ? _jsx("p", { className: "lp-notice", role: "status", children: state.notice }) : null, _jsxs("div", { className: "lp-main", ref: mainRef, children: [screen.kind === "map" ? _jsx(ChapterMap, { ...props }) : null, screen.kind === "point" ? _jsx(PointCard, { ...props, pointId: screen.pointId }) : null, screen.kind === "quiz" ? _jsx(QuizCard, { ...props, screen: screen }) : null, screen.kind === "explain" ? _jsx(ExplainView, { ...props, screen: screen }) : null, screen.kind === "ask" ? _jsx(AskView, { ...props, screen: screen }) : null] }), _jsxs("form", { className: "lp-askbox", onSubmit: ask, children: [_jsxs("div", { className: "lp-askbox-context", children: [_jsxs("span", { children: ["\u7B2C ", host.currentPage, " \u9875"] }), contextPoint ? (_jsxs(Button, { variant: "ghost", size: "sm", className: "lp-context-chip", title: "\u70B9\u4E00\u4E0B\u4E0D\u5E26\u8FD9\u4E2A\u77E5\u8BC6\u70B9", onClick: () => setWithContext(false), children: [contextPoint.name, " \u2715"] })) : null] }), _jsxs("div", { className: "lp-askbox-row", children: [_jsx("input", { className: "lp-askbox-input", value: question, onChange: (event) => setQuestion(event.target.value), placeholder: "\u968F\u65F6\u95EE\u4E00\u53E5\u2026\u2026", "aria-label": "\u63D0\u95EE" }), _jsx(Button, { variant: "primary", size: "sm", type: "submit", disabled: !question.trim(), children: "\u95EE" })] })] })] }));
}
