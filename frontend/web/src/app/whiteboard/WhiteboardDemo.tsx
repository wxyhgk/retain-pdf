// 白板讲解板演示页：左边选脚本，右边播。只用写死的脚本，不调后端。
// ?script=<key> 选脚本，?step=<n> 停在第几步（从 1 数），?still=1 不放动画（截图测试用）。

import { useMemo, useState } from "react";
import { Button } from "@retainpdf/ui";
import { Whiteboard } from "@retainpdf/whiteboard";
import { SZABO_CH3_SCRIPTS as DEMO_SCRIPTS } from "@retainpdf/learning";

function readParams() {
  const params = new URLSearchParams(globalThis.location?.search || "");
  const key = params.get("script");
  const step = Number(params.get("step"));
  return {
    key: DEMO_SCRIPTS.some((demo) => demo.key === key) ? key! : DEMO_SCRIPTS[0].key,
    step: Number.isInteger(step) && step >= 1 ? step - 1 : 0,
    still: params.get("still") === "1",
  };
}

export function WhiteboardDemo() {
  const initial = useMemo(readParams, []);
  const [key, setKey] = useState(initial.key);
  const [step, setStep] = useState(initial.step);
  const demo = DEMO_SCRIPTS.find((item) => item.key === key) ?? DEMO_SCRIPTS[0];

  return (
    <main className="wbdemo">
      <header className="wbdemo-head">
        <h1>白板讲解板</h1>
        <p>学习系统的讲解板演示：脚本是写死的草稿（Szabo 第 3 章），只看画得对不对。</p>
      </header>
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
    </main>
  );
}
