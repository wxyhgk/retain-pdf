// 学习区中间那一块的几个画面：本章地图、知识点卡、做题、讲解、问答。
// 画面只管显示和把点击变成 action；规则都在 state/session.ts。

import type { Dispatch } from "react";
import { Button } from "@retainpdf/ui";
import { Whiteboard } from "@retainpdf/whiteboard";

import type { LearningAnchor, LearningCourse, LearningPoint, PointStatus } from "../course/types.js";
import {
  MAX_HINT_LEVEL,
  findPoint,
  firstStuckPoint,
  firstUntestedWithItems,
  statusCounts,
  type QuizScreen,
  type SessionAction,
  type SessionState,
} from "../state/session.js";
import { MathText } from "./MathText.js";

export const STATUS_LABEL: Record<PointStatus, string> = {
  known: "会了",
  stuck: "卡住",
  suspect: "疑似误解",
  untested: "未测",
};

export type Navigate = (anchor: LearningAnchor) => "block" | "page" | "none";

type ScreenProps = {
  course: LearningCourse;
  state: SessionState;
  dispatch: Dispatch<SessionAction>;
  navigate: Navigate;
  currentPage: number;
};

export function StatusDot({ status }: { status: PointStatus }) {
  return <span className={`lp-dot is-${status}`} aria-hidden="true" />;
}

function BookLink({ point, navigate, label }: { point: LearningPoint; navigate: Navigate; label?: string }) {
  return (
    <Button
      className="lp-book-link"
      title={`回书里看：第 ${point.anchor.page} 页`}
      aria-label={`回书里看：第 ${point.anchor.page} 页`}
      onClick={(event) => {
        event.stopPropagation();
        navigate(point.anchor);
      }}
    >
      {label ?? `p.${point.anchor.page}`} ↗
    </Button>
  );
}

// —— A. 本章地图 ——
export function ChapterMap({ course, state, dispatch, navigate, currentPage }: ScreenProps) {
  const counts = statusCounts(state);
  const total = course.points.length;
  const sections: Array<{ name: string; points: LearningPoint[] }> = [];
  for (const point of course.points) {
    const last = sections.at(-1);
    if (last?.name === point.section) last.points.push(point);
    else sections.push({ name: point.section, points: [point] });
  }
  const stuck = firstStuckPoint(course, state);
  const untested = firstUntestedWithItems(course, state);
  return (
    <div className="lp-map" data-lp-screen="map">
      <p className="lp-counts">
        {(["known", "stuck", "suspect", "untested"] as const).map((status) => (
          <span key={status} className="lp-count"><StatusDot status={status} />{STATUS_LABEL[status]} {counts[status]}</span>
        ))}
      </p>
      <div className="lp-progress" aria-label={`会了 ${counts.known} / ${total}`}>
        {(["known", "suspect", "stuck", "untested"] as const).map((status) => (
          <span key={status} className={`lp-progress-part is-${status}`} style={{ flexGrow: counts[status] }} />
        ))}
      </div>
      {sections.map((section) => (
        <section key={section.name} className="lp-section">
          <h3 className="lp-section-title">{section.name}</h3>
          <ul className="lp-points">
            {section.points.map((point) => (
              <li key={point.id}>
                <div
                  role="button"
                  tabIndex={0}
                  className={`lp-point-row${point.anchor.page === currentPage ? " is-on-page" : ""}`}
                  data-lp-point={point.id}
                  onClick={() => dispatch({ type: "openPoint", pointId: point.id })}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      dispatch({ type: "openPoint", pointId: point.id });
                    }
                  }}
                >
                  <StatusDot status={state.statuses[point.id]} />
                  <span className="lp-point-name">{point.name}</span>
                  <span className={`lp-status is-${state.statuses[point.id]}`}>{STATUS_LABEL[state.statuses[point.id]]}</span>
                  <BookLink point={point} navigate={navigate} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <div className="lp-actions lp-map-actions">
        <Button variant="primary" size="sm" disabled={!stuck} onClick={() => stuck && dispatch({ type: "openPoint", pointId: stuck.id })}>
          从卡点开始
        </Button>
        <Button variant="secondary" size="sm" disabled={!untested} onClick={() => untested && dispatch({ type: "startQuiz", pointId: untested.id })}>
          测一下这一章
        </Button>
      </div>
    </div>
  );
}

function BackLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button variant="ghost" size="sm" className="lp-back" onClick={onClick}>
      ← {label}
    </Button>
  );
}

// —— B. 知识点卡 ——
export function PointCard({ course, state, dispatch, navigate, pointId }: ScreenProps & { pointId: string }) {
  const point = findPoint(course, pointId);
  if (!point) return null;
  const status = state.statuses[point.id];
  const asked = state.asked[point.id] ?? 0;
  return (
    <div className="lp-card" data-lp-screen="point">
      <BackLink label="本章" onClick={() => dispatch({ type: "openMap" })} />
      <header className="lp-card-head">
        <h2>{point.name}</h2>
        <span className={`lp-status is-${status}`}><StatusDot status={status} />{STATUS_LABEL[status]}</span>
      </header>
      <p className="lp-meta">出处：{point.anchor.quote ?? `第 ${point.anchor.page} 页`} <BookLink point={point} navigate={navigate} /></p>
      <p className="lp-summary">{point.summary}</p>
      <dl className="lp-facts">
        <dt>依据</dt>
        <dd>
          {state.evidence[point.id]?.length ? (
            <ul className="lp-evidence">
              {state.evidence[point.id].map((entry, index) => <li key={index}>{entry.date} {entry.text}</li>)}
            </ul>
          ) : "还没做过这个点的题"}
        </dd>
        {point.prereqs.length ? (
          <>
            <dt>前置</dt>
            <dd className="lp-prereqs">
              {point.prereqs.map((id) => {
                const prereq = findPoint(course, id);
                return prereq ? (
                  <Button key={id} variant="ghost" size="sm" onClick={() => dispatch({ type: "openPoint", pointId: id })}>
                    <StatusDot status={state.statuses[id]} />{prereq.name}
                  </Button>
                ) : null;
              })}
            </dd>
          </>
        ) : null}
        {asked ? (<><dt>问过</dt><dd>{asked} 次</dd></>) : null}
      </dl>
      <div className="lp-actions">
        <Button variant="primary" size="sm" onClick={() => dispatch({ type: "startQuiz", pointId: point.id })}>测一下</Button>
        <Button variant="secondary" size="sm" onClick={() => dispatch({ type: "explain", pointId: point.id })}>讲给我听</Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={!point.exampleScriptId}
          onClick={() => point.exampleScriptId && dispatch({ type: "explain", pointId: point.id, scriptId: point.exampleScriptId })}
        >
          看一道例题
        </Button>
      </div>
    </div>
  );
}

// —— C. 做题 ——
export function QuizCard({ course, state, dispatch, screen }: ScreenProps & { screen: QuizScreen }) {
  const point = findPoint(course, screen.pointId)!;
  const item = course.items[point.itemIds[screen.itemIndex]];
  const today = todayLabel();
  const dontKnowIndex = item.options.length;
  const answered = screen.result !== null;
  const lastLevel = Math.min(MAX_HINT_LEVEL, item.hints.length + 1);
  const revealed = screen.hintLevel >= lastLevel;
  return (
    <div className="lp-card lp-quiz" data-lp-screen="quiz">
      <BackLink label={point.name} onClick={() => dispatch({ type: "openPoint", pointId: point.id })} />
      <p className="lp-quiz-progress">第 {screen.itemIndex + 1} / {point.itemIds.length} 题{item.diagnostic ? " · 诊断题" : ""}</p>
      <p className="lp-stem">{item.stem}</p>
      {item.stemMath ? <MathText tex={item.stemMath} size="m" /> : null}
      <div className="lp-options" role="radiogroup" aria-label="选项">
        {[...item.options, { text: "我不知道" }].map((option, index) => {
          const selected = screen.choice === index;
          const isAnswer = answered && index === item.answer;
          const isWrongPick = answered && selected && index !== item.answer;
          return (
            <Button
              key={index}
              role="radio"
              aria-checked={selected}
              className={`lp-option${selected ? " is-selected" : ""}${isAnswer ? " is-answer" : ""}${isWrongPick ? " is-wrong" : ""}${index === dontKnowIndex ? " is-dont-know" : ""}`}
              disabled={answered}
              onClick={() => dispatch({ type: "choose", choice: index })}
            >
              {"math" in option && option.math ? <MathText tex={option.text} /> : option.text}
            </Button>
          );
        })}
      </div>
      {item.diagnostic && !answered ? (
        <div className="lp-confidence" role="radiogroup" aria-label="有多确定">
          <span>有多确定？</span>
          {[1, 2, 3, 4, 5].map((value) => (
            <Button
              key={value}
              role="radio"
              aria-checked={screen.confidence === value}
              className={`lp-confidence-value${screen.confidence === value ? " is-selected" : ""}`}
              onClick={() => dispatch({ type: "confidence", value })}
            >
              {value}
            </Button>
          ))}
        </div>
      ) : null}
      {screen.hintLevel > 0 ? (
        <ol className="lp-hints" aria-label="提示">
          {item.hints.slice(0, Math.min(screen.hintLevel, item.hints.length)).map((hint, index) => (
            <li key={index}><span className="lp-hint-level">第 {index + 1} 级</span>{hint}</li>
          ))}
          {revealed ? <li className="is-reveal"><span className="lp-hint-level">第 {lastLevel} 级</span>直接给答案（这题记为答错）</li> : null}
        </ol>
      ) : null}
      {answered ? (
        <div className={`lp-feedback is-${screen.result}`} role="status">
          <strong>{screen.result === "correct" ? "对。" : revealed ? "答案标出来了。" : "不对。"}</strong> {item.explanation}
        </div>
      ) : null}
      <div className="lp-actions">
        {!answered ? (
          <>
            <Button variant="primary" size="sm" disabled={screen.choice === null} onClick={() => dispatch({ type: "submit", today })}>提交</Button>
            {screen.hintLevel > 0 ? (
              <Button variant="secondary" size="sm" disabled={revealed} onClick={() => dispatch({ type: "hint", today })}>
                {screen.hintLevel + 1 >= lastLevel ? "直接看答案" : `再给一点提示（第 ${screen.hintLevel + 1} 级）`}
              </Button>
            ) : null}
          </>
        ) : screen.result === "wrong" && !revealed ? (
          <>
            <Button variant="secondary" size="sm" onClick={() => dispatch({ type: "hint", today })}>
              {screen.hintLevel + 1 >= lastLevel ? "直接看答案" : `给我一点提示（第 ${screen.hintLevel + 1} 级）`}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => dispatch({ type: "explain", pointId: point.id })}>讲一讲</Button>
          </>
        ) : (
          <>
            <Button variant="primary" size="sm" onClick={() => dispatch({ type: "nextItem" })}>
              {screen.itemIndex + 1 < point.itemIds.length ? "下一题" : "做完了"}
            </Button>
            {screen.result === "wrong" ? (
              <Button variant="secondary" size="sm" onClick={() => dispatch({ type: "explain", pointId: point.id })}>讲一讲</Button>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

function UnderstandActions({ dispatch, canRetry }: { dispatch: Dispatch<SessionAction>; canRetry: boolean }) {
  return (
    <div className="lp-actions">
      {canRetry ? <Button variant="secondary" size="sm" onClick={() => dispatch({ type: "explainAgain" })}>还是不懂</Button> : null}
      {canRetry ? <Button variant="secondary" size="sm" onClick={() => dispatch({ type: "explainOther" })}>换个说法</Button> : null}
      <Button variant="primary" size="sm" onClick={() => dispatch({ type: "understood" })}>懂了，出题验证</Button>
    </div>
  );
}

// —— D. 讲解 ——
export function ExplainView({ course, dispatch, navigate, screen }: ScreenProps & { screen: Extract<SessionState["screen"], { kind: "explain" }> }) {
  const point = findPoint(course, screen.pointId)!;
  return (
    <div className="lp-card lp-explain" data-lp-screen="explain">
      <BackLink label={`${point.name} · 讲解`} onClick={() => dispatch({ type: "openPoint", pointId: point.id })} />
      <Whiteboard key={`${screen.scriptId}:${screen.attempt}`} className="lp-board" script={course.scripts[screen.scriptId]} />
      <p className="lp-meta">这一步在书里 <BookLink point={point} navigate={navigate} /></p>
      <UnderstandActions dispatch={dispatch} canRetry />
    </div>
  );
}

// —— 问答 ——
export function AskView({ course, dispatch, navigate, screen }: ScreenProps & { screen: Extract<SessionState["screen"], { kind: "ask" }> }) {
  const point = findPoint(course, screen.pointId);
  return (
    <div className="lp-card lp-ask" data-lp-screen="ask">
      <BackLink label={point ? point.name : "本章"} onClick={() => dispatch(point ? { type: "openPoint", pointId: point.id } : { type: "openMap" })} />
      <p className="lp-question">{screen.question}</p>
      <div className="lp-answer">
        <p>{screen.answer}</p>
        {screen.scriptId && course.scripts[screen.scriptId] ? (
          <Whiteboard className="lp-board" script={course.scripts[screen.scriptId]} />
        ) : null}
        {point ? <p className="lp-meta">相关：{point.name} <BookLink point={point} navigate={navigate} /></p> : null}
      </div>
      <UnderstandActions dispatch={dispatch} canRetry={false} />
    </div>
  );
}

export function todayLabel(now: Date = new Date()): string {
  return `${now.getMonth() + 1}/${now.getDate()}`;
}
