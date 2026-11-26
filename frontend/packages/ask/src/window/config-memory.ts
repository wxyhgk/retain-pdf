// 用户给每个 agent 选过的设置（模型、思考强度……）：记在本机浏览器里（localStorage），新会话开了以后再设一次。
// 只是图方便：读不到、写不进（隐私窗口、存储被禁）就当没选过。

const KEY = "retainpdf.ask.config.v1";

type Memory = Record<string, Record<string, string | boolean>>;

function read(): Memory {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    const value = raw ? JSON.parse(raw) : {};
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}

export function loadDesiredConfig(agentId: string): Record<string, string | boolean> {
  return agentId ? read()[agentId] || {} : {};
}

export function saveDesiredConfig(agentId: string, configId: string, value: string | boolean): void {
  if (!agentId) return;
  try {
    const memory = read();
    memory[agentId] = { ...memory[agentId], [configId]: value };
    globalThis.localStorage?.setItem(KEY, JSON.stringify(memory));
  } catch {
    // 存不进就只管这一次。
  }
}
