// 提问窗回答里的公式分隔符（streamdown 的 remark-math 只认 $ / $$）。

/** 模型常写 \( \) 和 \[ \]，remark-math 只认 $ / $$：换一下（代码块里的不动）。 */
export function normalizeMathDelimiters(text: string): string {
  return `${text || ""}`
    .split(/(```[\s\S]*?(?:```|$))/)
    .map((chunk, index) => (index % 2
      ? chunk
      : chunk.replace(/\\\[([\s\S]*?)\\\]/g, (_, body) => `$$${body}$$`).replace(/\\\(([\s\S]*?)\\\)/g, (_, body) => `$${body}$`)))
    .join("");
}
