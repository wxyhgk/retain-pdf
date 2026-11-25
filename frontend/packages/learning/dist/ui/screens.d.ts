import type { Dispatch } from "react";
import type { LearningAnchor, LearningCourse, PointStatus } from "../course/types.js";
import { type QuizScreen, type SessionAction, type SessionState } from "../state/session.js";
export declare const STATUS_LABEL: Record<PointStatus, string>;
export type Navigate = (anchor: LearningAnchor) => "block" | "page" | "none";
type ScreenProps = {
    course: LearningCourse;
    state: SessionState;
    dispatch: Dispatch<SessionAction>;
    navigate: Navigate;
    currentPage: number;
};
export declare function StatusDot({ status }: {
    status: PointStatus;
}): import("react").JSX.Element;
export declare function ChapterMap({ course, state, dispatch, navigate, currentPage }: ScreenProps): import("react").JSX.Element;
export declare function PointCard({ course, state, dispatch, navigate, pointId }: ScreenProps & {
    pointId: string;
}): import("react").JSX.Element;
export declare function QuizCard({ course, state, dispatch, screen }: ScreenProps & {
    screen: QuizScreen;
}): import("react").JSX.Element;
export declare function ExplainView({ course, dispatch, navigate, screen }: ScreenProps & {
    screen: Extract<SessionState["screen"], {
        kind: "explain";
    }>;
}): import("react").JSX.Element;
export declare function AskView({ course, dispatch, navigate, screen }: ScreenProps & {
    screen: Extract<SessionState["screen"], {
        kind: "ask";
    }>;
}): import("react").JSX.Element;
export declare function todayLabel(now?: Date): string;
export {};
