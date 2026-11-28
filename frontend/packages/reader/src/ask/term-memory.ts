// 记忆里的一条术语（「Hamiltonian 定译为哈密顿量」）拆成原文和译法，加进术语表时先填好（用户还能改）。
// 记忆是 AI 或用户随手写的一句话，认不出就整句放在原文里、译法空着。

const ARROWS = /\s*(?:定译为|定译成|统一译为|统一译成|译为|译成|译作|翻译为|翻译成|→|->|=>|=)\s*/;
const COLON = /\s*[：:]\s*/;
const QUOTES = /^[「『“"'《〈（(\s]+|[」』”"'》〉）)\s。．.，,；;！!]+$/g;

function clean(value: string): string {
  return value.replace(QUOTES, "").trim();
}

export function splitTermMemory(text: string): { source: string; target: string } {
  const line = `${text || ""}`.trim();
  const parts = line.split(ARROWS);
  const [left, ...rest] = parts.length > 1 ? parts : line.split(COLON);
  if (!rest.length) return { source: clean(line), target: "" };
  // 译法后面常跟一句说明（「哈密顿量，不要译成哈密尔顿」）：只取第一截。
  const target = rest.join(" ").split(/[，,；;（(]/)[0] ?? "";
  return { source: clean(left ?? ""), target: clean(target) };
}
