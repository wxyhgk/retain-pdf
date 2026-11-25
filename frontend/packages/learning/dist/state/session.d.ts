import type { CannedAnswer, LearningCourse, LearningPoint, PointEvidence, PointStatus } from "../course/types.js";
export declare const MAX_HINT_LEVEL = 6;
export type QuizScreen = {
    kind: "quiz";
    pointId: string;
    itemIndex: number;
    choice: number | null;
    confidence: number | null;
    result: null | "correct" | "wrong";
    /** 已经给到第几级提示（0 = 还没给）。 */
    hintLevel: number;
};
export type Screen = {
    kind: "map";
} | {
    kind: "point";
    pointId: string;
} | QuizScreen | {
    kind: "explain";
    pointId: string;
    scriptId: string;
    attempt: number; /** 讲完点「懂了」回到哪道题。 */
    itemIndex: number;
} | {
    kind: "ask";
    question: string;
    answer: string;
    scriptId?: string;
    pointId?: string;
};
export type SessionState = {
    screen: Screen;
    statuses: Record<string, PointStatus>;
    evidence: Record<string, PointEvidence[]>;
    /** 每个知识点被问过几次。 */
    asked: Record<string, number>;
    /** 一句提示（例如「这个点还没有题」），显示一下就好。 */
    notice: string;
};
export type SessionAction = {
    type: "openMap";
} | {
    type: "openPoint";
    pointId: string;
} | {
    type: "startQuiz";
    pointId: string;
    itemIndex?: number;
} | {
    type: "choose";
    choice: number;
} | {
    type: "confidence";
    value: number;
} | {
    type: "submit";
    today: string;
} | {
    type: "hint";
    today: string;
} | {
    type: "nextItem";
} | {
    type: "explain";
    pointId: string;
    scriptId?: string;
    itemIndex?: number;
} | {
    type: "explainAgain";
} | {
    type: "explainOther";
} | {
    type: "understood";
} | {
    type: "ask";
    question: string;
    contextPointId?: string;
    currentPage: number;
};
export declare function initialSession(course: LearningCourse): SessionState;
export declare function findPoint(course: LearningCourse, pointId: string | undefined): LearningPoint | undefined;
export declare function statusCounts(state: SessionState): Record<PointStatus, number>;
/** 「从卡点开始」：先卡住的，再疑似误解的，按书里的顺序。 */
export declare function firstStuckPoint(course: LearningCourse, state: SessionState): LearningPoint | undefined;
/** 「测一下这一章」：第一个还没测、而且有题的点。 */
export declare function firstUntestedWithItems(course: LearningCourse, state: SessionState): LearningPoint | undefined;
export declare function matchCanned(canned: readonly CannedAnswer[], question: string): CannedAnswer | undefined;
export declare function sessionReducer(course: LearningCourse, state: SessionState, action: SessionAction): SessionState;
