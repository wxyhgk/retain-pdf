/**
 * RetainPDF 的 pi 扩展：让 pi 读用户正在读的这本书（2026-11-26，方案 docs/ops/planning/reader-ask/20261126-RetainPDF加pi.md）。
 *
 * 后端的 ACP 桥起 pi-acp，pi-acp 经包装脚本（`../bin/retainpdf-pi`）起 pi，脚本用 `-e` 加载这个文件。
 * 书、后端地址、读书密钥只从环境变量来（桥给的，模型看不到也挑不了地址）：
 * `RETAIN_ASK_JOB_ID`、`RETAIN_ASK_DOCUMENT_ID`、`RETAIN_ASK_BACKEND_URL`、`RETAIN_ASK_BACKEND_KEY`。没有书就什么工具也不注册。
 *
 * 和 Python 自带 agent（`backend/ask-agent`）一样：
 * - 三个只读工具 `read_pages` / `search_book` / `view_page`（`book.ts`，接口、截断上限照搬 `tools.py`）；
 * - 材料先给：`input` 钩子把代码取好的材料放在这一问最前面（带字的补节和前后块，不带字的取那一页，没有文字层附页图）；
 * - 系统提示词：包装脚本用 `--system-prompt` 给 `ask_system.txt`、`--append-system-prompt` 给 `ask_tools.txt`，
 *   这里在 `before_agent_start` 加一节 `book`（页数和目录）；
 * - 防失控的上限：一问最多 4 轮调工具、每轮最多 4 个，超了不执行、回一句话让模型照已有的回答。
 *
 * 另加一道锁：除了这三个工具和互动块的两个，别的工具（pi 的 read/bash/edit/write、MCP……）一律拦下。包装脚本已经用
 * `-nbt --tools …` 关掉了，这里是升级 pi 后默认行为变了时的保险。
 *
 * 互动块（2026-11-26，`openui.ts`）：桥给了说明文件（`RETAIN_OPENUI_PROMPT`）就注册 `openui_spec`、`openui_check`（有没有书都注册）。
 * L0 由包装脚本接在系统提示词里。上限和 Python 版一样分开算：读书最多 4 轮（一轮里调了读书的工具算一轮），
 * 取说明最多 2 次、检查最多 3 次。
 *
 * 记忆和前文（2026-11-26 第二期，`memory.ts`）：桥给了后端地址和密钥就注册 `remember`、`search_memories`（不要书），
 * 每一问最多记 3 次、查 2 次（和 Python 版 TurnBudget 一样，不算读书的轮数）；给了对话编号就在开会话时取上下文：
 * 记忆那段放进系统提示词一节 `memory`（最后），摘要和最近几轮放在这个会话第一问的最前面。
 *
 * 不 import pi 的包（工具参数写成普通 JSON Schema），测试时能用假的 `pi` 对象直接跑。
 */
import { anchorFromTexts, BookTools, makeBookTools, MAX_READ_PAGES, MAX_SEARCH_LIMIT, DEFAULT_SEARCH_LIMIT, splitPrompt, toolTitle } from "./book.ts";
import type { ToolResult } from "./book.ts";
import { CHECK_CALLS_PER_TURN, CHECK_TOOL, makeOpenUiTools, OPENUI_TOOL_SPECS, OPENUI_TOOLS, OpenUiTools, SPEC_CALLS_PER_TURN, SPEC_TOOL } from "./openui.ts";
import { historyText, makeMemoryTools, MEMORY_TOOL_SPECS, MEMORY_TOOLS, MemoryTools, REMEMBER_PER_TURN, REMEMBER_TOOL, SEARCH_PER_TURN, SEARCH_TOOL } from "./memory.ts";

export const BOOK_TOOLS = ["read_pages", "search_book", "view_page"];
// 防失控的上限（不是规则）：和 Python 版 server.py 的 MAX_TOOL_ROUNDS / MAX_TOOL_CALLS_PER_ROUND 一样
export const MAX_TOOL_ROUNDS = 4;
export const MAX_TOOL_CALLS_PER_ROUND = 4;
// 超了上限还在调：再多给两轮让它照已有的回答，还调就结束这一问（pi 的 terminate）。
// 总轮数按读书的轮数加取说明、检查的次数算（和 Python 版 MAX_TOTAL_ROUNDS 一样）
export const MAX_TOTAL_ROUNDS = MAX_TOOL_ROUNDS + SPEC_CALLS_PER_TURN + CHECK_CALLS_PER_TURN;
const HARD_STOP_ROUNDS = MAX_TOTAL_ROUNDS + 2;

const TOOL_SPECS = [
  {
    name: "read_pages",
    label: "读页",
    description: "一次读书的几页（最多 5 页）：每页每一块的块编号、类型、原文和译文（按阅读顺序，页眉页脚页码不算）。"
      + "页码是原文 PDF 的页码，从 1 开始（和阅读页显示的一样）。要读的页一次给全，别一页一页地调。"
      + "side 只要原文（source）或只要译文（translated）时给，默认都要。",
    parameters: {
      type: "object",
      properties: {
        pages: { type: "array", items: { type: "integer", minimum: 1 }, minItems: 1, maxItems: MAX_READ_PAGES, description: "页码列表，从 1 开始" },
        side: { type: "string", enum: ["both", "source", "translated"], description: "要原文、译文还是都要，默认 both" },
      },
      required: ["pages"],
      additionalProperties: false,
    },
  },
  {
    name: "search_book",
    label: "在书里找",
    description: "在整本书的原文和译文里找字（不分大小写；空格隔开的几个词都要出现在同一块里）。"
      + "每条命中带页码、所在的节、整块原文和译文，一般够直接回答，不用再读页。"
      + "不知道在哪页时用；一个词找不到再换原文或译文的说法试一次。",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "要找的字或词" },
        limit: { type: "integer", minimum: 1, maximum: MAX_SEARCH_LIMIT, description: `最多回几条，默认 ${DEFAULT_SEARCH_LIMIT}` },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "view_page",
    label: "看页图",
    description: "看一页的图（JPEG）：只在公式、图、表的文字读不清，或者要核对排版时用；图很占篇幅。"
      + "side=source 看原文页（默认），side=translated 看排好的译文页。",
    parameters: {
      type: "object",
      properties: {
        page: { type: "integer", minimum: 1, description: "原文 PDF 的页码，从 1 开始" },
        side: { type: "string", enum: ["source", "translated"], description: "原文页还是译文页，默认 source" },
      },
      required: ["page"],
      additionalProperties: false,
    },
  },
];

/** 模型给的参数宽松一点：页码写成字符串、read_pages 只给了 page，都先改成工具说明的样子再校验（Python 版也认这些）。 */
export function prepareArguments(name: string, raw: unknown): Record<string, unknown> {
  const args: Record<string, any> = raw && typeof raw === "object" && !Array.isArray(raw) ? { ...(raw as object) } : {};
  const number = (value: unknown) => (typeof value === "string" && /^\s*\d+\s*$/.test(value) ? Number(value) : value);
  if (name === "read_pages") {
    let pages = args.pages ?? (args.page !== undefined ? [args.page] : undefined);
    if (typeof pages === "number" || typeof pages === "string") pages = [pages];
    if (Array.isArray(pages)) args.pages = pages.map(number);
    delete args.page;
  } else if (name === "view_page") {
    args.page = number(args.page);
  } else if (name === "search_book" && args.limit !== undefined) {
    args.limit = number(args.limit);
  }
  return args;
}

function toPiResult(result: ToolResult) {
  return {
    content: [
      { type: "text", text: result.text },
      ...result.images.map((image) => ({ type: "image", data: image.data, mimeType: image.mimeType })),
    ],
    details: { summary: result.summary },
    ...(result.isError ? { isError: true } : {}),
  };
}

/** 一问之内的轮数、每轮的调用数、读书用了几轮、取说明和检查用了几次（`agent_start` 清零，`turn_start` 加一轮）。 */
export class RoundGuard {
  rounds = 0;
  callsThisRound = 0;
  bookRounds = 0;
  lastBookRound = 0;
  specCalls = 0;
  checkCalls = 0;
  rememberCalls = 0;
  searchCalls = 0;
  allowed: string[];

  constructor(allowed: string[] = [...BOOK_TOOLS, ...OPENUI_TOOLS]) {
    this.allowed = allowed;
  }

  startRun(): void {
    this.rounds = 0;
    this.callsThisRound = 0;
    this.bookRounds = 0;
    this.lastBookRound = 0;
    this.specCalls = 0;
    this.checkCalls = 0;
    this.rememberCalls = 0;
    this.searchCalls = 0;
  }

  startTurn(): void {
    this.rounds += 1;
    this.callsThisRound = 0;
  }

  /** 这次工具调用要不要拦：返回 pi `tool_call` 钩子的结果，放行是 undefined。 */
  check(toolName: string): { block: true; reason: string; terminate?: boolean } | undefined {
    if (!this.allowed.includes(toolName)) {
      return { block: true, reason: `这里只能用这几个工具（${this.allowed.join("、")}），${toolName} 不能用。` };
    }
    // turn_start 没来过（老版本 pi 没这个事件）就当第一轮
    const round = Math.max(this.rounds, 1);
    if (round > HARD_STOP_ROUNDS) {
      return { block: true, terminate: true, reason: "调工具的轮数远超上限，这一问到此为止。" };
    }
    this.callsThisRound += 1;
    if (this.callsThisRound > MAX_TOOL_CALLS_PER_ROUND) {
      return { block: true, reason: `一轮最多调 ${MAX_TOOL_CALLS_PER_ROUND} 个工具，这个没有执行；照已有的内容回答，或者下一轮再调。` };
    }
    if (toolName === SPEC_TOOL) {
      if (this.specCalls >= SPEC_CALLS_PER_TURN) {
        return { block: true, reason: `这一问已经取了 ${SPEC_CALLS_PER_TURN} 次说明，这次没有执行：用已经取到的说明写，或者不写互动块、用文字回答。` };
      }
      this.specCalls += 1;
      return undefined;
    }
    if (toolName === CHECK_TOOL) {
      if (this.checkCalls >= CHECK_CALLS_PER_TURN) {
        return { block: true, reason: `这一问已经检查了 ${CHECK_CALLS_PER_TURN} 次，这次没有执行：还有错就把互动块改简单，或者不放互动块、用文字回答。` };
      }
      this.checkCalls += 1;
      return undefined;
    }
    if (toolName === REMEMBER_TOOL) {
      if (this.rememberCalls >= REMEMBER_PER_TURN) {
        return { block: true, reason: `这一问已经记了 ${REMEMBER_PER_TURN} 条，这次没有记：挑最要紧的，下一问再记。` };
      }
      this.rememberCalls += 1;
      return undefined;
    }
    if (toolName === SEARCH_TOOL) {
      if (this.searchCalls >= SEARCH_PER_TURN) {
        return { block: true, reason: `这一问已经查了 ${SEARCH_PER_TURN} 次记忆，这次没有执行：照已有的回答。` };
      }
      this.searchCalls += 1;
      return undefined;
    }
    // 读书：一轮里第一次调读书的工具时算一轮
    if (this.lastBookRound !== round) {
      if (this.bookRounds >= MAX_TOOL_ROUNDS) {
        return { block: true, reason: `读书的工具这一问已经用了 ${MAX_TOOL_ROUNDS} 轮，这次没有执行：照已有的内容回答。` };
      }
      this.bookRounds += 1;
      this.lastBookRound = round;
    }
    return undefined;
  }
}

/** 一问之前代码取好的材料（放在问题前面），和 Python 版 server.py 的 `_plan` 一样挑：带字的补背景，不带字的取那一页。 */
export async function contextFor(book: BookTools, prompt: string): Promise<{ text: string; images: Array<{ type: "image"; data: string; mimeType: string }> } | null> {
  const texts = splitPrompt(prompt);
  let context;
  try {
    context = book.carriesText(texts) ? await book.background(texts) : await book.prefetch(texts);
  } catch {
    return null; // 取不到材料就照常回答
  }
  if (!context || !context.text) return null;
  return { text: context.text, images: context.images.map((image) => ({ type: "image" as const, data: image.data, mimeType: image.mimeType })) };
}

export function readEnv(env: NodeJS.ProcessEnv = process.env) {
  return {
    jobId: env.RETAIN_ASK_JOB_ID,
    documentId: env.RETAIN_ASK_DOCUMENT_ID,
    baseUrl: env.RETAIN_ASK_BACKEND_URL,
    apiKey: env.RETAIN_ASK_BACKEND_KEY,
  };
}

/** pi 的扩展入口。`book`、`openui`、`memory` 给了就用它们（测试），不然按环境变量建。 */
export default function retainpdfBook(
  pi: any,
  book: BookTools | null = makeBookTools(readEnv()),
  openui: OpenUiTools | null = makeOpenUiTools(),
  memory: MemoryTools | null = makeMemoryTools(),
): void {
  const guard = new RoundGuard([...BOOK_TOOLS, ...(openui ? OPENUI_TOOLS : []), ...(memory ? MEMORY_TOOLS : [])]);

  // 锁：不管有没有书，只放行读书的三个工具（和互动块、记忆的两个）
  pi.on("tool_call", (event: { toolName: string }) => guard.check(event.toolName));
  pi.on("agent_start", () => guard.startRun());
  pi.on("turn_start", () => guard.startTurn());

  if (openui) {
    for (const spec of OPENUI_TOOL_SPECS) {
      pi.registerTool({
        ...spec,
        async execute(_toolCallId: string, params: Record<string, any>) {
          return toPiResult(await openui.run(spec.name, params));
        },
      });
    }
  }

  if (memory) {
    for (const spec of MEMORY_TOOL_SPECS) {
      pi.registerTool({
        ...spec,
        async execute(_toolCallId: string, params: Record<string, any>) {
          return toPiResult(await memory.run(spec.name, params));
        },
      });
    }
  }

  if (book) {
    for (const spec of TOOL_SPECS) {
      pi.registerTool({
        ...spec,
        prepareArguments: (raw: unknown) => prepareArguments(spec.name, raw),
        async execute(_toolCallId: string, params: Record<string, any>) {
          return toPiResult(await book.run(spec.name, params));
        },
      });
    }
  }
  if (!book && !memory) return; // 没有书也没有后端：只靠问题里附的上下文

  // 用户打字的时候把书的块取好、把对话的上下文取好，第一问不用等
  pi.on("session_start", () => {
    book?.warm();
    void memory?.context();
  });

  // 第一问前面放前文（摘要 + 最近几轮），每一问前面放书里取的材料（和 Python 版一样，系统提示词说的「消息最前面……那段」）。
  // 续接的旧会话（pi 的会话文件里已经有消息）不再给前文：它第一问前面已经有过了
  let historyGiven = false;
  pi.on("input", async (event: { text: string; images?: unknown[]; source?: string }, ctx?: any) => {
    if (event.source === "extension") return { action: "continue" };
    const texts = splitPrompt(event.text || "");
    if (memory) memory.page = anchorFromTexts(texts, memory.jobId)?.page ?? null;
    const parts: string[] = [];
    if (memory && !historyGiven) {
      historyGiven = true;
      if (!sessionHasMessages(ctx)) {
        const history = historyText(await memory.context());
        if (history) parts.push(history);
      }
    }
    const context = book ? await contextFor(book, event.text || "") : null;
    if (context) parts.push(context.text);
    if (!parts.length) return { action: "continue" };
    return { action: "transform", text: `${parts.join("\n\n")}\n\n${event.text}`, images: [...(context?.images ?? []), ...(event.images ?? [])] };
  });

  // 系统提示词加两节：这本书的页数和目录、RetainPDF 记下的关于用户和这本书的事（放最后）
  pi.on("before_agent_start", async (event: { systemPromptOptions?: { sections?: Record<string, string> } }) => {
    const sections = event.systemPromptOptions?.sections;
    if (!sections) return undefined;
    const overview = book ? await book.overview() : null;
    if (overview) sections.book = overview;
    const memoryText = String((await memory?.context())?.memory_text ?? "").trim();
    if (memoryText) sections.memory = memoryText;
    return undefined;
  });
}

/** pi 的会话里已经有消息没有（续接旧会话）；看不了当没有。 */
export function sessionHasMessages(ctx: any): boolean {
  try {
    const entries = ctx?.sessionManager?.getEntries?.();
    return Array.isArray(entries) && entries.some((entry: any) => entry?.type === "message");
  } catch {
    return false;
  }
}

export { toolTitle, TOOL_SPECS };
