// openui_check 的检查本身（不碰文件、不碰环境变量，测试直接调）：
// 用 @openuidev/lang-core 的 createParser(组件库 JSON 规格, "Col") 解析程序，报 parse(...).meta.errors，
// 再从同一次解析的 meta 补几条 parser 不算错、但画出来会出问题的：没写完（incomplete）、用了没定义的名字（unresolved）、
// 定义了没被引用（orphaned，不会画出来）、一条语句都没有。
// 回给模型的文字（text）在这里拼好，三类 agent 原样转给模型，说法一致。

/** 程序最多多少字符（stdin 读到的 UTF-8 字节另有上限，见 bin/openui-check.mjs）。 */
export const MAX_PROGRAM_CHARS = 40_000;
/** 一次最多回几条问题（太多的说一句还有几条）。 */
export const MAX_ERRORS = 20;
/** 每条问题的说明最多多少字符（unknown-component 的说明带整张可用组件列表，约 600 字符，要留着）。 */
export const MAX_MESSAGE_CHARS = 1_200;

function clip(text, limit) {
  const value = String(text ?? "");
  return value.length <= limit ? value : `${value.slice(0, limit - 1)}…`;
}

/**
 * @param {{parse(program: string): any}} parser createParser(schema, "Col") 的结果
 * @param {string} program 代码块里面的 OpenUI Lang（不带围栏）
 * @returns {{ok: boolean, errors: {code: string, statementId?: string, message: string}[], statements: number, text: string}}
 */
export function checkProgram(parser, program) {
  const source = String(program ?? "");
  const errors = [];
  if (!source.trim()) {
    errors.push({ code: "empty-program", message: "程序是空的：每行一条 `名字 = 表达式`，必须有 `root = Col([...])`。" });
    return finish(errors, 0);
  }
  if (source.length > MAX_PROGRAM_CHARS) {
    errors.push({
      code: "program-too-long",
      message: `程序太长（${source.length} 字符，最多 ${MAX_PROGRAM_CHARS}）：互动块要小，拆小或删掉用不到的部分。`,
    });
    return finish(errors, 0);
  }
  const fenced = /^\s*```/.test(source);
  const result = parser.parse(fenced ? source.replace(/^\s*```[^\n]*\n?/, "").replace(/\n?```\s*$/, "") : source);
  const meta = result?.meta ?? {};
  for (const error of Array.isArray(meta.errors) ? meta.errors : []) {
    errors.push({
      code: String(error?.code ?? "error"),
      ...(error?.statementId ? { statementId: String(error.statementId) } : {}),
      message: clip(error?.message, MAX_MESSAGE_CHARS),
    });
  }
  const statements = Number(meta.statementCount ?? 0) || 0;
  if (meta.incomplete) {
    errors.push({ code: "incomplete", message: "程序没写完：有括号、方括号、花括号或引号没闭合。" });
  }
  for (const name of Array.isArray(meta.unresolved) ? meta.unresolved : []) {
    errors.push({ code: "unresolved-reference", statementId: String(name), message: `用到了 \`${name}\`，但没有定义它（每条语句单独一行：\`${name} = ...\`）。` });
  }
  for (const name of Array.isArray(meta.orphaned) ? meta.orphaned : []) {
    errors.push({ code: "orphaned-statement", statementId: String(name), message: `\`${name}\` 定义了但没有被引用，不会画出来：放进父组件的 children，或者删掉。` });
  }
  if (!errors.length && statements === 0) {
    errors.push({ code: "empty-program", message: "没有认出任何语句：每行一条 `名字 = 表达式`，必须有 `root = Col([...])`。" });
  }
  return finish(errors, statements, fenced);
}

function finish(errors, statements, fenced = false) {
  const ok = errors.length === 0;
  return { ok, errors: errors.slice(0, MAX_ERRORS), statements, text: formatText(errors, fenced) };
}

/** 给模型看的一段话：没错回「没问题」，有错逐条列 code、statementId、message。 */
export function formatText(errors, fenced = false) {
  const note = fenced ? "\n（注意：openui_check 只收代码块里面的程序，不带 ``` 围栏；这次已经替你去掉了。）" : "";
  if (!errors.length) {
    return `没问题。${note}`;
  }
  const lines = errors.slice(0, MAX_ERRORS).map((error, index) => {
    const where = error.statementId ? ` ${error.statementId}` : "";
    return `${index + 1}. [${error.code}]${where}：${error.message}`;
  });
  if (errors.length > MAX_ERRORS) {
    lines.push(`……还有 ${errors.length - MAX_ERRORS} 条，先改上面的。`);
  }
  return `有 ${errors.length} 处问题，改完再用 openui_check 检查一次：\n${lines.join("\n")}${note}`;
}
