import { isMockMode, mockScenario } from "@/platform/config/runtime.js";
// Mock 演示模式提示条：URL 带 ?mock=demo / parallel 等时显示。
// 引导用户打开馆藏书 → 翻译 Tab → 翻译整本，看 live 进度动画。

export function MockModeBanner() {
  if (!isMockMode()) {
    return null;
  }
  const scenario = mockScenario() || "demo";
  return (
    <div
      id="mock-mode-banner"
      className="mock-mode-banner"
      role="status"
      data-mock-scenario={scenario}
    >
      <strong>Mock 演示模式</strong>
      <span>
        当前 <code>?mock={scenario}</code>
        ：不连真实后端。打开带「馆藏」徽标的书 →「翻译」Tab →「翻译整本」，
        可在详情内看到约 16 秒的假进度（OCR → 翻译 → 渲染 → 完成）。
      </span>
    </div>
  );
}
