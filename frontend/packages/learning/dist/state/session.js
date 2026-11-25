// 学习区的状态和规则（纯函数，原型版的 Orchestrator）：
// 现在在哪个画面、每个知识点的状态怎么跟着答题变、提问配哪条回答。
//
// 规则写死在这里，不在提示词里（总设计第 1 条「代码决策，模型生成」）：
// - 不看提示、第一次就答对 → 会了；看了提示才对 → 还不算会，没测过的记成卡住。
// - 答错 → 卡住；诊断题信心 4、5 分答错 → 疑似误解（以后要走推理→预测→反例三步确认，原型先只标出来）。
// - 提示一次只升一级；第 6 级直接给答案，这题记为答错。
// - 学生说「懂了」不改状态，只是出一道新题来验证。
export const MAX_HINT_LEVEL = 6;
export function initialSession(course) {
    return {
        screen: { kind: "map" },
        statuses: Object.fromEntries(course.points.map((point) => [point.id, point.status])),
        evidence: Object.fromEntries(course.points.map((point) => [point.id, [...point.evidence]])),
        asked: {},
        notice: "",
    };
}
export function findPoint(course, pointId) {
    return pointId ? course.points.find((point) => point.id === pointId) : undefined;
}
export function statusCounts(state) {
    const counts = { known: 0, stuck: 0, suspect: 0, untested: 0 };
    for (const status of Object.values(state.statuses))
        counts[status] += 1;
    return counts;
}
/** 「从卡点开始」：先卡住的，再疑似误解的，按书里的顺序。 */
export function firstStuckPoint(course, state) {
    return course.points.find((point) => state.statuses[point.id] === "stuck")
        ?? course.points.find((point) => state.statuses[point.id] === "suspect");
}
/** 「测一下这一章」：第一个还没测、而且有题的点。 */
export function firstUntestedWithItems(course, state) {
    return course.points.find((point) => state.statuses[point.id] === "untested" && point.itemIds.length > 0);
}
export function matchCanned(canned, question) {
    const text = question.toLowerCase();
    return canned.find((entry) => entry.keywords.some((keyword) => text.includes(keyword.toLowerCase())));
}
function addEvidence(state, pointId, entry) {
    return { ...state.evidence, [pointId]: [...(state.evidence[pointId] ?? []), entry] };
}
function withStatus(state, pointId, status) {
    return { ...state.statuses, [pointId]: status };
}
export function sessionReducer(course, state, action) {
    const screen = state.screen;
    switch (action.type) {
        case "openMap":
            return { ...state, screen: { kind: "map" }, notice: "" };
        case "openPoint":
            return findPoint(course, action.pointId) ? { ...state, screen: { kind: "point", pointId: action.pointId }, notice: "" } : state;
        case "startQuiz": {
            const point = findPoint(course, action.pointId);
            if (!point)
                return state;
            if (!point.itemIds.length)
                return { ...state, screen: { kind: "point", pointId: point.id }, notice: "这个点在演示里还没有题。" };
            const itemIndex = Math.min(action.itemIndex ?? 0, point.itemIds.length - 1);
            return {
                ...state,
                notice: "",
                screen: { kind: "quiz", pointId: point.id, itemIndex, choice: null, confidence: null, result: null, hintLevel: 0 },
            };
        }
        case "choose":
            return screen.kind === "quiz" && screen.result === null
                ? { ...state, screen: { ...screen, choice: action.choice } }
                : state;
        case "confidence":
            return screen.kind === "quiz" && screen.result === null
                ? { ...state, screen: { ...screen, confidence: action.value } }
                : state;
        case "submit": {
            if (screen.kind !== "quiz" || screen.result !== null || screen.choice === null)
                return state;
            const point = findPoint(course, screen.pointId);
            const item = course.items[point.itemIds[screen.itemIndex]];
            // 选「我不知道」（下标等于选项数）算答错，但不算高信心答错。
            const dontKnow = screen.choice === item.options.length;
            const correct = !dontKnow && screen.choice === item.answer;
            const current = state.statuses[point.id];
            let status;
            let text;
            if (correct && screen.hintLevel === 0) {
                status = "known";
                text = "新题首次答对";
            }
            else if (correct) {
                status = current === "untested" ? "stuck" : current;
                text = `第 ${screen.hintLevel} 级提示后答对`;
            }
            else if (!dontKnow && item.diagnostic && (screen.confidence ?? 0) >= 4) {
                status = "suspect";
                text = `信心 ${screen.confidence} 分答错（疑似误解，待确认）`;
            }
            else {
                status = "stuck";
                text = dontKnow ? "选了「我不知道」" : "答错";
            }
            return {
                ...state,
                statuses: withStatus(state, point.id, status),
                evidence: addEvidence(state, point.id, { date: action.today, text }),
                screen: { ...screen, result: correct ? "correct" : "wrong" },
            };
        }
        case "hint": {
            if (screen.kind !== "quiz" || screen.result === "correct")
                return state;
            const point = findPoint(course, screen.pointId);
            const item = course.items[point.itemIds[screen.itemIndex]];
            const maxLevel = Math.min(MAX_HINT_LEVEL, item.hints.length + 1);
            const hintLevel = Math.min(screen.hintLevel + 1, maxLevel);
            if (hintLevel === maxLevel) {
                // 最后一级是直接给答案：这题记为答错。
                return {
                    ...state,
                    statuses: withStatus(state, point.id, "stuck"),
                    evidence: addEvidence(state, point.id, { date: action.today, text: "看了答案（记为答错）" }),
                    screen: { ...screen, hintLevel, choice: item.answer, result: "wrong" },
                };
            }
            // 答错之后要提示：回到作答状态，再选一次。
            return { ...state, screen: { ...screen, hintLevel, result: null, choice: null } };
        }
        case "nextItem": {
            if (screen.kind !== "quiz")
                return state;
            const point = findPoint(course, screen.pointId);
            const next = screen.itemIndex + 1;
            if (next >= point.itemIds.length) {
                return { ...state, screen: { kind: "point", pointId: point.id }, notice: "这个点的题做完了。" };
            }
            return {
                ...state,
                screen: { kind: "quiz", pointId: point.id, itemIndex: next, choice: null, confidence: null, result: null, hintLevel: 0 },
            };
        }
        case "explain": {
            const point = findPoint(course, action.pointId);
            const scriptId = action.scriptId ?? point?.scriptId;
            if (!point || !scriptId || !course.scripts[scriptId]) {
                return { ...state, notice: "这个点在演示里还没有讲解。" };
            }
            const itemIndex = action.itemIndex ?? (screen.kind === "quiz" ? screen.itemIndex : 0);
            return { ...state, notice: "", screen: { kind: "explain", pointId: point.id, scriptId, attempt: 1, itemIndex } };
        }
        case "explainAgain":
            return screen.kind === "explain" ? { ...state, screen: { ...screen, attempt: screen.attempt + 1 }, notice: "" } : state;
        case "explainOther":
            return screen.kind === "explain"
                ? { ...state, screen: { ...screen, attempt: screen.attempt + 1 }, notice: "换个说法：演示里每个点只有一种讲法，正式版会换成例子、反例、类比或拆步骤。" }
                : state;
        case "understood": {
            // 说「懂了」不改状态：出一道新题来验证（讲之前那道题的下一道；没有就从第一道）。
            if (screen.kind !== "explain" && screen.kind !== "ask")
                return state;
            const pointId = screen.kind === "explain" ? screen.pointId : screen.pointId;
            const point = findPoint(course, pointId);
            if (!point?.itemIds.length) {
                return { ...state, screen: point ? { kind: "point", pointId: point.id } : { kind: "map" }, notice: "这个点在演示里还没有题，没法验证。" };
            }
            const from = screen.kind === "explain" ? screen.itemIndex + 1 : 0;
            const itemIndex = from < point.itemIds.length ? from : 0;
            return {
                ...state,
                notice: "出一道新题验证一下。",
                screen: { kind: "quiz", pointId: point.id, itemIndex, choice: null, confidence: null, result: null, hintLevel: 0 },
            };
        }
        case "ask": {
            const question = action.question.trim();
            if (!question)
                return state;
            const canned = matchCanned(course.canned, question);
            const pointId = canned?.pointId ?? action.contextPointId;
            const context = findPoint(course, action.contextPointId);
            const answer = canned?.answer
                ?? `（演示）还没接模型。正式版会结合你正在看的第 ${action.currentPage} 页${context ? `、正在学的「${context.name}」` : ""}来回答，长的推导直接用白板讲。`;
            return {
                ...state,
                notice: "",
                asked: pointId ? { ...state.asked, [pointId]: (state.asked[pointId] ?? 0) + 1 } : state.asked,
                screen: { kind: "ask", question, answer, ...(canned?.scriptId ? { scriptId: canned.scriptId } : {}), ...(pointId ? { pointId } : {}) },
            };
        }
        default:
            return state;
    }
}
