// 真起 pi-acp + 包装脚本 + pi + 我们的扩展，模型和后端都是本机假的（不花钱）。看整条链：
// 只声明三个读书工具和互动块的两个、模型要 bash 被拦下、读书走后端、材料放在问题前面、系统提示词是自带 agent 那份、密钥不落盘、不碰用户的 ~/.pi。
//
// 本机没装 pi-acp、pi 就跳过（CI 上没装）。换 pi 版本测：RETAIN_PI_TEST_PI=<pi 可执行文件> node --test backend/pi-agent/tests/
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import type { IncomingMessage, Server, ServerResponse } from "node:http";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const PI_AGENT = resolve(HERE, "..");
const PROMPTS = resolve(PI_AGENT, "../ask-agent/retainpdf_ask_agent/prompts");
const OPENUI = resolve(PI_AGENT, "../../contracts/openui");
const OPENUI_INTRO = JSON.parse(readFileSync(join(OPENUI, "ask-openui-prompt.v1.json"), "utf8")).intro.trim();
const SECRET = "synthetic-model-key-0123456789";

function which(name: string): string | null {
  const found = spawnSync("/bin/sh", ["-c", `command -v ${name}`], { encoding: "utf8" });
  return found.status === 0 && found.stdout.trim() ? found.stdout.trim() : null;
}

const PI = process.env.RETAIN_PI_TEST_PI || which("pi");
const PI_ACP = process.env.RETAIN_PI_TEST_PI_ACP || which("pi-acp");
const skip = process.platform === "win32" ? "只在 macOS、Linux 上跑" : !PI || !PI_ACP ? "本机没装 pi 或 pi-acp" : false;

const ITEMS = [
  { item_id: "p001-b0000", source: { page: 1, text: "Quantum Chemistry" }, translated: { page: 1, text: "量子化学" }, sub_type: "title", heading_level: 1 },
  { item_id: "p002-b0000", source: { page: 2, text: "The Hamiltonian is Hermitian." }, translated: { page: 2, text: "哈密顿量是厄米的。" }, sub_type: "body" },
  { item_id: "p002-b0001", source: { page: 2, text: "Its eigenvalues are real." }, translated: { page: 2, text: "它的本征值是实数。" }, sub_type: "body" },
];

async function listen(handler: (request: IncomingMessage, response: ServerResponse) => void): Promise<[Server, string]> {
  const server = createServer(handler);
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  return [server, `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`];
}

function body(request: IncomingMessage): Promise<any> {
  return new Promise((done) => {
    let text = "";
    request.on("data", (chunk) => (text += chunk));
    request.on("end", () => done(text ? JSON.parse(text) : null));
  });
}

/** 假的 OpenAI Chat Completions（流式）：第一轮要 bash 和 read_pages，之后照工具结果回答。 */
function fakeModel(requests: any[]) {
  return async (request: IncomingMessage, response: ServerResponse) => {
    const payload = await body(request);
    requests.push(payload);
    response.writeHead(200, { "content-type": "text/event-stream" });
    const send = (value: unknown) => response.write(`data: ${JSON.stringify(value)}\n\n`);
    const base = { id: "chatcmpl-1", object: "chat.completion.chunk", created: 1, model: payload.model };
    if (requests.length === 1) {
      send({ ...base, choices: [{ index: 0, delta: { role: "assistant", tool_calls: [
        { index: 0, id: "call_bash", type: "function", function: { name: "bash", arguments: JSON.stringify({ command: "echo pwned" }) } },
        { index: 1, id: "call_read", type: "function", function: { name: "read_pages", arguments: JSON.stringify({ pages: ["2"] }) } },
      ] }, finish_reason: null }] });
      send({ ...base, choices: [{ index: 0, delta: {}, finish_reason: "tool_calls" }] });
    } else {
      send({ ...base, choices: [{ index: 0, delta: { role: "assistant", content: "第 2 页说哈密顿量是厄米的（第 2 页）。" }, finish_reason: null }] });
      send({ ...base, choices: [{ index: 0, delta: {}, finish_reason: "stop" }] });
    }
    send({ ...base, choices: [], usage: { prompt_tokens: 100, completion_tokens: 10, total_tokens: 110 } });
    response.end("data: [DONE]\n\n");
  };
}

function filesUnder(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

test("pi-acp + wrapper + pi + extension: locked down and reads the book", { skip, timeout: 120_000 }, async () => {
  const modelRequests: any[] = [];
  const backendSeen: Array<[string, string | undefined]> = [];
  const [model, modelUrl] = await listen(fakeModel(modelRequests));
  const [backend, backendUrl] = await listen((request, response) => {
    backendSeen.push([request.url ?? "", request.headers["x-api-key"] as string | undefined]);
    response.writeHead(200, { "content-type": "application/json" });
    // 开会话取的上下文（记忆和前文，2026-11-26 第二期）；别的都当读书的块
    if ((request.url ?? "").startsWith("/api/v1/ai/ask-conversations/conv-1/context?")) {
      response.end(JSON.stringify({ code: 0, data: { summary: "之前聊了交换项。", messages: [{ role: "user", text: "交换项是什么？", page: 1 }],
        memory_text: "【RetainPDF 记下的关于用户的事】\n- [mem-u] 2026-11-20 回答风格：用户要先看结论" } }));
      return;
    }
    response.end(JSON.stringify({ code: 0, data: { items: ITEMS } }));
  });
  const root = mkdtempSync(join(tmpdir(), "retainpdf-pi-test-"));
  const [agentDir, home, sessions, books] = ["agent", "home", "sessions", "books"].map((name) => join(root, name));
  for (const dir of [agentDir, home, sessions, books]) mkdirSync(dir, { recursive: true });
  // 和桥（acp/pi.rs）写的一样
  writeFileSync(join(agentDir, "models.json"), JSON.stringify({ providers: { retainpdf: {
    baseUrl: `${modelUrl}/v1`, api: "openai-completions", apiKey: "$RETAIN_ASK_API_KEY",
    models: [{ id: "fake-model", name: "fake-model", reasoning: true, input: ["text", "image"], contextWindow: 128000, maxTokens: 16384,
      compat: { supportsDeveloperRole: false } }] } } }));
  writeFileSync(join(agentDir, "settings.json"), JSON.stringify({
    defaultProvider: "retainpdf", defaultModel: "fake-model", defaultThinkingLevel: "off", enabledModels: ["retainpdf/fake-model"],
    defaultTools: ["read_pages", "search_book", "view_page", "openui_spec", "openui_check", "remember", "search_memories"], defaultProjectTrust: "never", sessionDir: sessions,
    cacheWarming: "off", enableInstallTelemetry: false, enableSkillCommands: false, quietStartup: true }));
  // 桥从说明文件取 L0 写进私有配置目录（acp/openui.rs）
  writeFileSync(join(agentDir, "openui-intro.md"), OPENUI_INTRO);

  const child = spawn(PI_ACP!, [], {
    cwd: books,
    stdio: ["pipe", "pipe", "pipe"],
    env: {
      PATH: process.env.PATH ?? "",
      HOME: home,
      RETAIN_PI_USER_HOME: process.env.HOME ?? "",
      PI_ACP_PI_COMMAND: join(PI_AGENT, "bin", "retainpdf-pi"),
      RETAIN_PI_BIN: PI!,
      RETAIN_PI_PROMPTS_DIR: PROMPTS,
      RETAIN_PI_THINKING: "off",
      RETAIN_PI_SESSION_DIR: sessions,
      PI_CODING_AGENT_DIR: agentDir,
      PI_CODING_AGENT_SESSION_DIR: sessions,
      PI_OFFLINE: "1",
      PI_SKIP_VERSION_CHECK: "1",
      PI_TELEMETRY: "0",
      RETAIN_ASK_MODEL: "fake-model",
      RETAIN_ASK_API_KEY: SECRET,
      RETAIN_ASK_JOB_ID: "job-1",
      RETAIN_ASK_DOCUMENT_ID: "doc1",
      RETAIN_ASK_BACKEND_URL: backendUrl,
      RETAIN_ASK_BACKEND_KEY: "reading-key",
      RETAIN_ASK_CONVERSATION_ID: "conv-1",
      RETAIN_PI_OPENUI_INTRO: join(agentDir, "openui-intro.md"),
      RETAIN_OPENUI_PROMPT: join(OPENUI, "ask-openui-prompt.v1.json"),
      RETAIN_OPENUI_LIBRARY: join(OPENUI, "ask-openui-library.v1.json"),
      RETAIN_OPENUI_CHECK: resolve(PI_AGENT, "../openui-check/bin/openui-check.mjs"),
    },
  });
  let stderr = "";
  child.stderr.on("data", (chunk) => (stderr += chunk));
  const updates: any[] = [];
  const pending = new Map<number, (message: any) => void>();
  createInterface({ input: child.stdout }).on("line", (line) => {
    const message = JSON.parse(line);
    if (message.method === "session/update") updates.push(message.params.update);
    else if (message.id !== undefined && pending.has(message.id)) pending.get(message.id)!(message);
    else if (message.id !== undefined && message.method) {
      // agent 发来的请求（许可之类）：一律拒
      child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: message.id, result: { outcome: { outcome: "cancelled" } } }) + "\n");
    }
  });
  let nextId = 0;
  const request = (method: string, params: unknown): Promise<any> => {
    const id = ++nextId;
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
    return new Promise((done) => pending.set(id, done));
  };

  try {
    const init = await request("initialize", { protocolVersion: 1, clientCapabilities: { fs: { readTextFile: false, writeTextFile: false }, terminal: false } });
    assert.equal(init.result?.protocolVersion, 1, JSON.stringify(init) + stderr);
    const created = await request("session/new", { cwd: books, mcpServers: [] });
    const sessionId = created.result?.sessionId;
    assert.ok(sessionId, JSON.stringify(created) + stderr);
    const anchor = "我在读一本书，第 2 页（原文栏）。\n\n这一块的原文：\nThe Hamiltonian is Hermitian.\n\n（RetainPDF 任务 job-1，块 p002-b0000，第 2 页）";
    const answer = await request("session/prompt", { sessionId, prompt: [{ type: "text", text: anchor }, { type: "text", text: "下一句呢？" }] });
    assert.equal(answer.result?.stopReason, "end_turn", JSON.stringify(answer) + stderr);

    // 模型看到的：只有三个读书工具、互动块和记忆的各两个；系统提示词是自带 agent 那份（加工具说明、记忆说明、目录和记下的事）；
    // 前文和材料在问题前面
    const first = modelRequests[0];
    assert.deepEqual(first.tools.map((tool: any) => tool.function.name).sort(),
      ["openui_check", "openui_spec", "read_pages", "remember", "search_book", "search_memories", "view_page"]);
    const system = first.messages.find((message: any) => message.role === "system");
    const systemText = typeof system.content === "string" ? system.content : JSON.stringify(system.content);
    assert.ok(systemText.startsWith(readFileSync(join(PROMPTS, "ask_system.txt"), "utf8").trim().slice(0, 40)), systemText.slice(0, 200));
    assert.ok(systemText.includes("read_pages 一次读几页"), "ask_tools.txt is appended");
    // 互动块的 L0 接在 ask_system 后面、ask_tools 前面（和 Python 版一样）
    const introAt = systemText.indexOf(OPENUI_INTRO.slice(0, 30));
    assert.ok(introAt > 0 && introAt < systemText.indexOf("read_pages 一次读几页"), "the OpenUI intro sits between ask_system and ask_tools");
    assert.ok(systemText.includes("用户正在读的书共 2 页"), "the book overview is in the system prompt");
    assert.ok(!/AGENTS\.md|coding assistant/i.test(systemText));
    // 记忆：ask_memory.txt 接在 ask_tools 后面，记下的事在最后
    assert.ok(systemText.indexOf("你有记忆：remember") > systemText.indexOf("read_pages 一次读几页"), "ask_memory.txt is appended after ask_tools");
    assert.ok(systemText.indexOf("用户要先看结论") > systemText.indexOf("用户正在读的书共 2 页"), "the memories come after the book overview");
    const user = first.messages.find((message: any) => message.role === "user");
    const userText = typeof user.content === "string" ? user.content : user.content.map((part: any) => part.text ?? "").join("");
    assert.ok(userText.startsWith("【之前对话的摘要】\n之前聊了交换项。\n\n【我们之前的对话（最近几轮）】\n\n我（第 1 页）：交换项是什么？"), userText.slice(0, 120));
    assert.ok(userText.includes("【RetainPDF 从书里取的背景"), userText.slice(0, 300));
    assert.ok(userText.includes("[p002-b0001]") && userText.includes("下一句呢？"));

    // 第二轮：bash 被拦下，read_pages 读了书（宽松的页码 "2" 也认）
    const toolMessages = modelRequests[1].messages.filter((message: any) => message.role === "tool");
    const byId = Object.fromEntries(toolMessages.map((message: any) => [message.tool_call_id,
      typeof message.content === "string" ? message.content : JSON.stringify(message.content)]));
    if (process.env.RETAIN_PI_TEST_DEBUG) console.log(JSON.stringify({ systemText, userText, byId, updates }, null, 1));
    assert.ok(byId.call_read.includes("它的本征值是实数。"), byId.call_read);
    assert.ok(!byId.call_bash.includes("pwned"), byId.call_bash);
    assert.ok(backendSeen.every(([, key]) => key === "reading-key"));
    assert.ok(backendSeen.some(([path]) => path === "/api/v1/jobs/job-1/reader/regions"));
    assert.ok(updates.some((update) => update.sessionUpdate === "tool_call" && /read_pages/.test(JSON.stringify(update))));
    assert.ok(updates.some((update) => update.sessionUpdate === "agent_message_chunk" && update.content?.text?.includes("厄米")));

    // 密钥不落盘；pi-acp 的东西在私有 HOME 里，会话在 sessions 里
    for (const file of filesUnder(root)) assert.ok(!readFileSync(file, "utf8").includes(SECRET), file);
    assert.ok(!existsSync(join(agentDir, "auth.json")) || readFileSync(join(agentDir, "auth.json"), "utf8").trim() === "{}");
    assert.ok(filesUnder(join(home, ".pi")).some((file) => file.endsWith("session-map.json")));
    assert.ok(filesUnder(sessions).some((file) => file.endsWith(".jsonl")));
  } finally {
    child.kill();
    model.close();
    backend.close();
    rmSync(root, { recursive: true, force: true });
  }
});
