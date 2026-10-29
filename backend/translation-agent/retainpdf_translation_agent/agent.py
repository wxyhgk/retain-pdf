"""翻译 agent：一次送一整页，模型通过一个固定格式的工具调用逐块交回译文；也能按重排 agent 的改稿要求改写某几块。

调用直接走 Anthropic Messages 接口（密钥从环境变量 `ANTHROPIC_API_KEY` 读，模型 `ANTHROPIC_MODEL`）。
每个请求连同回答缓存在 `cache_dir`，同样的输入再跑不重复花钱，结果可复现。测试用 `transport` 注入假模型。
输入输出的格式见 `contract.py`。
"""

from __future__ import annotations

import hashlib
import json
import os
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

from retainpdf_translation_agent.checks import check_block
from retainpdf_translation_agent.checks import check_group
from retainpdf_translation_agent.checks import status_of
from retainpdf_translation_agent.checks import visible_length
from retainpdf_translation_agent.contract import BlockResult
from retainpdf_translation_agent.contract import PageInput
from retainpdf_translation_agent.contract import RevisionRequest

API_URL = "https://api.anthropic.com/v1/messages"
# 接续组合成一条送给模型，原文里用它标出原来在哪里断开；译文里要在对应位置放同样数量
BREAK = "[[BREAK]]"
DEFAULT_MODEL = "claude-haiku-5-5"
PROMPT_VERSION = "translation-agent-6"

SYSTEM_PROMPT = """你是学术文档的翻译 agent，把英文 PDF 翻成简体中文，译文会放回原文每个块的位置显示。
你会收到一整页的全部块（JSON），每块有类别（class）、大概位置（where）、原文（text）、要不要翻（translate）。
像人一样先通读整页，弄清每块在版面上的作用和上下文，再逐块翻译。

规则：
1. 只翻 translate=true 的块；translate=false 的块（页眉页脚、参考文献、公式、已经是中文的段落……）只是上下文，不要交回。
2. 每个要翻的块交回且只交回一条，id 原样照抄，不要合并、拆分或增删块。
   请求里的 required_ids 列出了这一页必须交回的全部 id，交卷前逐个核对，一个都不能少（图注、短标题最容易漏）。
3. `$…$` 里的公式一个字符都不改，原样放在译文对应位置；`{{fn:1}}` 这类脚注标记、`[1, 2]` 这类引用标记原样保留。
4. 数字、章节编号（如 2.1）、变量名、代码、URL、DOI 原样保留。
5. 被分栏或分页拆开的同一段话已经合成一条记录（有 members 字段），原文里用 [[BREAK]] 标出原来在哪里断开。
   把整段翻通顺，并在译文里**放同样数量的 [[BREAK]]**，放在和原文断点意思对应的位置（可以在句子中间）。
   不要删掉或多加 [[BREAK]]，[[BREAK]] 前后的内容不要重复。
6. 按类别把握语气：标题简洁；图注、表题保留"图 1""表 1"这样的编号；目录条目只翻标题，编号和页码不动；
   列表项保留 (1) 这类序号；作者、机构一般不在要翻的块里。
7. 术语前后一致；专有名词（软件名、数据集名、人名）不翻。
8. 译文要通顺、简练，长度和原文相当，不要加解释、注释或括号里的原文。
9. 请求里有 revise 时（排版发现放不下等），只改 revise 列出的块，其余块只是上下文，不要交回。
   在 current_translation 的基础上改写：current_chars 是现在的字数，max_chars 是**硬上限**，must_cut 是至少要删掉的字数
   （字数按显示算：`{{fn:1}}` 算 1 个字，公式按一半算）。
   先精简措辞（去掉可有可无的字、换更短的说法）；还超就删掉次要的修饰语和举例；核心意思、公式、标记、编号必须保留。
   交卷前数一下字数，一定不能超过 max_chars。
"""

TOOL = {
    "name": "submit_translations",
    "description": "提交这一页所有 translate=true 的块的译文。",
    "input_schema": {
        "type": "object",
        "properties": {
            "translations": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "id": {"type": "string", "description": "块的 id，原样照抄"},
                        "translation": {"type": "string", "description": "这一块的中文译文"},
                    },
                    "required": ["id", "translation"],
                },
            },
            "notes": {"type": "string", "description": "可选：这一页翻译时拿不准的地方"},
        },
        "required": ["translations"],
    },
}

Transport = Callable[[dict], dict]


@dataclass
class Usage:
    requests: int = 0
    cached: int = 0
    input_tokens: int = 0
    output_tokens: int = 0
    latency_ms: int = 0

    def add(self, response: dict, latency_ms: int, cached: bool) -> None:
        self.requests += 1
        self.cached += int(cached)
        usage = response.get("usage") or {}
        self.input_tokens += int(usage.get("input_tokens") or 0) + int(usage.get("cache_read_input_tokens") or 0)
        self.output_tokens += int(usage.get("output_tokens") or 0)
        self.latency_ms += latency_ms


def http_transport(body: dict) -> dict:
    """用标准库发请求（开发工具不给流水线添依赖）；429、5xx 和网络错误退避重试。"""
    import urllib.error
    import urllib.request

    key = os.environ.get("ANTHROPIC_API_KEY")
    if not key:
        raise RuntimeError("ANTHROPIC_API_KEY is not set (load ~/.config/retainpdf/test.env)")
    headers = {"x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json"}
    data = json.dumps(body, ensure_ascii=False).encode("utf-8")
    last_error: Exception | None = None
    for attempt in range(4):
        request = urllib.request.Request(API_URL, data=data, headers=headers, method="POST")
        try:
            with urllib.request.urlopen(request, timeout=300) as response:
                return json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as error:
            if error.code not in {429, 500, 502, 503, 529}:
                raise RuntimeError(f"model API HTTP {error.code}: {error.read()[:300]!r}") from None
            last_error = RuntimeError(f"model API HTTP {error.code}")
        except (urllib.error.URLError, TimeoutError) as error:
            last_error = error
        time.sleep(2.0 * (attempt + 1))
    raise RuntimeError(f"model API failed after retries: {last_error}")


class TranslationAgent:
    def __init__(self, *, model: str | None = None, transport: Transport | None = None, cache_dir: Path | None = None, use_cache: bool = True):
        self.model = model or os.environ.get("ANTHROPIC_MODEL") or DEFAULT_MODEL
        self.transport = transport or http_transport
        self.cache_dir = cache_dir
        self.use_cache = use_cache
        self.usage = Usage()
        self.calls: list[dict] = []

    # ---- 请求 ----
    def _body(self, payload: dict) -> dict:
        return {
            "model": self.model,
            "max_tokens": 16000,
            "system": SYSTEM_PROMPT,
            "tools": [TOOL],
            "tool_choice": {"type": "tool", "name": TOOL["name"]},
            "messages": [{"role": "user", "content": json.dumps(payload, ensure_ascii=False, indent=1)}],
        }

    def _call(self, body: dict, *, label: str) -> dict:
        key = hashlib.sha256(json.dumps(body, ensure_ascii=False, sort_keys=True).encode("utf-8")).hexdigest()[:24]
        path = self.cache_dir / f"{key}.json" if self.cache_dir else None
        if self.use_cache and path and path.exists():
            cached = json.loads(path.read_text(encoding="utf-8"))
            self.usage.add(cached["response"], 0, True)
            self.calls.append({"label": label, "key": key, "cached": True, "latency_ms": cached.get("latency_ms", 0), "usage": cached["response"].get("usage")})
            return cached["response"]
        start = time.monotonic()
        response = self.transport(body)
        latency = int((time.monotonic() - start) * 1000)
        self.usage.add(response, latency, False)
        self.calls.append({"label": label, "key": key, "cached": False, "latency_ms": latency, "usage": response.get("usage")})
        if path:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(json.dumps({"request": body, "response": response, "latency_ms": latency}, ensure_ascii=False, indent=1), encoding="utf-8")
        return response

    @staticmethod
    def _parse(response: dict) -> tuple[dict[str, str], str, list[str]]:
        """取出工具调用里的译文；同一个 id 交了多次的记下来。"""
        for part in response.get("content") or []:
            if part.get("type") == "tool_use" and part.get("name") == TOOL["name"]:
                data = part.get("input") or {}
                out: dict[str, str] = {}
                duplicates: list[str] = []
                for item in data.get("translations") or []:
                    block_id = str(item.get("id", ""))
                    if block_id in out:
                        duplicates.append(block_id)
                    out[block_id] = str(item.get("translation", ""))
                return out, str(data.get("notes") or ""), duplicates
        raise ValueError("model response has no submit_translations tool call")

    # ---- 一页 ----
    def translate_page(self, page: PageInput) -> tuple[dict[str, BlockResult], dict]:
        document = page.document
        wanted = {b.id for b in page.to_translate()}
        records = request_records(page.blocks, wanted)
        payload = {
            "document": document,
            "page": page.page_label,
            "section_path": page.section_path,
            "blocks": records,
            "required_ids": [r["id"] for r in records if r["translate"]],
        }
        response = self._call(self._body(payload), label=f"page {page.page_label}")
        raw, notes, duplicates = self._parse(response)
        per_block, split_issues = expand_translations(raw, page.blocks, wanted)
        record_ids = {r["id"] for r in records if r["translate"]}
        extra = sorted(set(raw) - record_ids)
        results: dict[str, BlockResult] = {}
        for block in page.to_translate():
            issues = check_block(block.text, per_block.get(block.id)) + split_issues.get(block.id, [])
            if block.id in duplicates:
                issues.append({"code": "duplicate", "severity": "warn", "message": "同一块交了不止一次，取最后一条"})
            results[block.id] = BlockResult(block.id, per_block.get(block.id), issues, 1, status_of(issues))
        self._apply_group_checks(page.to_translate(), results)
        # 不合格的：单块的合成一次请求一起重翻，接续组各自整组重翻
        failed = [b for b in page.to_translate() if results[b.id].status == "error"]
        singles = [b for b in failed if not b.group]
        groups: dict[str, list] = {}
        for block in failed:
            if block.group:
                groups[block.group["id"]] = self._unit_of(page, block)
        for unit in ([singles] if singles else []) + list(groups.values()):
            results.update(self._retry_unit(page, unit, results, document=document))
        return results, {"notes": notes, "extra_ids": extra, "duplicates": duplicates}

    @staticmethod
    def _unit_of(page: PageInput, block) -> list:
        """重翻的单位：接续组整组一起，其余一块。"""
        if not block.group:
            return [block]
        return [b for b in page.to_translate() if b.group and b.group["id"] == block.group["id"]]

    @staticmethod
    def _apply_group_checks(blocks: list, results: dict) -> None:
        groups: dict[str, list] = {}
        for block in blocks:
            if block.group and block.id in results:
                groups.setdefault(block.group["id"], []).append(block)
        for members in groups.values():
            members.sort(key=lambda b: b.group["index"])
            extra = check_group([(b.id, b.text, results[b.id].translation) for b in members])
            for block_id, issues in extra.items():
                if issues:
                    results[block_id].issues = results[block_id].issues + issues
                    results[block_id].status = status_of(results[block_id].issues)

    # ---- 按重排 agent 的要求改稿 ----
    def revise(self, page: PageInput, requests: list[RevisionRequest]) -> dict[str, BlockResult]:
        """只改 `requests` 列出的块（同一页的其它块作上下文）。改完还不合格（含超出 max_chars）就再改一次。"""
        by_id = {b.id: b for b in page.blocks}
        unknown = [r.id for r in requests if r.id not in by_id or not by_id[r.id].translate]
        if unknown:
            raise ValueError(f"revision requested for blocks that are not translated on this page: {unknown}")
        results: dict[str, BlockResult] = {}
        pending = list(requests)
        previous: dict[str, list[dict]] = {r.id: [{"translation": r.current_translation, "issues": [_revision_issue(r)]}] for r in requests}
        for attempt in (1, 2):
            if not pending:
                break
            ids = {r.id for r in pending}
            payload = {
                "document": page.document,
                "page": page.page_label,
                "section_path": page.section_path,
                "revise": [
                    _revision_record(r, results.get(r.id))
                    for r in pending
                ],
                "blocks": request_records(page.blocks, ids),
                "required_ids": sorted(ids),
            }
            response = self._call(self._body(payload), label="revise " + ",".join(sorted(ids)))
            try:
                raw, _, _ = self._parse(response)
            except ValueError:
                raw = {}
            per_block, _ = expand_translations(raw, page.blocks, ids)
            next_round: list[RevisionRequest] = []
            for request in pending:
                text = per_block.get(request.id)
                issues = check_block(by_id[request.id].text, text)
                if request.max_chars and text is not None and visible_length(text) >= request.max_chars * 0.4:
                    # 缩短是我们要的：和原文比"太短"不算错，只要别短得离谱（不到要求字数的 40%）
                    issues = [i for i in issues if i["code"] != "too_short"]
                if text is not None and request.max_chars and visible_length(text) > request.max_chars:
                    issues.append(
                        {
                            "code": "still_too_long",
                            "severity": "error",
                            "message": f"改完 {visible_length(text)} 字，要求不超过 {request.max_chars} 字",
                        }
                    )
                history = previous[request.id] + ([results[request.id].to_dict()] if request.id in results else [])
                results[request.id] = BlockResult(request.id, text, issues, attempt, status_of(issues), history)
                if results[request.id].status == "error":
                    next_round.append(request)
            pending = next_round
        return results

    def _retry_unit(self, page: PageInput, unit: list, results: dict, *, document: dict) -> dict[str, BlockResult]:
        """不合格的块（接续组就整组）重翻一次：同一页其它块作为上下文，并告诉模型上次哪里不对。"""
        ids = {b.id for b in unit}
        records = request_records(page.blocks, ids)
        retry: list[dict] = []
        if unit[0].group and len(unit) > 1:
            retry.append(
                {
                    "id": unit[0].group["id"],
                    "previous_translation": BREAK.join(results[b.id].translation or "" for b in unit),
                    "problems": sorted({i["message"] for b in unit for i in results[b.id].issues}),
                }
            )
        else:
            for b in unit:
                retry.append({"id": b.id, "previous_translation": results[b.id].translation, "problems": [i["message"] for i in results[b.id].issues]})
        payload = {
            "document": document,
            "page": page.page_label,
            "section_path": page.section_path,
            "retry": retry,
            "blocks": records,
            "required_ids": [r["id"] for r in retry],
        }
        response = self._call(self._body(payload), label="retry " + ",".join(r["id"] for r in retry))
        try:
            raw, _, _ = self._parse(response)
        except ValueError:
            raw = {}
        per_block, split_issues = expand_translations(raw, page.blocks, ids)
        fixed: dict[str, BlockResult] = {}
        for block in unit:
            first = results[block.id]
            issues = check_block(block.text, per_block.get(block.id)) + split_issues.get(block.id, [])
            history = first.history + [{"translation": first.translation, "issues": first.issues}]
            fixed[block.id] = BlockResult(block.id, per_block.get(block.id), issues, first.attempts + 1, status_of(issues), history)
        self._apply_group_checks(unit, fixed)
        return fixed


def _group_members(blocks: list, block, wanted: set[str]) -> list:
    return sorted(
        (m for m in blocks if m.group and m.group["id"] == block.group["id"] and m.id in wanted),
        key=lambda m: m.group["index"],
    )


def request_records(blocks: list, wanted: set[str]) -> list[dict]:
    """一页的请求记录：要翻的接续组合成一条（原文用 BREAK 连起来，放在组头的位置），不在 wanted 里的只作上下文。"""
    records: list[dict] = []
    emitted: set[str] = set()
    for block in blocks:
        if block.group and block.id in wanted:
            group_id = block.group["id"]
            if group_id in emitted:
                continue
            emitted.add(group_id)
            members = _group_members(blocks, block, wanted)
            if len(members) > 1:
                record = members[0].request_record()
                record.pop("group", None)
                record.update(
                    id=group_id,
                    where=" → ".join(m.where for m in members),
                    text=f" {BREAK} ".join(m.text for m in members),
                    members=[m.id for m in members],
                )
                records.append(record)
                continue
        record = block.request_record()
        if block.id not in wanted:
            record["translate"] = False
        records.append(record)
    return records


def expand_translations(raw: dict[str, str], blocks: list, wanted: set[str]) -> tuple[dict[str, str], dict[str, list[dict]]]:
    """把模型交回的（块 id 或接续组 id → 译文）拆回各块；组的 BREAK 数量不对就整组记不合格。"""
    per_block: dict[str, str] = {}
    issues: dict[str, list[dict]] = {}
    seen: set[str] = set()
    for block in blocks:
        if block.id not in wanted:
            continue
        if not block.group:
            if block.id in raw:
                per_block[block.id] = raw[block.id]
            continue
        group_id = block.group["id"]
        if group_id in seen:
            continue
        seen.add(group_id)
        members = _group_members(blocks, block, wanted)
        if len(members) == 1:
            text = raw.get(group_id, raw.get(block.id))
            if text is not None:
                per_block[block.id] = text.replace(BREAK, "")
            continue
        text = raw.get(group_id)
        if text is None:
            continue
        parts = text.split(BREAK)
        if len(parts) != len(members):
            message = f"接续组的断点标记应有 {len(members) - 1} 个，交回了 {len(parts) - 1} 个"
            for member in members:
                issues.setdefault(member.id, []).append({"code": "group_break", "severity": "error", "message": message})
                per_block[member.id] = text
            continue
        for member, part in zip(members, parts):
            per_block[member.id] = part.strip()
    return per_block, issues


def _revision_record(request: RevisionRequest, previous: BlockResult | None) -> dict:
    """改稿请求里的一块：替模型算好现在多少字、至少要删多少（模型自己数字数不准）。"""
    current = (previous.translation if previous and previous.translation else None) or request.current_translation
    chars = visible_length(current)
    record = {"id": request.id, "current_translation": current, "current_chars": chars, "reason": request.reason, "note": request.note}
    if request.max_chars:
        record.update(max_chars=request.max_chars, must_cut=max(0, chars - request.max_chars))
    if previous:
        record["problems"] = [i["message"] for i in previous.issues]
    return record


def _revision_issue(request: RevisionRequest) -> dict:
    target = f"，要求不超过 {request.max_chars} 字" if request.max_chars else ""
    return {"code": f"revision_{request.reason}", "severity": "info", "message": f"重排要求改稿：{request.reason}{target}"}
