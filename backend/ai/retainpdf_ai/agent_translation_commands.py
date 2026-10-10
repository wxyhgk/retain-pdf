"""`retainpdf-agent translation ...` 的语法：终端 agent 精修译文用的那组命令。

和 operation 那组一样，这里只做**解析和校验**，不碰网络：结果是一个
BrokerCommand，真正的请求由宿主 broker 拿着单动作 capability 去跑。

    retainpdf-agent translation issues [--pages 3-5] [--severity major] [--limit 50]
    retainpdf-agent translation show --item-id p003-b004
    retainpdf-agent translation revise --item-id p003-b004 --text "…" --reason "…"
    retainpdf-agent translation refine [--pages 3-5] [--review-only]
    retainpdf-agent translation rerender
    retainpdf-agent translation term-set --source "spring constant" --target "劲度系数"

有副作用的四条（revise / refine / rerender / term-set）要求 `scope.effects_allowed`，
和 operation run/commit 是同一道闸。
"""

from __future__ import annotations

import re
from typing import Any

from .agent_broker_contracts import BrokerCommand, BrokerScope, BrokerUsageError

#: 有副作用的子命令。名字也是 BrokerCommand.action 的后缀。
TRANSLATION_EFFECT_SUBCOMMANDS = frozenset({"revise", "refine", "rerender", "term-set"})
TRANSLATION_READ_SUBCOMMANDS = frozenset({"issues", "show", "data"})
TRANSLATION_SUBCOMMANDS = TRANSLATION_READ_SUBCOMMANDS | TRANSLATION_EFFECT_SUBCOMMANDS

SEVERITY_RANK = {"critical": 0, "major": 1, "minor": 2}

_SAFE_ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$")
_DATASET = re.compile(r"^[a-z0-9_]{1,64}$")
_PAGES = re.compile(r"^(\d{1,5})(?:-(\d{1,5}))?$")
_MAX_TEXT_CHARS = 20000  # 与 ReviseTranslationItemRequest.translated_text 的上限一致
_MAX_REASON_CHARS = 2000
_MAX_TERM_CHARS = 200
_DEFAULT_ISSUE_LIMIT = 50
_MAX_ISSUE_LIMIT = 500

# 每个子命令接受的旗标：True = 带值，False = 布尔开关。
_FLAGS: dict[str, dict[str, bool]] = {
    "issues": {"--pages": True, "--severity": True, "--limit": True},
    "show": {"--item-id": True},
    # 通用取数：不带 --dataset 列出有哪些数据集；--query 是 `字段=值&…`（逗号为「或」，另有
    # fields / group_by / sort / offset / limit），后端按登记表校验字段。
    "data": {"--dataset": True, "--query": True},
    "revise": {"--item-id": True, "--text": True, "--reason": True},
    "refine": {"--pages": True, "--review-only": False},
    "rerender": {},
    "term-set": {"--source": True, "--target": True},
}
_REQUIRED: dict[str, frozenset[str]] = {
    "show": frozenset({"--item-id"}),
    "revise": frozenset({"--item-id", "--text", "--reason"}),
    "term-set": frozenset({"--source", "--target"}),
}

USAGE = (
    "用法：\n"
    "  retainpdf-agent translation issues [--pages 3-5] [--severity critical|major|minor] [--limit 50]\n"
    "  retainpdf-agent translation show --item-id <块 id>\n"
    "  retainpdf-agent translation data [--dataset <名字> [--query \"字段=值&group_by=字段&sort=-字段&limit=50\"]]\n"
    '  retainpdf-agent translation revise --item-id <块 id> --text "<新译文>" --reason "<为什么改>"\n'
    "  retainpdf-agent translation refine [--pages 3-5] [--review-only]\n"
    "  retainpdf-agent translation rerender\n"
    '  retainpdf-agent translation term-set --source "<原文术语>" --target "<译法>"'
)

CONFIRMATION_REQUIRED_MESSAGE = (
    "这条命令会改动译文/术语表或重跑任务，需要用户授权，当前没有授权，命令没有执行。"
    "先把改动方案给用户看；要在终端里直接执行，请用户到「设置 → AI Agent」把确认方式改成"
    "「绿灯」（green_light）后重开终端。只读命令（issues、show）不受影响。"
)


def parse_translation_argv(argv: tuple[str, ...], scope: BrokerScope) -> BrokerCommand:
    """解析 `retainpdf-agent translation <子命令> ...`。

    错误一律抛 BrokerUsageError：消息会原样回给 agent，所以写成它能照着改的样子。
    """
    if len(argv) < 2 or argv[0] != "retainpdf-agent" or argv[1] != "translation":
        raise ValueError("not a translation command")
    job_id = scope.job_id.strip()
    if not job_id or not _SAFE_ID.fullmatch(job_id) or ".." in job_id:
        raise BrokerUsageError(
            "translation 命令只能在单本书的工作区里用：当前会话没有对应的翻译任务。"
        )
    if len(argv) < 3 or argv[2] not in TRANSLATION_SUBCOMMANDS:
        raise BrokerUsageError(f"未知的 translation 子命令。\n{USAGE}")
    sub = argv[2]
    flags = _parse_flags(sub, argv[3:])
    if sub in TRANSLATION_EFFECT_SUBCOMMANDS and not scope.effects_allowed:
        raise BrokerUsageError(CONFIRMATION_REQUIRED_MESSAGE)
    params: dict[str, Any] = {"job_id": job_id}
    if sub == "issues":
        params["pages"] = _pages(flags.get("--pages"))
        severity = flags.get("--severity")
        if severity is not None and severity not in SEVERITY_RANK:
            raise BrokerUsageError("--severity 只能是 critical、major 或 minor。")
        params["min_severity"] = severity
        params["limit"] = _limit(flags.get("--limit"))
    elif sub == "show":
        params["item_id"] = _item_id(flags["--item-id"])
    elif sub == "data":
        dataset = flags.get("--dataset")
        if dataset is not None and not _DATASET.fullmatch(dataset):
            raise BrokerUsageError("--dataset 是数据集名字，例如 revisions、qa_violations；先不带 --dataset 看有哪些。")
        query = flags.get("--query")
        if query is not None and dataset is None:
            raise BrokerUsageError("--query 要和 --dataset 一起用。")
        if query is not None and (len(query) > 2000 or any(ord(ch) < 32 for ch in query)):
            raise BrokerUsageError("--query 太长或含控制字符。")
        params["dataset"] = dataset
        params["query"] = query
    elif sub == "revise":
        params["item_id"] = _item_id(flags["--item-id"])
        text = flags["--text"]
        if not text.strip():
            raise BrokerUsageError("--text 不能为空。")
        if len(text) > _MAX_TEXT_CHARS:
            raise BrokerUsageError(f"--text 超过 {_MAX_TEXT_CHARS} 字。")
        reason = flags["--reason"].strip()
        if not reason:
            raise BrokerUsageError("--reason 不能为空：写清楚为什么改，修订历史里要留痕。")
        if len(reason) > _MAX_REASON_CHARS:
            raise BrokerUsageError(f"--reason 超过 {_MAX_REASON_CHARS} 字。")
        params["text"] = text
        params["reason"] = reason
    elif sub == "refine":
        params["pages"] = _pages(flags.get("--pages"))
        params["review_only"] = "--review-only" in flags
    elif sub == "term-set":
        source = flags["--source"].strip()
        target = flags["--target"].strip()
        if not source or not target:
            raise BrokerUsageError("--source 和 --target 都不能为空。")
        if len(source) > _MAX_TERM_CHARS or len(target) > _MAX_TERM_CHARS:
            raise BrokerUsageError(f"术语和译法都不能超过 {_MAX_TERM_CHARS} 字。")
        params["source"] = source
        params["target"] = target
    return BrokerCommand(
        public_argv=argv,
        action=f"translation.{sub}",
        cli_argv=(),
        request_payload=params,
    )


def _parse_flags(sub: str, args: tuple[str, ...]) -> dict[str, str]:
    allowed = _FLAGS[sub]
    flags: dict[str, str] = {}
    index = 0
    while index < len(args):
        name = args[index]
        if name not in allowed:
            raise BrokerUsageError(f"{sub} 不认识参数 {name!r}。\n{USAGE}")
        if name in flags:
            raise BrokerUsageError(f"参数 {name} 重复了。")
        if allowed[name]:
            if index + 1 >= len(args):
                raise BrokerUsageError(f"参数 {name} 缺少取值。")
            flags[name] = args[index + 1]
            index += 2
        else:
            flags[name] = ""
            index += 1
    missing = sorted(_REQUIRED.get(sub, frozenset()) - set(flags))
    if missing:
        raise BrokerUsageError(f"{sub} 缺少参数：{'、'.join(missing)}。\n{USAGE}")
    return flags


def _pages(raw: str | None) -> tuple[int, int] | None:
    if raw is None:
        return None
    match = _PAGES.fullmatch(raw.strip())
    if not match:
        raise BrokerUsageError("--pages 写成 3 或 3-5（从 1 开始的页码，闭区间）。")
    start = int(match.group(1))
    end = int(match.group(2) or start)
    if start < 1 or end < start:
        raise BrokerUsageError("--pages 的页码从 1 开始，且结束页不能小于起始页。")
    return start, end


def _limit(raw: str | None) -> int:
    if raw is None:
        return _DEFAULT_ISSUE_LIMIT
    if not raw.isdigit() or not 1 <= int(raw) <= _MAX_ISSUE_LIMIT:
        raise BrokerUsageError(f"--limit 是 1 到 {_MAX_ISSUE_LIMIT} 之间的整数。")
    return int(raw)


def _item_id(raw: str) -> str:
    value = raw.strip()
    if not _SAFE_ID.fullmatch(value) or ".." in value:
        raise BrokerUsageError("--item-id 形如 p003-b004（来自 issues 或译文文件里的 item_id）。")
    return value


__all__ = [
    "CONFIRMATION_REQUIRED_MESSAGE",
    "SEVERITY_RANK",
    "TRANSLATION_EFFECT_SUBCOMMANDS",
    "TRANSLATION_SUBCOMMANDS",
    "USAGE",
    "parse_translation_argv",
]
