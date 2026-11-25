// 阅读页提问（ACP）的宿主端口。后端的 ACP 桥（GET /api/v1/ai/agents、WS /api/v1/ai/agents/{id}/acp）还没合，
// 正式环境先不给端口（阅读页不出提问入口）；演示模式给一个假 agent。桥合了以后这里换成 WebSocket 那个端口。
// 见 docs/core/frontend/reader-ask.md。

import type { ReaderAskPort } from "@retainpdf/reader/contracts";

import { isMockMode } from "@/platform/config/runtime.js";
import { mockAskPort } from "@/platform/mock/ask-agent.js";

function pickAskPort(): ReaderAskPort | null {
  return isMockMode() ? mockAskPort : null;
}

export const readerAskPort = pickAskPort();
