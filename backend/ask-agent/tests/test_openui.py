"""互动块（OpenUI）：取说明（openui_spec）、检查（openui_check，起 Node 跑 backend/openui-check）、遥测变量、
系统提示词里的 L0、工具循环里的额度。说明文件用仓库里前端生成的那份（contracts/openui/，只读）。"""
from __future__ import annotations

import io
import json
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

from retainpdf_ask_agent import AskAgent
from retainpdf_ask_agent.openui import CHECK_CALLS_PER_TURN
from retainpdf_ask_agent.openui import MAX_CHECK_OUTPUT_BYTES
from retainpdf_ask_agent.openui import SPEC_CALLS_PER_TURN
from retainpdf_ask_agent.openui import OpenUiTools
from retainpdf_ask_agent.openui import check_env
from retainpdf_ask_agent.openui import check_result
from retainpdf_ask_agent.openui import load_prompt_file
from retainpdf_ask_agent.openui import make_openui_tools
from retainpdf_ask_agent.openui import node_check_runner
from retainpdf_ask_agent.openui import openui_tools_from_env
from retainpdf_ask_agent.openui import spec_result
from retainpdf_ask_agent.prompts import load_prompt
from retainpdf_ask_agent.server import FINAL_ROUND_NOTE
from retainpdf_ask_agent.server import MAX_TOOL_ROUNDS
from retainpdf_ask_agent.tools import BookTools
from retainpdf_ask_agent.tools import ToolResult

REPO = Path(__file__).resolve().parents[3]
PROMPT = REPO / "contracts" / "openui" / "ask-openui-prompt.v1.json"
LIBRARY = REPO / "contracts" / "openui" / "ask-openui-library.v1.json"
CHECK_PACKAGE = REPO / "backend" / "openui-check"
CHECK_SCRIPT = CHECK_PACKAGE / "bin" / "openui-check.mjs"
# 前端演示模式的那段程序（frontend/web/src/platform/mock/ask-agent.ts 的 MOCK_OPENUI_BLOCK），解析器挑不出错
GOOD_PROGRAM = (CHECK_PACKAGE / "tests" / "fixtures" / "good-program.txt").read_text(encoding="utf-8")
NODE = shutil.which("node")
needs_checker = pytest.mark.skipif(
    NODE is None or not (CHECK_PACKAGE / "node_modules" / "@openuidev" / "lang-core").is_dir(),
    reason="需要 node 和 backend/openui-check 的依赖（npm ci --ignore-scripts --prefix backend/openui-check）",
)


def _prompt():
    prompt = load_prompt_file(str(PROMPT))
    assert prompt is not None
    return prompt


# 取说明 ---------------------------------------------------------------------


def test_the_contract_file_loads_with_intro_and_sections() -> None:
    prompt = _prompt()
    raw = json.loads(PROMPT.read_text(encoding="utf-8"))
    assert prompt.intro == raw["intro"].strip()
    assert prompt.ids[0] == "core" and "components:inputs" in prompt.ids and "rules" in prompt.ids
    assert "openui_spec" in prompt.intro and "openui_check" in prompt.intro


def test_spec_returns_known_sections_in_order_and_once() -> None:
    prompt = _prompt()
    by_id = {section["id"]: section["text"].strip() for section in prompt.sections}
    one = spec_result(prompt, ["core"])
    assert one.text == by_id["core"] and not one.is_error
    assert one.summary.startswith("core（约 ")
    many = spec_result(prompt, ["components:inputs", "core", "components:inputs"])
    assert many.text == f"{by_id['components:inputs']}\n\n{by_id['core']}"
    # 只给一个字符串也认
    assert spec_result(prompt, "rules").text == by_id["rules"]


def test_spec_with_unknown_ids_lists_what_can_be_taken() -> None:
    prompt = _prompt()
    unknown = spec_result(prompt, ["components:image"])
    assert unknown.is_error
    assert unknown.text.startswith("不认识的段：`components:image`。可取的段：")
    assert "- `core`：" in unknown.text and "token）" in unknown.text and "- `examples:3`：" in unknown.text
    mixed = spec_result(prompt, ["core", "nope"])
    assert not mixed.is_error and "（不认识的段：`nope`，没有取。可取的段：`core`、" in mixed.text
    assert spec_result(prompt, []).is_error and spec_result(prompt, [1, 2]).is_error


def test_a_missing_or_foreign_prompt_file_turns_interactive_blocks_off(tmp_path) -> None:
    assert load_prompt_file(str(tmp_path / "missing.json")) is None
    (tmp_path / "v2.json").write_text(json.dumps({"version": 2, "intro": "x", "sections": [{"id": "a", "text": "b"}]}), encoding="utf-8")
    assert load_prompt_file(str(tmp_path / "v2.json")) is None
    assert make_openui_tools(prompt_path=str(tmp_path / "missing.json")) is None
    assert openui_tools_from_env({"PATH": ""}) is None


# 检查 -----------------------------------------------------------------------


def _checker():
    return node_check_runner(node=NODE or "node", script=str(CHECK_SCRIPT), library=str(LIBRARY))


@needs_checker
def test_check_passes_the_frontend_demo_block() -> None:
    result = check_result(_checker(), GOOD_PROGRAM)
    assert (result.text, result.is_error, result.summary) == ("没问题。", False, "没问题")


@needs_checker
def test_check_reports_a_misspelt_component_and_a_removed_one() -> None:
    for program, name in (('root = Col([t])\nt = Titel("x")', "Titel"), ('root = Col([i])\ni = Image("https://example.com/a.png")', "Image")):
        result = check_result(_checker(), program)
        assert not result.is_error  # 检查出问题不算工具出错
        assert result.text.startswith("有 1 处问题，改完再用 openui_check 检查一次：")
        assert f'1. [unknown-component] {program[16]}：Unknown component "{name}"' in result.text
        assert "Available components: Col, Row" in result.text and "Slider" in result.text
        assert result.summary == "1 处问题：unknown-component"


def test_check_when_node_is_missing_or_not_configured() -> None:
    missing = node_check_runner(node="/nonexistent/node", script=str(CHECK_SCRIPT), library=str(LIBRARY))
    result = check_result(missing, GOOD_PROGRAM)
    assert result.is_error and result.text.startswith("检查器起不来（Node.js：") and "这次没法检查" in result.text
    tools = make_openui_tools(prompt_path=str(PROMPT), library_path=str(LIBRARY), check_script=str(CHECK_SCRIPT), node="")
    assert isinstance(tools, OpenUiTools) and tools.runner is None
    unavailable = tools.run("openui_check", {"program": GOOD_PROGRAM})
    assert unavailable.is_error and unavailable.text.startswith("检查器用不了（没找到 Node.js）")
    # 取说明照样能用
    assert not tools.run("openui_spec", {"sections": ["core"]}).is_error


def _fake_checker(tmp_path, body: str):
    """一个假的检查脚本（Python 写的，当 node 用）：测超时、输出上限、环境变量。"""
    script = tmp_path / "fake_check.py"
    script.write_text(body, encoding="utf-8")
    return node_check_runner(node=sys.executable, script=str(script), library=str(LIBRARY))


def test_check_times_out(tmp_path) -> None:
    runner = _fake_checker(tmp_path, "import time\ntime.sleep(30)\n")
    result = check_result(runner, GOOD_PROGRAM, timeout=0.5)
    assert result.is_error and result.text.startswith("检查超时（0.5 秒）")


def test_check_output_is_capped(tmp_path) -> None:
    runner = _fake_checker(tmp_path, f"import sys\nsys.stdout.write('x' * {MAX_CHECK_OUTPUT_BYTES * 2})\n")
    result = check_result(runner, GOOD_PROGRAM)
    assert result.is_error and "输出太大" in result.text


def test_check_program_length_is_capped_before_starting_node() -> None:
    def never(program, timeout):
        raise AssertionError("should not start")

    assert check_result(never, "x" * 40_001).text.startswith("程序太长")
    assert check_result(never, "   ").is_error


def test_check_reports_fatal_and_garbage_output(tmp_path) -> None:
    fatal = _fake_checker(tmp_path, "print('{\"ok\": false, \"fatal\": \"读不了组件库 x\"}')\nraise SystemExit(2)\n")
    assert check_result(fatal, GOOD_PROGRAM).text.startswith("检查器用不了：读不了组件库 x")
    garbage = _fake_checker(tmp_path, "print('hello')\n")
    assert check_result(garbage, GOOD_PROGRAM).text.startswith("检查器没有回结果（退出码 0）")


def test_check_turns_telemetry_off(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("OPENUI_RUNTIME_TELEMETRY_ENABLED", "1")
    monkeypatch.setenv("DO_NOT_TRACK", "0")
    env = check_env()
    assert env["OPENUI_TELEMETRY_DISABLED"] == "1" and env["DO_NOT_TRACK"] == "1"
    assert "OPENUI_RUNTIME_TELEMETRY_ENABLED" not in env
    # 子进程里真看到的环境变量（假检查器把它们写进 text）
    runner = _fake_checker(tmp_path, (
        "import json, os, sys\nsys.stdin.read()\n"
        "keys = ['OPENUI_TELEMETRY_DISABLED', 'DO_NOT_TRACK', 'OPENUI_RUNTIME_TELEMETRY_ENABLED']\n"
        "print(json.dumps({'ok': True, 'errors': [], 'text': json.dumps({k: os.environ.get(k) for k in keys})}))\n"))
    seen = json.loads(check_result(runner, GOOD_PROGRAM).text)
    assert seen == {"OPENUI_TELEMETRY_DISABLED": "1", "DO_NOT_TRACK": "1", "OPENUI_RUNTIME_TELEMETRY_ENABLED": None}


@needs_checker
def test_tools_from_the_bridge_environment() -> None:
    tools = openui_tools_from_env({"RETAIN_OPENUI_PROMPT": str(PROMPT), "RETAIN_OPENUI_LIBRARY": str(LIBRARY),
                                   "RETAIN_OPENUI_CHECK": str(CHECK_SCRIPT), "RETAIN_OPENUI_NODE": NODE or ""})
    assert tools is not None and tools.runner is not None
    assert tools.run("openui_check", {"program": GOOD_PROGRAM}).text == "没问题。"
    assert tools.describe("openui_spec", {"sections": ["core", "rules"]}) == ("取互动块说明：core、rules", "read")
    assert tools.describe("openui_check", {"program": "x"}) == ("检查互动块", "other")


# 接进自带 agent --------------------------------------------------------------


class FakeChecker:
    def __init__(self, replies):
        self.replies = list(replies)
        self.programs = []

    def __call__(self, program, timeout):
        self.programs.append(program)
        ok = self.replies.pop(0) if self.replies else True
        text = "没问题。" if ok else "有 1 处问题，改完再用 openui_check 检查一次：\n1. [unknown-component] t：Unknown component \"Titel\""
        return 0, json.dumps({"ok": ok, "errors": [] if ok else [{"code": "unknown-component", "statementId": "t", "message": "x"}],
                              "text": text}).encode()


def _openui(checker=None):
    return OpenUiTools(_prompt(), checker or FakeChecker([]))


def _lines(out):
    return [json.loads(line) for line in out.getvalue().splitlines() if line.strip()]


def _ask(agent, text="问"):
    agent.handle({"jsonrpc": "2.0", "id": 1, "method": "session/new", "params": {}})
    session = next(iter(agent.sessions))
    agent.handle({"jsonrpc": "2.0", "id": 2, "method": "session/prompt",
                  "params": {"sessionId": session, "prompt": [{"type": "text", "text": text}]}})
    for thread in list(agent._threads):
        thread.join(timeout=5)
    return session


def test_without_a_book_the_agent_still_gets_l0_and_the_two_tools() -> None:
    seen = []
    checker = FakeChecker([False, True])

    def stream(messages, cancel, **options):
        seen.append((list(messages), options))
        if len(seen) == 1:
            yield "tool_call", {"id": "s1", "name": "openui_spec", "arguments": {"sections": ["core", "components:inputs"]}}
        elif len(seen) == 2:
            yield "tool_call", {"id": "c1", "name": "openui_check", "arguments": {"program": 'root = Col([t])\nt = Titel("x")'}}
        elif len(seen) == 3:
            yield "tool_call", {"id": "c2", "name": "openui_check", "arguments": json.dumps({"program": GOOD_PROGRAM})}
        else:
            yield "text", "拖滑块看：\n\n```openui-lang\n" + GOOD_PROGRAM + "```"
            yield "usage", {"input_tokens": 10, "output_tokens": 5}

    out = io.StringIO()
    agent = AskAgent(stream, model="m", context_size=1000, out=out, tools=None, openui=_openui(checker))
    _ask(agent, "画个滑块演示这个公式")
    system = seen[0][0][0]["content"]
    # L0 紧跟在 ask_system.txt 后面；没有书就没有读书那段
    assert system == f"{load_prompt('ask_system.txt')}\n\n{_prompt().intro}"
    assert [tool["name"] for tool in seen[0][1]["tools"]] == ["openui_spec", "openui_check"]
    assert seen[0][1]["tool_choice"] == "auto"
    spec_reply = seen[1][0][-1]
    assert spec_reply["role"] == "tool" and spec_reply["content"].startswith("## Syntax Rules") and not spec_reply["is_error"]
    assert seen[2][0][-1]["content"].startswith("有 1 处问题")
    assert seen[3][0][-1]["content"] == "没问题。"
    assert checker.programs == ['root = Col([t])\nt = Titel("x")', GOOD_PROGRAM]
    updates = [line["params"]["update"] for line in _lines(out) if line.get("method") == "session/update"]
    cards = [update for update in updates if update["sessionUpdate"] == "tool_call"]
    assert [card["title"] for card in cards] == ["取互动块说明：core、components:inputs", "检查互动块", "检查互动块"]
    usage = _lines(out)[-1]["result"]["_meta"]["retainpdf"]["usage"]
    assert usage["tool_calls"] == 3 and usage["rounds"] == 4
    assert usage["openui"] == {"spec_calls": 1, "sections": ["core", "components:inputs"], "check_calls": 2, "check_problems": 1}


def test_spec_and_check_have_their_own_quota_apart_from_the_book() -> None:
    seen = []

    last_messages = []

    def stream(messages, cancel, **options):
        seen.append(options["tool_choice"])
        if options["tool_choice"] == "none":
            last_messages.extend(messages)
            yield "text", "照已有的回答"
            return
        # 每轮：读一页、取一次说明、检查一次
        yield "tool_call", {"id": f"r{len(seen)}", "name": "read_page", "arguments": {"page": len(seen)}}
        yield "tool_call", {"id": f"s{len(seen)}", "name": "openui_spec", "arguments": {"sections": ["core"]}}
        yield "tool_call", {"id": f"c{len(seen)}", "name": "openui_check", "arguments": {"program": GOOD_PROGRAM}}

    class Book:
        def __init__(self):
            self.calls = 0

        def specs(self):
            return [{"name": "read_page", "description": "读一页", "parameters": {"type": "object", "properties": {}}}]

        def describe(self, name, arguments):
            return "读", "read"

        def run(self, name, arguments):
            self.calls += 1
            return ToolResult(text="页")

    book = Book()
    checker = FakeChecker([])
    out = io.StringIO()
    agent = AskAgent(stream, model="m", context_size=1000, out=out, tools=book, openui=_openui(checker))
    _ask(agent)
    # 读书 4 轮用完以后还能接着调（互动块的额度还没完）；三样都用完了才 none，最后一个工具结果后面说一句让它直接答
    assert seen == ["auto"] * MAX_TOOL_ROUNDS + ["none"]
    assert last_messages[-1]["role"] == "tool" and last_messages[-1]["content"].endswith(FINAL_ROUND_NOTE)
    assert sum(FINAL_ROUND_NOTE in str(message.get("content")) for message in last_messages) == 1
    assert book.calls == MAX_TOOL_ROUNDS
    assert len(checker.programs) == CHECK_CALLS_PER_TURN
    usage = _lines(out)[-1]["result"]["_meta"]["retainpdf"]["usage"]
    assert usage["openui"]["spec_calls"] == SPEC_CALLS_PER_TURN and usage["openui"]["check_calls"] == CHECK_CALLS_PER_TURN
    assert usage["openui"]["refused"] == (MAX_TOOL_ROUNDS - SPEC_CALLS_PER_TURN) + (MAX_TOOL_ROUNDS - CHECK_CALLS_PER_TURN)
    updates = [line["params"]["update"] for line in _lines(out) if line.get("method") == "session/update"]
    failed = [update["content"][0]["content"]["text"] for update in updates
              if update["sessionUpdate"] == "tool_call_update" and update["status"] == "failed"]
    # 第 3、4 轮的取说明、第 4 轮的检查超了额度
    assert failed == ["这一问已经取了 2 次说明，这次没有执行", "这一问已经取了 2 次说明，这次没有执行", "这一问已经检查了 3 次，这次没有执行"]


def test_book_rounds_still_cap_at_four_when_openui_is_on() -> None:
    seen = []

    def stream(messages, cancel, **options):
        seen.append(options["tool_choice"])
        if len(seen) <= MAX_TOOL_ROUNDS + 1:
            yield "tool_call", {"id": f"r{len(seen)}", "name": "search_book", "arguments": {"query": "x"}}
        else:
            yield "text", "答"

    body = json.dumps({"data": {"items": []}}).encode()
    book = BookTools(job_id="job-1", http_get=lambda path, timeout: (200, "application/json", body))
    out = io.StringIO()
    agent = AskAgent(stream, model="m", context_size=1000, out=out, tools=book, openui=_openui())
    _ask(agent)
    lines = _lines(out)
    results = [line["params"]["update"] for line in lines if line.get("method") == "session/update"
               and line["params"]["update"]["sessionUpdate"] == "tool_call_update"]
    # 第 5 轮的读书不执行（回一句话），之后模型照已有的回答
    assert [result["status"] for result in results] == ["completed"] * MAX_TOOL_ROUNDS + ["failed"]
    assert lines[-1]["result"]["_meta"]["retainpdf"]["usage"]["tool_calls"] == MAX_TOOL_ROUNDS
    # 有书时：ask_system + L0 + 读书那段
    assert seen[0] == "auto"


def test_with_a_book_the_system_prompt_is_ask_system_then_l0_then_the_tools_part() -> None:
    seen = []

    def stream(messages, cancel, **options):
        seen.append((messages, options))
        yield "text", "答"

    body = json.dumps({"data": {"items": []}}).encode()
    book = BookTools(job_id="job-1", http_get=lambda path, timeout: (200, "application/json", body))
    agent = AskAgent(stream, model="m", context_size=1000, out=io.StringIO(), tools=book, openui=_openui())
    _ask(agent)
    messages, options = seen[0]
    assert messages[0]["content"] == f"{load_prompt('ask_system.txt')}\n\n{_prompt().intro}\n\n{load_prompt('ask_tools.txt')}"
    assert [tool["name"] for tool in options["tools"]] == ["read_pages", "search_book", "view_page", "openui_spec", "openui_check"]


def test_without_openui_nothing_changes() -> None:
    def stream(messages, cancel, **options):
        assert options == {} and messages[0]["content"] == load_prompt("ask_system.txt")
        yield "text", "好"

    agent = AskAgent(stream, model="m", context_size=1000, out=io.StringIO())
    _ask(agent)


def test_unknown_tool_without_a_book_goes_back_to_the_model() -> None:
    seen = []

    def stream(messages, cancel, **options):
        seen.append(messages)
        if len(seen) == 1:
            yield "tool_call", {"id": "x", "name": "read_pages", "arguments": {"pages": [1]}}
        else:
            yield "text", "答"

    agent = AskAgent(stream, model="m", context_size=1000, out=io.StringIO(), openui=_openui())
    _ask(agent)
    reply = seen[1][-1]
    assert reply["is_error"] and reply["content"] == "没有工具 read_pages；能用的是 openui_spec、openui_check。"


@needs_checker
def test_the_real_checker_runs_as_a_subprocess_from_the_entry_environment() -> None:
    # 和桥起自带 agent 时一样：环境变量指过去，真起 node
    done = subprocess.run([NODE, str(CHECK_SCRIPT), "--library", str(LIBRARY)], input=GOOD_PROGRAM, capture_output=True,
                          text=True, env=check_env(), timeout=30)
    assert json.loads(done.stdout)["ok"] is True


def test_the_three_implementations_say_the_same_thing_to_the_model() -> None:
    """pi 扩展、retainpdf mcp 的工具说明和兜底的话和这里一字一样（改一处三处都改）。"""
    import re

    from retainpdf_ask_agent import openui

    backend = REPO / "backend"
    sources = {
        "pi": re.sub(r'"\s*\n\s*\+\s*"', "", (backend / "pi-agent/extension/openui.ts").read_text(encoding="utf-8")),
        "mcp": re.sub(r"\\\n\s*", "", (backend / "cli/src/cmd/mcp_openui.rs").read_text(encoding="utf-8")),
    }
    phrases = [spec["description"] for spec in openui.TOOL_SPECS] + [
        openui.UNAVAILABLE_HINT, "不认识的段：", "，没有取。可取的段：", "程序太长（", "检查器起不来（Node.js：", "检查超时（",
        "检查器的输出太大（超过 ", "检查器没有回结果（退出码 ", "检查器用不了：", "program 要是一段 OpenUI Lang 程序（代码块里面的，不带 ``` 围栏）。",
        "sections 要是段的 id 列表（字符串）。可取的段：", "（约 ",
    ]
    for name, source in sources.items():
        for phrase in phrases:
            assert phrase.replace('"', '\\"') in source or phrase in source, (name, phrase)
