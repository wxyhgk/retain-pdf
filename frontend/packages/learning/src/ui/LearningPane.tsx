// 学习区（阅读页「学习」页签的右栏）：顶上是在哪一章，中间按在做什么换画面，底下一直有提问框。
// 设计见 docs/ops/planning/learning-system/20261125-学习区界面.md。
//
// 不认识阅读器：宿主给三样东西（LearningHost）——跳到书里、设页边小圆点、现在第几页。

import { useEffect, useMemo, useReducer, useRef, useState, type FormEvent } from "react";
import { Button } from "@retainpdf/ui";

import type { LearningAnchor, LearningCourse, PointStatus } from "../course/types.js";
import { findPoint, initialSession, sessionReducer, type SessionState } from "../state/session.js";
import { AskView, ChapterMap, ExplainView, PointCard, QuizCard, STATUS_LABEL } from "./screens.js";

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

const STATUS_TONE: Record<PointStatus, { tone: LearningMarkerTone; hollow?: boolean }> = {
  known: { tone: "ok" },
  stuck: { tone: "danger" },
  suspect: { tone: "warn" },
  untested: { tone: "muted", hollow: true },
};

export function pointMarkers(course: LearningCourse, statuses: SessionState["statuses"]): LearningMarker[] {
  return course.points.map((point) => ({
    key: point.id,
    anchor: point.anchor,
    ...STATUS_TONE[statuses[point.id]],
    label: `${point.name}：${STATUS_LABEL[statuses[point.id]]}`,
  }));
}

/** 提问框自动带上的「上下文」：正在看的知识点，否则是这一页上的第一个点。 */
export function contextPointId(course: LearningCourse, state: SessionState, currentPage: number): string | undefined {
  const screen = state.screen;
  if (screen.kind === "point" || screen.kind === "quiz" || screen.kind === "explain") return screen.pointId;
  if (screen.kind === "ask" && screen.pointId) return screen.pointId;
  return course.points.find((point) => point.anchor.page === currentPage)?.id;
}

export function LearningPane({ course, host }: { course: LearningCourse; host: LearningHost }) {
  const [state, dispatch] = useReducer(
    (current: SessionState, action: Parameters<typeof sessionReducer>[2]) => sessionReducer(course, current, action),
    course,
    initialSession,
  );

  // 页边小圆点跟着状态走；点了圆点打开那个知识点。
  const { setMarkers } = host;
  const markers = useMemo(() => pointMarkers(course, state.statuses), [course, state.statuses]);
  useEffect(() => {
    setMarkers(markers, (key) => dispatch({ type: "openPoint", pointId: key }));
  }, [markers, setMarkers]);
  useEffect(() => () => setMarkers([]), [setMarkers]);

  // 换画面时把主区滚回顶上。
  const mainRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    mainRef.current?.scrollTo?.({ top: 0 });
  }, [state.screen.kind, state.screen.kind === "quiz" ? state.screen.itemIndex : 0]);

  const contextId = contextPointId(course, state, host.currentPage);
  const [question, setQuestion] = useState("");
  const [withContext, setWithContext] = useState(true);
  useEffect(() => setWithContext(true), [contextId]);
  const contextPoint = withContext ? findPoint(course, contextId) : undefined;
  const ask = (event: FormEvent) => {
    event.preventDefault();
    if (!question.trim()) return;
    dispatch({ type: "ask", question, contextPointId: contextPoint?.id, currentPage: host.currentPage });
    setQuestion("");
  };

  const props = { course, state, dispatch, navigate: host.navigate, currentPage: host.currentPage };
  const screen = state.screen;
  return (
    <div className="lp-root" data-lp-course={course.id}>
      <header className="lp-head">
        <strong className="lp-chapter">{course.chapter}</strong>
        {host.close ? (
          <Button variant="ghost" size="sm" className="lp-close" aria-label="关掉学习" title="关掉学习" onClick={host.close}>✕</Button>
        ) : null}
      </header>
      {state.notice ? <p className="lp-notice" role="status">{state.notice}</p> : null}
      <div className="lp-main" ref={mainRef}>
        {screen.kind === "map" ? <ChapterMap {...props} /> : null}
        {screen.kind === "point" ? <PointCard {...props} pointId={screen.pointId} /> : null}
        {screen.kind === "quiz" ? <QuizCard {...props} screen={screen} /> : null}
        {screen.kind === "explain" ? <ExplainView {...props} screen={screen} /> : null}
        {screen.kind === "ask" ? <AskView {...props} screen={screen} /> : null}
      </div>
      <form className="lp-askbox" onSubmit={ask}>
        <div className="lp-askbox-context">
          <span>第 {host.currentPage} 页</span>
          {contextPoint ? (
            <Button
              variant="ghost"
              size="sm"
              className="lp-context-chip"
              title="点一下不带这个知识点"
              onClick={() => setWithContext(false)}
            >
              {contextPoint.name} ✕
            </Button>
          ) : null}
        </div>
        <div className="lp-askbox-row">
          <input
            className="lp-askbox-input"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="随时问一句……"
            aria-label="提问"
          />
          <Button variant="primary" size="sm" type="submit" disabled={!question.trim()}>问</Button>
        </div>
      </form>
    </div>
  );
}
