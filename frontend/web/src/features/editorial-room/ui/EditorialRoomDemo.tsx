// 编辑部演示页（editorial.html）：用模拟事件回放。两个场景：6 页跑完、第 4 页后额度用完停下。
// 后端推真实进度之前，演示和看效果都在这里。

import { useMemo, useState } from "react";

import { buildDemoEditorialRun } from "../domain/demo-run.js";
import { EditorialRoomReplay } from "./EditorialRoomReplay.jsx";

const SCENARIOS = [
  { id: "full", label: "6 页跑完", stopAfterPage: undefined },
  { id: "quota", label: "第 4 页后额度用完", stopAfterPage: 4 },
] as const;

type ScenarioId = (typeof SCENARIOS)[number]["id"];

export function EditorialRoomDemo({ initialScenario = "full" }: { initialScenario?: ScenarioId }) {
  const [scenario, setScenario] = useState<ScenarioId>(initialScenario);
  const events = useMemo(() => {
    const picked = SCENARIOS.find((item) => item.id === scenario) ?? SCENARIOS[0];
    return buildDemoEditorialRun({ stopAfterPage: picked.stopAfterPage });
  }, [scenario]);
  return (
    <main className="editorial-room-demo">
      <header className="editorial-room-demo-head">
        <div>
          <h1>翻译编辑部 · 演示</h1>
          <p>模拟数据回放（editorial.v1 事件）。接上后端进度后，同一套画面显示真实的翻译过程。</p>
        </div>
        <span className="editorial-room-speeds" role="radiogroup" aria-label="演示场景">
          {SCENARIOS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="radio"
              aria-checked={scenario === item.id}
              className={`editorial-room-speed${scenario === item.id ? " is-active" : ""}`}
              data-editorial-scenario={item.id}
              onClick={() => setScenario(item.id)}
            >
              {item.label}
            </button>
          ))}
        </span>
      </header>
      <EditorialRoomReplay events={events} />
    </main>
  );
}
