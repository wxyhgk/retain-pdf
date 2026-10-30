// 编辑部演示页（editorial.html）：用模拟事件回放。两个场景：6 页跑完、第 4 页后额度用完停下。
// 默认就是用户会看到的样子（简洁画面、循环播放、没有说明文字和按钮）；
// debug 时显示说明、场景切换、完整信息和回放按钮。

import { useMemo, useState } from "react";

import { buildDemoEditorialRun } from "../domain/demo-run.js";
import { EditorialRoomReplay } from "./EditorialRoomReplay.jsx";

const SCENARIOS = [
  { id: "full", label: "6 页跑完", stopAfterPage: undefined },
  { id: "quota", label: "第 4 页后额度用完", stopAfterPage: 4 },
] as const;

type ScenarioId = (typeof SCENARIOS)[number]["id"];

export function EditorialRoomDemo({
  initialScenario = "full",
  debug = false,
}: {
  initialScenario?: ScenarioId;
  debug?: boolean;
}) {
  const [scenario, setScenario] = useState<ScenarioId>(initialScenario);
  const events = useMemo(() => {
    const picked = SCENARIOS.find((item) => item.id === scenario) ?? SCENARIOS[0];
    return buildDemoEditorialRun({ stopAfterPage: picked.stopAfterPage });
  }, [scenario]);
  if (!debug) {
    return (
      <main className="editorial-room-demo is-plain">
        <EditorialRoomReplay events={events} />
      </main>
    );
  }
  return (
    <main className="editorial-room-demo">
      <header className="editorial-room-demo-head">
        <div>
          <h1>翻译编辑部 · 调试视图</h1>
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
      <EditorialRoomReplay events={events} debug />
    </main>
  );
}
