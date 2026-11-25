import type { LearningAnchor, LearningCourse } from "../course/types.js";
import { type SessionState } from "../state/session.js";
export type LearningMarkerTone = "ok" | "danger" | "warn" | "accent" | "muted";
export type LearningMarker = {
    key: string;
    anchor: LearningAnchor;
    tone: LearningMarkerTone;
    hollow?: boolean;
    label: string;
};
/** 宿主（阅读页）给学习区的能力。形状和 @retainpdf/reader 的 sidePane api 对得上，但这里不 import 阅读器。 */
export type LearningHost = {
    currentPage: number;
    navigate: (anchor: LearningAnchor) => "block" | "page" | "none";
    setMarkers: (markers: readonly LearningMarker[], onSelect?: (key: string) => void) => void;
    close?: () => void;
};
export declare function pointMarkers(course: LearningCourse, statuses: SessionState["statuses"]): LearningMarker[];
/** 提问框自动带上的「上下文」：正在看的知识点，否则是这一页上的第一个点。 */
export declare function contextPointId(course: LearningCourse, state: SessionState, currentPage: number): string | undefined;
export declare function LearningPane({ course, host }: {
    course: LearningCourse;
    host: LearningHost;
}): import("react").JSX.Element;
