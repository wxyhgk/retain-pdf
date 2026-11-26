"""回答里的互动块（OpenUI，2026-11-26，只用标准库）：分层提示词和两个工具。

方案：docs/ops/planning/reader-ask/20261126-互动块分层提示词.md（前端写的需求）、
docs/ops/planning/reader-ask/20261126-互动块后端实现.md（后端怎么做）。

说明文件由前端从组件库生成，放在仓库根的 `contracts/openui/`（前端生成、后端只读，这里不复制一份）：

- `ask-openui-prompt.v1.json`：`intro` 是 L0（每个会话都带，接在系统提示词 `ask_system.txt` 后面，固定不变走缓存）；
  `sections` 是分层的说明，模型用 `openui_spec` 按 `id` 取。
- `ask-openui-library.v1.json`：组件库的 JSON 规格，`openui_check` 交给 `@openuidev/lang-core` 的解析器。

两个工具（三类 agent 一样的语义：Python 这里、pi 扩展 `backend/pi-agent/extension/openui.ts`、本机 agent 的 `retainpdf mcp`）：

- `openui_spec(sections)`：取这几段的 `text`，按给的顺序拼起来（去重）；不认识的 id 回一句话，列出可取的 id 和每段的简介。
- `openui_check(program)`：起 Node 跑 `backend/openui-check/bin/openui-check.mjs`（stdin 进程序，stdout 出一行 JSON），
  回它拼好的 `text`（「没问题。」或逐条 `[code] statementId：message`）。显式设 `OPENUI_TELEMETRY_DISABLED=1`、`DO_NOT_TRACK=1`，
  去掉 `OPENUI_RUNTIME_TELEMETRY_ENABLED`。有超时、输出大小上限、程序长度上限；Node 或 lang-core 用不了回一段说明（工具出错，
  不是整轮出错）。

每一问的上限（防失控，和读书的 4 轮分开算，见 `server.py`）：`openui_spec` 最多 `SPEC_CALLS_PER_TURN` 次、`openui_check` 最多
`CHECK_CALLS_PER_TURN` 次，超了的不执行、回一句话。
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import threading
from dataclasses import dataclass
from dataclasses import field
from typing import Any, Callable

from retainpdf_ask_agent.tools import ToolResult
from retainpdf_ask_agent.tools import tool_error

SPEC_TOOL = "openui_spec"
CHECK_TOOL = "openui_check"
TOOL_NAMES = (SPEC_TOOL, CHECK_TOOL)
# 每一问最多取几次说明、检查几次
SPEC_CALLS_PER_TURN = 2
CHECK_CALLS_PER_TURN = 3
# 检查：程序最多多少字符（和 openui-check 的 lib/check.mjs 一样）、等 Node 多久、stdout 最多读多少
MAX_PROGRAM_CHARS = 40_000
CHECK_TIMEOUT_SECS = 15.0
MAX_CHECK_OUTPUT_BYTES = 256 * 1024
# 起 openui-check 时设上 / 去掉的环境变量（lang-core 的遥测）
TELEMETRY_ENV = {"OPENUI_TELEMETRY_DISABLED": "1", "DO_NOT_TRACK": "1"}
TELEMETRY_ENABLE_ENV = "OPENUI_RUNTIME_TELEMETRY_ENABLED"

# 桥给的环境变量（`backend/packages/retainpdf-providers/src/acp/openui.rs`）
ENV_PROMPT = "RETAIN_OPENUI_PROMPT"
ENV_LIBRARY = "RETAIN_OPENUI_LIBRARY"
ENV_CHECK = "RETAIN_OPENUI_CHECK"
ENV_NODE = "RETAIN_OPENUI_NODE"

TOOL_SPECS: list[dict[str, Any]] = [
    {
        "name": SPEC_TOOL,
        "description": "取写互动块（```openui-lang 代码块）要的说明：按段的 id 取，一次取齐要用的几段（系统提示词「互动块」那段列了可取的段）。"
                       "第一次写一定要取 core。只在能动手的小界面明显比文字清楚时才写互动块；解释一句话、看译文对不对、总结、"
                       "概念问答这类问题用文字回答，不取说明。",
        "parameters": {
            "type": "object",
            "properties": {
                "sections": {"type": "array", "items": {"type": "string"}, "minItems": 1,
                             "description": "要取的段的 id，例如 [\"core\", \"components:inputs\", \"functions:builtin\"]"},
            },
            "required": ["sections"],
            "additionalProperties": False,
        },
    },
    {
        "name": CHECK_TOOL,
        "description": "检查一段 OpenUI Lang 程序（代码块里面的，不带 ``` 围栏）：组件名、参数、没定义或没被引用的名字。"
                       "没错回「没问题。」，有错逐条列出，改完再检查。",
        "parameters": {
            "type": "object",
            "properties": {
                "program": {"type": "string", "description": "OpenUI Lang 程序，每行一条 `名字 = 表达式`，有 root = Col([...])"},
            },
            "required": ["program"],
            "additionalProperties": False,
        },
    },
]

TOOL_KINDS = {SPEC_TOOL: "read", CHECK_TOOL: "other"}

# (程序, 超时秒数) → (退出码, stdout 字节)；起不来抛 OSError，超时抛 subprocess.TimeoutExpired
CheckRunner = Callable[[str, float], tuple[int, bytes]]


@dataclass
class OpenUiPrompt:
    """`ask-openui-prompt.v1.json` 读进来的样子。"""

    intro: str
    sections: list[dict[str, Any]] = field(default_factory=list)

    @property
    def ids(self) -> list[str]:
        return [str(section.get("id")) for section in self.sections]

    def catalog(self) -> str:
        return "\n".join(f"- `{section.get('id')}`：{section.get('summary') or ''}（约 {section.get('tokens') or '?'} token）"
                         for section in self.sections)


def load_prompt_file(path: str) -> OpenUiPrompt | None:
    """读说明文件；读不了、不是 v1 的样子就 None（不开互动块，照常回答）。"""
    try:
        with open(path, encoding="utf-8") as handle:
            payload = json.load(handle)
    except (OSError, ValueError):
        return None
    if not isinstance(payload, dict) or payload.get("version") != 1:
        return None
    intro = str(payload.get("intro") or "").strip()
    sections = [section for section in payload.get("sections") or [] if isinstance(section, dict) and section.get("id")
                and isinstance(section.get("text"), str)]
    if not intro or not sections:
        return None
    return OpenUiPrompt(intro=intro, sections=sections)


def spec_result(prompt: OpenUiPrompt, raw: Any) -> ToolResult:
    """`openui_spec`：按给的顺序取各段（去重），拼起来；不认识的 id 回可取的列表。"""
    if isinstance(raw, str):
        raw = [raw]
    if not isinstance(raw, list) or not raw or not all(isinstance(item, str) for item in raw):
        return tool_error(f"sections 要是段的 id 列表（字符串）。可取的段：\n{prompt.catalog()}")
    wanted: list[str] = []
    for item in raw:
        key = item.strip()
        if key and key not in wanted:
            wanted.append(key)
    by_id = {str(section["id"]): section for section in prompt.sections}
    known = [key for key in wanted if key in by_id]
    unknown = [key for key in wanted if key not in by_id]
    if not known:
        return ToolResult(text=f"不认识的段：{'、'.join(f'`{key}`' for key in unknown) or '（空）'}。可取的段：\n{prompt.catalog()}",
                          is_error=True, summary="不认识的段")
    text = "\n\n".join(str(by_id[key]["text"]).strip() for key in known)
    if unknown:
        text += f"\n\n（不认识的段：{'、'.join(f'`{key}`' for key in unknown)}，没有取。可取的段：{'、'.join(f'`{key}`' for key in prompt.ids)}。）"
    tokens = sum(int(by_id[key].get("tokens") or 0) for key in known)
    return ToolResult(text=text, summary=f"{'、'.join(known)}（约 {tokens} token）")


def check_env(base: dict[str, str] | None = None) -> dict[str, str]:
    """起 openui-check 的环境变量：关掉 lang-core 的遥测。"""
    env = dict(os.environ if base is None else base)
    env.pop(TELEMETRY_ENABLE_ENV, None)
    env.update(TELEMETRY_ENV)
    return env


def node_check_runner(*, node: str, script: str, library: str, env: dict[str, str] | None = None,
                      max_output: int = MAX_CHECK_OUTPUT_BYTES) -> CheckRunner:
    """起 `node <script> --library <library>`：stdin 写程序，stdout 最多读 `max_output + 1` 字节，超时杀掉。"""

    def run(program: str, timeout: float) -> tuple[int, bytes]:
        process = subprocess.Popen([node, script, "--library", library], stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                   stderr=subprocess.DEVNULL, env=check_env(env))
        timed_out = threading.Event()

        def kill() -> None:
            timed_out.set()
            process.kill()

        timer = threading.Timer(timeout, kill)
        timer.start()
        try:
            def feed() -> None:
                try:
                    assert process.stdin is not None
                    process.stdin.write(program.encode("utf-8"))
                    process.stdin.close()
                except OSError:
                    pass

            writer = threading.Thread(target=feed, daemon=True)
            writer.start()
            assert process.stdout is not None
            output = process.stdout.read(max_output + 1)
            if len(output) > max_output:
                process.kill()
            code = process.wait()
        finally:
            timer.cancel()
        if timed_out.is_set():
            raise subprocess.TimeoutExpired([node, script], timeout)
        return code, output

    return run


UNAVAILABLE_HINT = "这次没法检查：照 openui_spec 取的说明仔细写，写简单些；或者不写互动块，用文字回答。"


def check_result(runner: CheckRunner | None, program: Any, *, timeout: float = CHECK_TIMEOUT_SECS,
                 unavailable: str = "") -> ToolResult:
    """`openui_check`：起检查器，回它拼好的话。检查器用不了、超时、输出不对都回一段说明（工具出错）。"""
    if not isinstance(program, str) or not program.strip():
        return tool_error("program 要是一段 OpenUI Lang 程序（代码块里面的，不带 ``` 围栏）。")
    if len(program) > MAX_PROGRAM_CHARS:
        return tool_error(f"程序太长（{len(program)} 字符，最多 {MAX_PROGRAM_CHARS}）：互动块要小，拆小或删掉用不到的部分。")
    if runner is None:
        return tool_error(f"检查器用不了（{unavailable or '没配好 openui-check'}）。{UNAVAILABLE_HINT}")
    try:
        code, output = runner(program, timeout)
    except subprocess.TimeoutExpired:
        return tool_error(f"检查超时（{timeout:g} 秒）。{UNAVAILABLE_HINT}")
    except OSError as error:
        return tool_error(f"检查器起不来（Node.js：{error}）。{UNAVAILABLE_HINT}")
    if len(output) > MAX_CHECK_OUTPUT_BYTES:
        return tool_error(f"检查器的输出太大（超过 {MAX_CHECK_OUTPUT_BYTES} 字节）。{UNAVAILABLE_HINT}")
    try:
        payload = json.loads(output.decode("utf-8").strip().splitlines()[-1] if output.strip() else "")
    except (ValueError, IndexError, UnicodeDecodeError):
        return tool_error(f"检查器没有回结果（退出码 {code}）。{UNAVAILABLE_HINT}")
    if not isinstance(payload, dict):
        return tool_error(f"检查器回的不是结果（退出码 {code}）。{UNAVAILABLE_HINT}")
    if payload.get("fatal"):
        return tool_error(f"检查器用不了：{str(payload['fatal'])[:500]}。{UNAVAILABLE_HINT}")
    errors = payload.get("errors") if isinstance(payload.get("errors"), list) else []
    text = str(payload.get("text") or ("没问题。" if payload.get("ok") else "有问题，但检查器没说是什么。"))
    if payload.get("ok"):
        return ToolResult(text=text, summary="没问题")
    # 检查出了问题不算工具出错（工具卡片照常是 completed），问题在 text 里
    codes = "、".join(dict.fromkeys(str(error.get("code")) for error in errors if isinstance(error, dict)))
    return ToolResult(text=text, summary=f"{len(errors)} 处问题：{codes}"[:200])


class OpenUiTools:
    """互动块的两个工具。`runner` 是起检查器的函数（None 时 `unavailable` 说为什么），测试里换成假的。"""

    def __init__(self, prompt: OpenUiPrompt, runner: CheckRunner | None, *, unavailable: str = "",
                 timeout: float = CHECK_TIMEOUT_SECS):
        self.prompt = prompt
        self.runner = runner
        self.unavailable = unavailable
        self.timeout = timeout

    @property
    def intro(self) -> str:
        return self.prompt.intro

    def specs(self) -> list[dict[str, Any]]:
        return TOOL_SPECS

    def handles(self, name: str) -> bool:
        return name in TOOL_NAMES

    def describe(self, name: str, arguments: dict[str, Any]) -> tuple[str, str]:
        if name == SPEC_TOOL:
            sections = arguments.get("sections")
            sections = [sections] if isinstance(sections, str) else sections if isinstance(sections, list) else []
            return f"取互动块说明：{'、'.join(str(item) for item in sections[:8]) or '（空）'}", TOOL_KINDS[name]
        if name == CHECK_TOOL:
            return "检查互动块", TOOL_KINDS[name]
        return name, "other"

    def run(self, name: str, arguments: dict[str, Any]) -> ToolResult:
        if name == SPEC_TOOL:
            return spec_result(self.prompt, arguments.get("sections"))
        if name == CHECK_TOOL:
            return check_result(self.runner, arguments.get("program"), timeout=self.timeout, unavailable=self.unavailable)
        return tool_error(f"没有工具 {name}；互动块的工具是 {SPEC_TOOL}、{CHECK_TOOL}。")


def make_openui_tools(*, prompt_path: str, library_path: str = "", check_script: str = "", node: str = "") -> OpenUiTools | None:
    """按桥给的路径建工具；说明文件读不了就不开互动块（None）。检查器缺东西时照样开，`openui_check` 回说明。"""
    prompt = load_prompt_file(prompt_path) if prompt_path else None
    if prompt is None:
        return None
    missing = [label for label, value in (("组件库 ask-openui-library.v1.json", library_path), ("openui-check", check_script),
                                          ("Node.js", node)) if not value or not os.path.exists(value)]
    if missing:
        return OpenUiTools(prompt, None, unavailable=f"没找到 {'、'.join(missing)}")
    return OpenUiTools(prompt, node_check_runner(node=node, script=check_script, library=library_path))


def openui_tools_from_env(env: dict[str, str] | None = None) -> OpenUiTools | None:
    """`__main__.py` 用：桥给的 `RETAIN_OPENUI_*`（`RETAIN_OPENUI_NODE` 没给就找 PATH 上的 node）。"""
    env = dict(os.environ if env is None else env)
    node = env.get(ENV_NODE, "").strip() or shutil.which("node", path=env.get("PATH")) or ""
    return make_openui_tools(prompt_path=env.get(ENV_PROMPT, "").strip(), library_path=env.get(ENV_LIBRARY, "").strip(),
                             check_script=env.get(ENV_CHECK, "").strip(), node=node)


__all__ = [
    "CHECK_CALLS_PER_TURN", "CHECK_TOOL", "OpenUiPrompt", "OpenUiTools", "SPEC_CALLS_PER_TURN", "SPEC_TOOL", "TOOL_NAMES",
    "TOOL_SPECS", "check_env", "check_result", "load_prompt_file", "make_openui_tools", "node_check_runner",
    "openui_tools_from_env", "spec_result",
]
