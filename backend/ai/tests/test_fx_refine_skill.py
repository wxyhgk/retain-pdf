"""终端里的精修能力：宿主 broker 接线、SKILL.md、AGENTS.md。

broker 那几条走真实的 wrapper → Unix socket → 假 CLI 进程，确认：
- CLI 拿到的是**任务级、单动作**的 capability，没有 API key；
- 请求体落在 broker 自己的 requests/ 里，fx 碰不到；
- 终端模式只放行 translation 这一组，用法错误原样告诉 agent。
"""

from __future__ import annotations

import json
import re
import shlex
import stat
import subprocess
import sys
from pathlib import Path

import pytest

from retainpdf_ai.agent_broker_commands import parse_broker_command
from retainpdf_ai.agent_broker_contracts import BrokerScope
from retainpdf_ai.agent_command_broker import AgentCommandBroker
from retainpdf_ai.fx_skills import (
    REFINE_TRANSLATION_SKILL,
    remove_refine_translation_skill,
    write_refine_translation_skill,
)
from retainpdf_ai.fx_terminal import build_terminal_launch, terminal_translation_scope
from retainpdf_ai.fx_workspace import (
    build_job_workspace_instructions,
    build_merged_workspace_instructions,
)

JOB = "20261006023250-703433"


class FakeIssuer:
    def __init__(self) -> None:
        self.calls: list[dict] = []

    def issue_agent_capability(self, **kwargs) -> dict:
        self.calls.append(kwargs)
        return {"capability": "rpdfcap1.host-only.secret"}


def _fake_cli(path: Path, log: Path) -> Path:
    """假的 retainpdf-agent：记下 argv / 环境 / 请求体，回一个成功信封。"""
    source = f"""#!{sys.executable}
import json, os, sys
from pathlib import Path
args = sys.argv[1:]
body = None
if "--request" in args:
    body = json.loads(Path(args[args.index("--request") + 1]).read_text(encoding="utf-8"))
with open({str(log)!r}, "a", encoding="utf-8") as handle:
    handle.write(json.dumps({{
        "argv": args,
        "body": body,
        "cwd": os.getcwd(),
        "capability": os.environ.get("RETAINPDF_AGENT_CAPABILITY"),
        "api_key": os.environ.get("RETAINPDF_AGENT_API_KEY"),
    }}) + "\\n")
data = {{"job_id": "{JOB}", "item_id": "p003-b004", "changed": True, "generation": 3,
        "validation": {{"passed": True, "error_count": 0, "warning_count": 0, "issues": []}},
        "revision": {{"revision_id": "rev-1"}}, "live_publication": {{"status": "published"}},
        "page_number": 3, "item": {{"source_text": "where", "translated_text": "其中"}},
        "revisions": [], "total": 0}}
print(json.dumps({{"schema": "retainpdf_agent_cli_response_v1", "ok": True, "http_status": 200,
                  "response": {{"code": 0, "message": "ok", "data": data}}, "error": None}}))
"""
    path.write_text(source, encoding="utf-8")
    path.chmod(path.stat().st_mode | stat.S_IXUSR)
    return path


def _log(log: Path) -> list[dict]:
    if not log.exists():
        return []
    return [json.loads(line) for line in log.read_text(encoding="utf-8").splitlines()]


def _terminal_broker(tmp_path: Path, *, green_light: bool, issuer: FakeIssuer, log: Path):
    cli = _fake_cli(tmp_path / "real-cli", log)
    return AgentCommandBroker(
        state_root=tmp_path / "state",
        cli_command=str(cli),
        rust_api_url="http://127.0.0.1:41000",
        rust=issuer,
        scope=BrokerScope(
            conversation_id="",
            document_id="",
            request_message_id="",
            intent_summary="",
            job_id=JOB,
            green_light=green_light,
        ),
        job_dir=tmp_path / "jobs" / JOB,
        terminal_mode=True,
    )


def _wrapper(broker: AgentCommandBroker, *args: str) -> subprocess.CompletedProcess:
    return subprocess.run(
        [str(broker.bin_dir / "retainpdf-agent"), *args],
        env={"PATH": str(broker.bin_dir), "HOME": "/nonexistent"},
        capture_output=True,
        text=True,
        check=False,
        timeout=10,
    )


def test_terminal_wrapper_runs_the_real_cli_with_a_job_scoped_capability(tmp_path):
    issuer = FakeIssuer()
    log = tmp_path / "cli.log"
    with _terminal_broker(tmp_path, green_light=True, issuer=issuer, log=log) as broker:
        wrapper_source = (broker.bin_dir / "retainpdf-agent").read_text(encoding="utf-8")
        assert "rpdfcap1" not in wrapper_source
        completed = _wrapper(
            broker,
            "translation", "revise", "--item-id", "p003-b004",
            "--text", "其中 $k$ 为劲度系数", "--reason", "术语统一",
        )
    assert completed.returncode == 0, completed.stderr
    payload = json.loads(completed.stdout)
    assert payload["revision_id"] == "rev-1"
    assert issuer.calls == [
        {
            "conversation_id": "",
            "document_id": "",
            "actions": ["translation.revise"],
            "ttl_seconds": 60,
            "job_id": JOB,
        }
    ]
    [call] = _log(log)
    assert call["argv"][:6] == ["translation", "revise", "--job-id", JOB, "--item-id", "p003-b004"]
    assert call["argv"][6] == "--request"
    assert call["body"] == {
        "translated_text": "其中 $k$ 为劲度系数",
        "source": "agent",
        "reason": "术语统一",
        "rerender": False,
    }
    assert call["capability"] == "rpdfcap1.host-only.secret"
    assert call["api_key"] is None
    # 请求体在 broker 自己的目录里，不在 agent 的工作区。
    work = Path(call["cwd"]).resolve()
    assert work.name == "work" and work.parent.parent.name == "brokers"
    assert (tmp_path / "state").resolve() in work.parents


def test_terminal_refuses_effects_without_confirmation_and_says_why(tmp_path):
    issuer = FakeIssuer()
    log = tmp_path / "cli.log"
    with _terminal_broker(tmp_path, green_light=False, issuer=issuer, log=log) as broker:
        refused = _wrapper(broker, "translation", "rerender")
        read = _wrapper(broker, "translation", "show", "--item-id", "p003-b004")
    assert refused.returncode == 1
    assert "授权" in refused.stderr and "绿灯" in refused.stderr
    assert read.returncode == 0, read.stderr
    # 被拒的那条既没签 capability，也没碰 CLI。
    assert [call["actions"] for call in issuer.calls] == [["translation.read"], ["translation.read"]]
    assert all(call["argv"][0] == "translation" for call in _log(log))


def test_terminal_mode_admits_only_the_translation_grammar(tmp_path):
    issuer = FakeIssuer()
    log = tmp_path / "cli.log"
    with _terminal_broker(tmp_path, green_light=True, issuer=issuer, log=log) as broker:
        document = _wrapper(broker, "operation", "get", "--operation-id", "op-1")
        usage = _wrapper(broker, "translation", "issues", "--pages", "abc")
    assert document.returncode == 1 and "translation" in document.stderr
    assert usage.returncode == 1 and "--pages" in usage.stderr
    assert issuer.calls == []
    assert _log(log) == []


def test_terminal_scope_follows_the_confirmation_setting(tmp_path):
    from retainpdf_ai.config import Settings

    explicit = Settings(data_root=tmp_path / "data", agent_confirmation_mode="explicit")
    scope = terminal_translation_scope(explicit, JOB)
    assert scope.job_id == JOB and scope.effects_allowed is False
    green = Settings(data_root=tmp_path / "data", agent_confirmation_mode="green_light")
    assert terminal_translation_scope(green, JOB).effects_allowed is True


# ------------------------------------------------------------------ 打开终端


def _settings(tmp_path: Path, **overrides):
    from retainpdf_ai.config import Settings

    return Settings(
        fx_state_root=tmp_path / "fx",
        data_root=tmp_path / "data",
        fx_command="/bin/cat",
        **overrides,
    )


def _job(tmp_path: Path) -> Path:
    job_dir = tmp_path / "data" / "jobs" / JOB
    (job_dir / "translated").mkdir(parents=True)
    return job_dir


def test_opening_a_book_terminal_installs_the_skill_and_the_cli(tmp_path):
    job_dir = _job(tmp_path)
    cli = _fake_cli(tmp_path / "real-cli", tmp_path / "cli.log")
    launch = build_terminal_launch(
        _settings(tmp_path, agent_cli_command=str(cli)),
        session_key=JOB,
        argv=("/bin/true",),
        rust=FakeIssuer(),
    )
    try:
        workspace = job_dir / "ai"
        assert launch.cwd == workspace
        skill = workspace / ".agents" / "skills" / "refine-translation" / "SKILL.md"
        assert skill.read_text(encoding="utf-8") == REFINE_TRANSLATION_SKILL
        bin_dir = launch.env["PATH"].split(":")[0]
        assert (Path(bin_dir) / "retainpdf-agent").is_file()
        agents = (workspace / "AGENTS.md").read_text(encoding="utf-8")
        assert "retainpdf-agent translation" in agents
        assert "refine-translation" in agents
        assert launch.cleanup is not None
    finally:
        if launch.cleanup is not None:
            launch.cleanup()
    assert not Path(bin_dir).exists(), "关终端要把 broker 一起收掉"


def test_without_the_real_cli_the_terminal_opens_without_the_skill(tmp_path):
    job_dir = _job(tmp_path)
    workspace = job_dir / "ai"
    workspace.mkdir()
    write_refine_translation_skill(workspace)  # 上一次留下的
    launch = build_terminal_launch(
        _settings(tmp_path, agent_cli_command=str(tmp_path / "missing-cli")),
        session_key=JOB,
        argv=("/bin/true",),
        rust=FakeIssuer(),
    )
    assert launch.cwd == workspace
    assert not (workspace / ".agents" / "skills" / "refine-translation" / "SKILL.md").exists()
    agents = (workspace / "AGENTS.md").read_text(encoding="utf-8")
    assert "retainpdf-agent translation" not in agents
    assert launch.cleanup is None


def test_skill_writer_refuses_symlinked_directories(tmp_path):
    workspace = tmp_path / "ai"
    workspace.mkdir()
    (tmp_path / "elsewhere").mkdir()
    (workspace / ".agents").symlink_to(tmp_path / "elsewhere")
    with pytest.raises(RuntimeError):
        write_refine_translation_skill(workspace)
    with pytest.raises(RuntimeError):
        remove_refine_translation_skill(workspace)


# ------------------------------------------------------------------ SKILL.md 内容


def test_skill_frontmatter_is_what_fx_expects():
    match = re.match(r"^---\n(.*?)\n---\n", REFINE_TRANSLATION_SKILL, re.S)
    assert match, "SKILL.md 必须以 YAML frontmatter 开头"
    header = match.group(1)
    fields = dict(line.split(": ", 1) for line in header.splitlines())
    assert set(fields) == {"name", "description"}
    assert fields["name"] == "refine-translation"
    # fx 对 frontmatter 有字节上限；description 只写「什么时候用」。
    assert len(header.encode("utf-8")) < 1024
    for trigger in ("这段太生硬", "精翻第 3 页", "全书把 X 统一成 Y"):
        assert trigger in fields["description"]


def test_skill_states_the_workflow_and_hard_rules():
    text = REFINE_TRANSLATION_SKILL
    order = [text.index(marker) for marker in ("translation issues", "translation show", "等用户确认", "translation revise", "translation rerender")]
    assert order == sorted(order), "流程顺序必须是 issues/show → 确认 → revise → rerender"
    for rule in ("占位符和公式逐字保留", "不整段重写", "不擅自扩写"):
        assert rule in text
    assert "<f1-e32/>" in text and "[[FORMULA_1]]" in text
    assert "../" in text and "只读" in text


def _skill_commands() -> list[str]:
    return [
        line.strip()
        for line in REFINE_TRANSLATION_SKILL.splitlines()
        if line.startswith("    ") and line.strip().startswith(("retainpdf-agent", "jq ", "ls "))
    ]


def test_skill_examples_are_single_commands():
    commands = _skill_commands()
    assert len(commands) >= 8
    for command in commands:
        outside_quotes = re.sub(r"'[^']*'|\"[^\"]*\"", "", command)
        assert "|" not in outside_quotes.replace("critical|major|minor", ""), command
        assert "&&" not in outside_quotes and ";" not in outside_quotes, command


def test_every_concrete_skill_example_parses():
    scope = BrokerScope(
        conversation_id="",
        document_id="",
        request_message_id="",
        intent_summary="",
        job_id=JOB,
        green_light=True,
    )
    concrete = [
        command
        for command in _skill_commands()
        if command.startswith("retainpdf-agent") and "<" not in command and "[" not in command
    ]
    assert len(concrete) >= 6
    for command in concrete:
        parse_broker_command(command, scope)
        shlex.split(command)


# ------------------------------------------------------------------ AGENTS.md


def test_agents_md_maps_the_new_artifacts(tmp_path):
    text = build_job_workspace_instructions(tmp_path / JOB)
    for path in (
        "../artifacts/translation_qa.v1.json",
        "../artifacts/refine_report.v1.json",
        "../artifacts/fit_report.v1.json",
        "../translated/revisions.v1.jsonl",
    ):
        assert path in text, f"数据地图里没有 {path}"
    for field in (
        "violations[]",
        "by_severity",
        "page_number",
        "emergency_tier",
        "overflow",
        "findings[]",
        "target_span",
        "reject_reason",
        "previous_text",
        "revision_id",
    ):
        assert field in text, f"数据地图里没写 {field}"


def test_agents_md_routes_translation_edits_through_the_cli(tmp_path):
    with_cli = build_job_workspace_instructions(tmp_path / JOB, translation_cli=True)
    assert "## 改译文：`retainpdf-agent translation`" in with_cli
    assert "改译文一律走 `retainpdf-agent translation`" in with_cli
    assert "`../` 只读" in with_cli
    assert ".agents/skills/refine-translation/SKILL.md" in with_cli
    without = build_job_workspace_instructions(tmp_path / JOB)
    assert "retainpdf-agent" not in without
    assert "`../` 只读" in without


def test_merged_books_do_not_advertise_the_cli(tmp_path):
    document_dir = tmp_path / "documents" / "doc-1"
    merged_root = document_dir / "merged" / "abc"
    merged_root.mkdir(parents=True)
    text = build_merged_workspace_instructions(document_dir / "ai", merged_root)
    assert "retainpdf-agent" not in text


def test_skill_revise_examples_single_quote_the_text():
    """双引号里的 $k$ 会被 shell 展开，公式直接丢掉。"""
    revise = [c for c in _skill_commands() if c.startswith("retainpdf-agent translation revise")]
    assert revise
    for command in revise:
        assert "--text '" in command, command
