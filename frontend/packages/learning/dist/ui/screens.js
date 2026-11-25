import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Button } from "@retainpdf/ui";
import { Whiteboard } from "@retainpdf/whiteboard";
import { MAX_HINT_LEVEL, findPoint, firstStuckPoint, firstUntestedWithItems, statusCounts, } from "../state/session.js";
import { MathText } from "./MathText.js";
export const STATUS_LABEL = {
    known: "会了",
    stuck: "卡住",
    suspect: "疑似误解",
    untested: "未测",
};
export function StatusDot({ status }) {
    return _jsx("span", { className: `lp-dot is-${status}`, "aria-hidden": "true" });
}
function BookLink({ point, navigate, label }) {
    return (_jsxs(Button, { className: "lp-book-link", title: `回书里看：第 ${point.anchor.page} 页`, "aria-label": `回书里看：第 ${point.anchor.page} 页`, onClick: (event) => {
            event.stopPropagation();
            navigate(point.anchor);
        }, children: [label ?? `p.${point.anchor.page}`, " \u2197"] }));
}
// —— A. 本章地图 ——
export function ChapterMap({ course, state, dispatch, navigate, currentPage }) {
    const counts = statusCounts(state);
    const total = course.points.length;
    const sections = [];
    for (const point of course.points) {
        const last = sections.at(-1);
        if (last?.name === point.section)
            last.points.push(point);
        else
            sections.push({ name: point.section, points: [point] });
    }
    const stuck = firstStuckPoint(course, state);
    const untested = firstUntestedWithItems(course, state);
    return (_jsxs("div", { className: "lp-map", "data-lp-screen": "map", children: [_jsx("p", { className: "lp-counts", children: ["known", "stuck", "suspect", "untested"].map((status) => (_jsxs("span", { className: "lp-count", children: [_jsx(StatusDot, { status: status }), STATUS_LABEL[status], " ", counts[status]] }, status))) }), _jsx("div", { className: "lp-progress", "aria-label": `会了 ${counts.known} / ${total}`, children: ["known", "suspect", "stuck", "untested"].map((status) => (_jsx("span", { className: `lp-progress-part is-${status}`, style: { flexGrow: counts[status] } }, status))) }), sections.map((section) => (_jsxs("section", { className: "lp-section", children: [_jsx("h3", { className: "lp-section-title", children: section.name }), _jsx("ul", { className: "lp-points", children: section.points.map((point) => (_jsx("li", { children: _jsxs("div", { role: "button", tabIndex: 0, className: `lp-point-row${point.anchor.page === currentPage ? " is-on-page" : ""}`, "data-lp-point": point.id, onClick: () => dispatch({ type: "openPoint", pointId: point.id }), onKeyDown: (event) => {
                                    if (event.key === "Enter" || event.key === " ") {
                                        event.preventDefault();
                                        dispatch({ type: "openPoint", pointId: point.id });
                                    }
                                }, children: [_jsx(StatusDot, { status: state.statuses[point.id] }), _jsx("span", { className: "lp-point-name", children: point.name }), _jsx("span", { className: `lp-status is-${state.statuses[point.id]}`, children: STATUS_LABEL[state.statuses[point.id]] }), _jsx(BookLink, { point: point, navigate: navigate })] }) }, point.id))) })] }, section.name))), _jsxs("div", { className: "lp-actions lp-map-actions", children: [_jsx(Button, { variant: "primary", size: "sm", disabled: !stuck, onClick: () => stuck && dispatch({ type: "openPoint", pointId: stuck.id }), children: "\u4ECE\u5361\u70B9\u5F00\u59CB" }), _jsx(Button, { variant: "secondary", size: "sm", disabled: !untested, onClick: () => untested && dispatch({ type: "startQuiz", pointId: untested.id }), children: "\u6D4B\u4E00\u4E0B\u8FD9\u4E00\u7AE0" })] })] }));
}
function BackLink({ label, onClick }) {
    return (_jsxs(Button, { variant: "ghost", size: "sm", className: "lp-back", onClick: onClick, children: ["\u2190 ", label] }));
}
// —— B. 知识点卡 ——
export function PointCard({ course, state, dispatch, navigate, pointId }) {
    const point = findPoint(course, pointId);
    if (!point)
        return null;
    const status = state.statuses[point.id];
    const asked = state.asked[point.id] ?? 0;
    return (_jsxs("div", { className: "lp-card", "data-lp-screen": "point", children: [_jsx(BackLink, { label: "\u672C\u7AE0", onClick: () => dispatch({ type: "openMap" }) }), _jsxs("header", { className: "lp-card-head", children: [_jsx("h2", { children: point.name }), _jsxs("span", { className: `lp-status is-${status}`, children: [_jsx(StatusDot, { status: status }), STATUS_LABEL[status]] })] }), _jsxs("p", { className: "lp-meta", children: ["\u51FA\u5904\uFF1A", point.anchor.quote ?? `第 ${point.anchor.page} 页`, " ", _jsx(BookLink, { point: point, navigate: navigate })] }), _jsx("p", { className: "lp-summary", children: point.summary }), _jsxs("dl", { className: "lp-facts", children: [_jsx("dt", { children: "\u4F9D\u636E" }), _jsx("dd", { children: state.evidence[point.id]?.length ? (_jsx("ul", { className: "lp-evidence", children: state.evidence[point.id].map((entry, index) => _jsxs("li", { children: [entry.date, " ", entry.text] }, index)) })) : "还没做过这个点的题" }), point.prereqs.length ? (_jsxs(_Fragment, { children: [_jsx("dt", { children: "\u524D\u7F6E" }), _jsx("dd", { className: "lp-prereqs", children: point.prereqs.map((id) => {
                                    const prereq = findPoint(course, id);
                                    return prereq ? (_jsxs(Button, { variant: "ghost", size: "sm", onClick: () => dispatch({ type: "openPoint", pointId: id }), children: [_jsx(StatusDot, { status: state.statuses[id] }), prereq.name] }, id)) : null;
                                }) })] })) : null, asked ? (_jsxs(_Fragment, { children: [_jsx("dt", { children: "\u95EE\u8FC7" }), _jsxs("dd", { children: [asked, " \u6B21"] })] })) : null] }), _jsxs("div", { className: "lp-actions", children: [_jsx(Button, { variant: "primary", size: "sm", onClick: () => dispatch({ type: "startQuiz", pointId: point.id }), children: "\u6D4B\u4E00\u4E0B" }), _jsx(Button, { variant: "secondary", size: "sm", onClick: () => dispatch({ type: "explain", pointId: point.id }), children: "\u8BB2\u7ED9\u6211\u542C" }), _jsx(Button, { variant: "secondary", size: "sm", disabled: !point.exampleScriptId, onClick: () => point.exampleScriptId && dispatch({ type: "explain", pointId: point.id, scriptId: point.exampleScriptId }), children: "\u770B\u4E00\u9053\u4F8B\u9898" })] })] }));
}
// —— C. 做题 ——
export function QuizCard({ course, state, dispatch, screen }) {
    const point = findPoint(course, screen.pointId);
    const item = course.items[point.itemIds[screen.itemIndex]];
    const today = todayLabel();
    const dontKnowIndex = item.options.length;
    const answered = screen.result !== null;
    const lastLevel = Math.min(MAX_HINT_LEVEL, item.hints.length + 1);
    const revealed = screen.hintLevel >= lastLevel;
    return (_jsxs("div", { className: "lp-card lp-quiz", "data-lp-screen": "quiz", children: [_jsx(BackLink, { label: point.name, onClick: () => dispatch({ type: "openPoint", pointId: point.id }) }), _jsxs("p", { className: "lp-quiz-progress", children: ["\u7B2C ", screen.itemIndex + 1, " / ", point.itemIds.length, " \u9898", item.diagnostic ? " · 诊断题" : ""] }), _jsx("p", { className: "lp-stem", children: item.stem }), item.stemMath ? _jsx(MathText, { tex: item.stemMath, size: "m" }) : null, _jsx("div", { className: "lp-options", role: "radiogroup", "aria-label": "\u9009\u9879", children: [...item.options, { text: "我不知道" }].map((option, index) => {
                    const selected = screen.choice === index;
                    const isAnswer = answered && index === item.answer;
                    const isWrongPick = answered && selected && index !== item.answer;
                    return (_jsx(Button, { role: "radio", "aria-checked": selected, className: `lp-option${selected ? " is-selected" : ""}${isAnswer ? " is-answer" : ""}${isWrongPick ? " is-wrong" : ""}${index === dontKnowIndex ? " is-dont-know" : ""}`, disabled: answered, onClick: () => dispatch({ type: "choose", choice: index }), children: "math" in option && option.math ? _jsx(MathText, { tex: option.text }) : option.text }, index));
                }) }), item.diagnostic && !answered ? (_jsxs("div", { className: "lp-confidence", role: "radiogroup", "aria-label": "\u6709\u591A\u786E\u5B9A", children: [_jsx("span", { children: "\u6709\u591A\u786E\u5B9A\uFF1F" }), [1, 2, 3, 4, 5].map((value) => (_jsx(Button, { role: "radio", "aria-checked": screen.confidence === value, className: `lp-confidence-value${screen.confidence === value ? " is-selected" : ""}`, onClick: () => dispatch({ type: "confidence", value }), children: value }, value)))] })) : null, screen.hintLevel > 0 ? (_jsxs("ol", { className: "lp-hints", "aria-label": "\u63D0\u793A", children: [item.hints.slice(0, Math.min(screen.hintLevel, item.hints.length)).map((hint, index) => (_jsxs("li", { children: [_jsxs("span", { className: "lp-hint-level", children: ["\u7B2C ", index + 1, " \u7EA7"] }), hint] }, index))), revealed ? _jsxs("li", { className: "is-reveal", children: [_jsxs("span", { className: "lp-hint-level", children: ["\u7B2C ", lastLevel, " \u7EA7"] }), "\u76F4\u63A5\u7ED9\u7B54\u6848\uFF08\u8FD9\u9898\u8BB0\u4E3A\u7B54\u9519\uFF09"] }) : null] })) : null, answered ? (_jsxs("div", { className: `lp-feedback is-${screen.result}`, role: "status", children: [_jsx("strong", { children: screen.result === "correct" ? "对。" : revealed ? "答案标出来了。" : "不对。" }), " ", item.explanation] })) : null, _jsx("div", { className: "lp-actions", children: !answered ? (_jsxs(_Fragment, { children: [_jsx(Button, { variant: "primary", size: "sm", disabled: screen.choice === null, onClick: () => dispatch({ type: "submit", today }), children: "\u63D0\u4EA4" }), screen.hintLevel > 0 ? (_jsx(Button, { variant: "secondary", size: "sm", disabled: revealed, onClick: () => dispatch({ type: "hint", today }), children: screen.hintLevel + 1 >= lastLevel ? "直接看答案" : `再给一点提示（第 ${screen.hintLevel + 1} 级）` })) : null] })) : screen.result === "wrong" && !revealed ? (_jsxs(_Fragment, { children: [_jsx(Button, { variant: "secondary", size: "sm", onClick: () => dispatch({ type: "hint", today }), children: screen.hintLevel + 1 >= lastLevel ? "直接看答案" : `给我一点提示（第 ${screen.hintLevel + 1} 级）` }), _jsx(Button, { variant: "secondary", size: "sm", onClick: () => dispatch({ type: "explain", pointId: point.id }), children: "\u8BB2\u4E00\u8BB2" })] })) : (_jsxs(_Fragment, { children: [_jsx(Button, { variant: "primary", size: "sm", onClick: () => dispatch({ type: "nextItem" }), children: screen.itemIndex + 1 < point.itemIds.length ? "下一题" : "做完了" }), screen.result === "wrong" ? (_jsx(Button, { variant: "secondary", size: "sm", onClick: () => dispatch({ type: "explain", pointId: point.id }), children: "\u8BB2\u4E00\u8BB2" })) : null] })) })] }));
}
function UnderstandActions({ dispatch, canRetry }) {
    return (_jsxs("div", { className: "lp-actions", children: [canRetry ? _jsx(Button, { variant: "secondary", size: "sm", onClick: () => dispatch({ type: "explainAgain" }), children: "\u8FD8\u662F\u4E0D\u61C2" }) : null, canRetry ? _jsx(Button, { variant: "secondary", size: "sm", onClick: () => dispatch({ type: "explainOther" }), children: "\u6362\u4E2A\u8BF4\u6CD5" }) : null, _jsx(Button, { variant: "primary", size: "sm", onClick: () => dispatch({ type: "understood" }), children: "\u61C2\u4E86\uFF0C\u51FA\u9898\u9A8C\u8BC1" })] }));
}
// —— D. 讲解 ——
export function ExplainView({ course, dispatch, navigate, screen }) {
    const point = findPoint(course, screen.pointId);
    return (_jsxs("div", { className: "lp-card lp-explain", "data-lp-screen": "explain", children: [_jsx(BackLink, { label: `${point.name} · 讲解`, onClick: () => dispatch({ type: "openPoint", pointId: point.id }) }), _jsx(Whiteboard, { className: "lp-board", script: course.scripts[screen.scriptId] }, `${screen.scriptId}:${screen.attempt}`), _jsxs("p", { className: "lp-meta", children: ["\u8FD9\u4E00\u6B65\u5728\u4E66\u91CC ", _jsx(BookLink, { point: point, navigate: navigate })] }), _jsx(UnderstandActions, { dispatch: dispatch, canRetry: true })] }));
}
// —— 问答 ——
export function AskView({ course, dispatch, navigate, screen }) {
    const point = findPoint(course, screen.pointId);
    return (_jsxs("div", { className: "lp-card lp-ask", "data-lp-screen": "ask", children: [_jsx(BackLink, { label: point ? point.name : "本章", onClick: () => dispatch(point ? { type: "openPoint", pointId: point.id } : { type: "openMap" }) }), _jsx("p", { className: "lp-question", children: screen.question }), _jsxs("div", { className: "lp-answer", children: [_jsx("p", { children: screen.answer }), screen.scriptId && course.scripts[screen.scriptId] ? (_jsx(Whiteboard, { className: "lp-board", script: course.scripts[screen.scriptId] })) : null, point ? _jsxs("p", { className: "lp-meta", children: ["\u76F8\u5173\uFF1A", point.name, " ", _jsx(BookLink, { point: point, navigate: navigate })] }) : null] }), _jsx(UnderstandActions, { dispatch: dispatch, canRetry: false })] }));
}
export function todayLabel(now = new Date()) {
    return `${now.getMonth() + 1}/${now.getDate()}`;
}
