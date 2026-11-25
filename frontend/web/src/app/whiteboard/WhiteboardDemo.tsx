// 白板演示页：「无限白板」（双击写字，Markdown + 公式）和「讲解脚本」（AI 一步步写的讲解）。不调后端。
// ?mode=script 打开讲解脚本；?script=<key> 选脚本，?step=<n> 停在第几步（从 1 数），?still=1 不放动画（截图测试用）。
// ?board=sample 用一份写死的示例白板（不读也不写本机存档，截图测试用）。

import { useMemo, useState } from "react";
import { Button } from "@retainpdf/ui";
import { Board, Whiteboard, emptyBoard, useBoardStorage, type BoardDoc } from "@retainpdf/whiteboard";
import { SZABO_CH3_SCRIPTS as DEMO_SCRIPTS } from "@retainpdf/learning";
import { sampleBoard } from "./board-sample.js";

const BOARD_KEY = "retainpdf:board:demo:v1";

function readParams() {
  const params = new URLSearchParams(globalThis.location?.search || "");
  const key = params.get("script");
  const step = Number(params.get("step"));
  return {
    mode: params.get("mode") === "script" ? "script" as const : "board" as const,
    key: DEMO_SCRIPTS.some((demo) => demo.key === key) ? key! : DEMO_SCRIPTS[0].key,
    step: Number.isInteger(step) && step >= 1 ? step - 1 : 0,
    still: params.get("still") === "1",
    sample: params.get("board") === "sample",
  };
}

function BoardDemo({ sample }: { sample: boolean }) {
  const [stored, setStored] = useBoardStorage(BOARD_KEY);
  const [fixed, setFixed] = useState<BoardDoc>(sampleBoard);
  const doc = sample ? fixed : stored;
  const setDoc = sample ? setFixed : setStored;
  return (
    <div className="wbdemo-boardwrap">
      <div className="wbdemo-boardbar">
        <span>双击空白处写字；公式用 <code>$…$</code>，单独一块再打一个 <code>$</code>；打 <code>\fr</code> 有补全；⌘/Ctrl + 滚轮缩放。</span>
        <Button variant="ghost" size="sm" onClick={() => setDoc(sampleBoard())}>放几张示例</Button>
        <Button variant="ghost" size="sm" onClick={() => setDoc(emptyBoard())}>清空</Button>
      </div>
      <Board className="wbdemo-board-canvas" doc={doc} onChange={setDoc} label="演示白板" />
    </div>
  );
}

export function WhiteboardDemo() {
  const initial = useMemo(readParams, []);
  const [mode, setMode] = useState(initial.mode);
  const [key, setKey] = useState(initial.key);
  const [step, setStep] = useState(initial.step);
  const demo = DEMO_SCRIPTS.find((item) => item.key === key) ?? DEMO_SCRIPTS[0];

  return (
    <main className="wbdemo">
      <header className="wbdemo-head">
        <h1>白板</h1>
        <div className="wbdemo-modes" role="tablist" aria-label="白板演示">
          <Button variant="ghost" size="sm" role="tab" aria-selected={mode === "board"} className="wbdemo-item" aria-current={mode === "board" ? "true" : undefined} onClick={() => setMode("board")}>无限白板</Button>
          <Button variant="ghost" size="sm" role="tab" aria-selected={mode === "script"} className="wbdemo-item" aria-current={mode === "script" ? "true" : undefined} onClick={() => setMode("script")}>讲解脚本</Button>
        </div>
      </header>
      {mode === "board" ? <BoardDemo sample={initial.sample} /> : (
        <div className="wbdemo-body">
          <nav className="wbdemo-list" aria-label="讲解脚本">
            {DEMO_SCRIPTS.map((item) => (
              <Button
                key={item.key}
                variant="ghost"
                className="wbdemo-item"
                aria-current={item.key === key ? "true" : undefined}
                onClick={() => {
                  setKey(item.key);
                  setStep(0);
                }}
              >
                {item.label}
              </Button>
            ))}
          </nav>
          <Whiteboard
            key={demo.key}
            className="wbdemo-board"
            script={demo.script}
            step={step}
            onStepChange={setStep}
            reducedMotion={initial.still || undefined}
            onIssues={(issues) => console.warn("[whiteboard] 脚本问题", issues)}
          />
        </div>
      )}
    </main>
  );
}
