"""翻译 agent：一次送一整页，模型通过一个固定格式的工具调用逐块交回译文；也能按重排 agent 的改稿要求改写某几块。

调用直接走 Anthropic Messages 接口（密钥从环境变量 `ANTHROPIC_API_KEY` 读，模型 `ANTHROPIC_MODEL`）。
每个请求连同回答缓存在 `cache_dir`，同样的输入再跑不重复花钱，结果可复现。测试用 `transport` 注入假模型。
输入输出的格式见 `contract.py`；整篇按页顺序翻、带术语记忆和上下文包的调度在 `runner.py`。
"""

from __future__ import annotations

import hashlib
import json
import os
import random
import re
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

from retainpdf_translation_agent.breaks import move_leading_punctuation
from retainpdf_translation_agent.breaks import split_by_ratio
from retainpdf_translation_agent.checks import check_block
from retainpdf_translation_agent.checks import check_group
from retainpdf_translation_agent.checks import check_terms
from retainpdf_translation_agent.checks import status_of
from retainpdf_translation_agent.checks import style_signals
from retainpdf_translation_agent.checks import visible_length
from retainpdf_translation_agent.context import context_terms
from retainpdf_translation_agent.contract import CONTRACT_VERSION
from retainpdf_translation_agent.contract import STATUS_ERROR
from retainpdf_translation_agent.contract import STATUS_FALLBACK_SOURCE
from retainpdf_translation_agent.contract import STATUS_OK
from retainpdf_translation_agent.contract import BlockResult
from retainpdf_translation_agent.contract import PageInput
from retainpdf_translation_agent.contract import RevisionRequest
from retainpdf_translation_agent.memory import find_terms

API_URL = "https://api.anthropic.com/v1/messages"
# 接续组合成一条送给模型，原文里用它标出原来在哪里断开；译文里要在对应位置放同样数量
BREAK = "[[BREAK]]"
DEFAULT_MODEL = "claude-haiku-5-5"
PROMPT_VERSION = "translation-agent-11"
# 角色：现在有译者（初译、重翻）和修订（按改稿要求改写）；没在 `models` 里指定的角色用默认模型
ROLE_TRANSLATOR = "translator"
ROLE_REVISER = "reviser"
ROLE_READER = "reader"  # 翻译前通读（reader.py）
ROLE_REVIEWER = "reviewer"  # 审校（review.py）

SYSTEM_PROMPT = """你是学术文档的翻译 agent，把英文 PDF 翻成简体中文，译文会放回原文每个块的位置显示。
你会收到一整页的全部块（JSON），每块有类别（class）、大概位置（where）、原文（text）、要不要翻（translate）。
像人一样先通读整页，弄清每块在版面上的作用和上下文，再逐块翻译。

规则：
1. 只翻 translate=true 的块；translate=false 的块（页眉页脚、关键词、参考文献、行间公式、代码块、算法块、已经是中文的段落……）只是上下文，不要交回。
2. 每个要翻的块交回且只交回一条，id 原样照抄，不要合并、拆分或增删块。
   请求里的 required_ids 列出了这一页必须交回的全部 id，交卷前逐个核对，一个都不能少（图注、短标题最容易漏）。
3. `$…$` 里的公式一个字符都不改，原样放在译文对应位置；`{{fn:1}}` 这类脚注标记、`[1, 2]` 这类引用标记原样保留；
   反引号包着的行内代码（命令、路径、参数名，如 `--json`）连同反引号原样保留。
4. 数字、章节编号（如 2.1）、变量名、代码、URL、DOI 原样保留。
5. 被分栏或分页拆开的同一段话已经合成一条记录（有 members 字段），原文里用 [[BREAK]] 标出原来在哪里断开。
   把整段翻通顺，并在译文里**放同样数量的 [[BREAK]]**，放在和原文断点意思对应的位置（可以在句子中间）。
   不要删掉或多加 [[BREAK]]，[[BREAK]] 前后的内容不要重复。
   中文语序和英文不同、断点没法放在完全对应的位置时，放在最接近的分句或词组边界，但一定要放。
6. 按类别把握语气：标题简洁；图注、表题保留"图 1""表 1"这样的编号；目录条目只翻标题，编号和页码不动；
   列表项保留 (1) 这类序号；作者、机构一般不在要翻的块里。有 translation 字段的块是已经定好的译文（标题、目录），只作参考，不要交回。
7. 术语前后一致。专名：context 的 names 给了中文译名的照用（first_use=true 时写"中文译名（原文）"），keep 里的原样保留；
   都没登记的：软件、数据集、期刊、机构名保留原文，人名按 style 里的人名规则（没有规则就保留原文）。
8. 译文要通顺、简练，长度和原文相当，不要加解释、注释或括号里的原文（第一次出现的缩写、人名按第 10 条括注原文）。
   贴着作者的写法和语气：作者用"we"就译"我们"；作者说得有保留（may、might、suggest、appear to）就保留这份保留，
   不要译得更肯定或更含糊；作者口语就口语、严谨就严谨，不要统一改成教科书腔，也不要自己加强调或删掉强调。
9. 请求里有 revise 时（排版发现放不下等），只改 revise 列出的块，其余块只是上下文，不要交回。
   在 current_translation 的基础上改写：current_chars 是现在的字数，max_chars 是**硬上限**，must_cut 是至少要删掉的字数
   （字数按显示算：`{{fn:1}}` 算 1 个字，公式按一半算）。
   只许精简措辞（去掉可有可无的虚字、换更短的同义说法、把句子改紧凑）；**意思一点都不能少**：修饰语、举例、限定词、
   表示保留的词（可能、或许）都不许删，公式、标记、编号必须保留，作者的语气不变。
   交卷前数一下字数，尽量不超过 max_chars；不删内容就做不到时，交回能做到的最短版本（程序会标出还超，交给排版缩字号或给人看）。
10. 请求里的 context 是这一页的上下文包，只用来帮你翻准，里面的东西都不要交回：
   - terms：术语表。status 是 approved 或 locked 的**必须照用**；candidate 是前面几页或别的章的译法，
     意思相同就沿用，意思不同（同一个词在这里是另一个意思）就按这里的意思译；有 scope 的只管那几章。
   - keep：要原样保留的专名（人名、机构、期刊、软件）。
   - abbreviations：缩写和全称。first_use=true 表示全书第一次用到，译成"中文全称（缩写）"；之后直接写缩写。
   - names：人名等专名的中文译名，必须照用；first_use=true 时写"中文译名（原文）"，之后只写中文译名。
   - previous / next：上一页结尾、下一页开头（previous 带已定的译文），用来接上文、对齐译法。
   - style：作者文风和编号格式；summary：本章摘要，只作参考，数字和术语以原文和术语表为准。
11. 交卷时在 terms 里报上这一页你定下的译法：专业术语（报原文和译法）、要保留原文的专名（category=keep）。
   只报真正的术语和专名，不报普通词、标题、书名、缩写；source 写词的原形（单数、不带括号里的缩写），target 只写译法本身；
   context 里已有、你也照用了的不用再报。
   context 给了译法、但这一处意思确实不同（同一个词在这里是另一个意思）而没照用的，在 term_exceptions 里写明块、原词、
   你用的译法和理由。没理由不要声明例外。
12. 中文体例：引用公式写"式 (3)"，子图写"图 3.1(a)"（Fig. 也译"图"）；pt / points 表示长度时译"磅"，percentage points 译"百分点"；
   "N times as much / as many" 译"是……的 N 倍"，不要写"多 N 倍"；suggest、indicate 译"提示、意味着"，不要加强成"表明、证明"；
   编号体例沿用原文并全文统一（原文 IV. 就写 IV.，不要一会儿"四"一会儿 IV.）；双关、俏皮话用中文里等效的说法，不加英文括注；
   称呼读者用"你"还是"您"按 style，没写就用"你"；不要在中文句子里夹没翻的英文单词。
"""

TOOL = {
    "name": "submit_translations",
    "description": "提交这一页所有 translate=true 的块的译文，以及这一页定下的术语。",
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
            "terms": {
                "type": "array",
                "description": "这一页定下的术语译法和要保留原文的专名",
                "items": {
                    "type": "object",
                    "properties": {
                        "block_id": {"type": "string", "description": "出现在哪一块"},
                        "source": {"type": "string", "description": "原文里的写法，照抄"},
                        "target": {"type": "string", "description": "译法；保留原文的专名照抄原文"},
                        "category": {"type": "string", "enum": ["term", "keep"]},
                    },
                    "required": ["block_id", "source", "target", "category"],
                },
            },
            "term_exceptions": {
                "type": "array",
                "description": "context 给了译法、这里意思不同而没照用的地方",
                "items": {
                    "type": "object",
                    "properties": {
                        "block_id": {"type": "string"},
                        "source": {"type": "string", "description": "原词"},
                        "used": {"type": "string", "description": "这里用的译法"},
                        "reason": {"type": "string", "description": "为什么这里意思不同"},
                    },
                    "required": ["block_id", "source", "used", "reason"],
                },
            },
            "notes": {"type": "string", "description": "可选：这一页翻译时拿不准的地方"},
        },
        "required": ["translations"],
    },
}

Transport = Callable[[dict], dict]


class StopRun(RuntimeError):
    """继续请求也没用（额度用完、密钥不对、一直限流）：调度保存进度后停下，修好再接着跑。"""

    reason = "stop"


class QuotaExhausted(StopRun):
    reason = "quota_exhausted"


class AuthFailed(StopRun):
    reason = "auth_failed"


class RateLimited(StopRun):
    reason = "rate_limited"


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


RETRY_STATUSES = {429, 500, 502, 503, 504, 529}
MAX_ATTEMPTS = 6
MAX_WAIT_SECONDS = 120.0


def classify_http_error(status: int, body: str) -> str:
    """retry（等一会再试）、quota（额度用完）、auth（密钥不对、没权限）、fatal（请求本身有错）。"""
    if status in RETRY_STATUSES:
        return "retry"
    if status in {401, 403}:
        return "auth"
    if status in {400, 402} and ("credit balance" in body.lower() or "billing" in body.lower() or "quota" in body.lower()):
        return "quota"
    return "fatal"


def retry_wait(attempt: int, retry_after: str | None) -> float:
    """第 `attempt` 次失败后等多久：有 Retry-After 照它，没有就指数退避（1、2、4……秒）加最多 1 秒的抖动。"""
    if retry_after:
        try:
            return min(MAX_WAIT_SECONDS, max(0.0, float(retry_after)))
        except ValueError:
            pass
    return min(MAX_WAIT_SECONDS, 2.0**attempt) + random.random()


def http_transport(body: dict, *, sleep: Callable[[float], None] = time.sleep) -> dict:
    """用标准库发请求（开发工具不给流水线添依赖）。429、5xx 和网络错误退避重试；额度、密钥问题抛 `StopRun`。"""
    import urllib.error
    import urllib.request

    key = os.environ.get("ANTHROPIC_API_KEY")
    if not key:
        raise AuthFailed("ANTHROPIC_API_KEY is not set (load ~/.config/retainpdf/test.env)")
    headers = {"x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json"}
    data = json.dumps(body, ensure_ascii=False).encode("utf-8")
    last_error = ""
    for attempt in range(MAX_ATTEMPTS):
        request = urllib.request.Request(API_URL, data=data, headers=headers, method="POST")
        retry_after = None
        try:
            with urllib.request.urlopen(request, timeout=300) as response:
                return json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as error:
            text = error.read()[:300].decode("utf-8", "replace")
            kind = classify_http_error(error.code, text)
            if kind == "quota":
                raise QuotaExhausted(f"model API HTTP {error.code}: {text}") from None
            if kind == "auth":
                raise AuthFailed(f"model API HTTP {error.code}: {text}") from None
            if kind == "fatal":
                raise RuntimeError(f"model API HTTP {error.code}: {text}") from None
            retry_after = error.headers.get("retry-after") if error.headers else None
            last_error = f"HTTP {error.code}"
        except (urllib.error.URLError, TimeoutError) as error:
            last_error = str(error)
        sleep(retry_wait(attempt, retry_after))
    raise RateLimited(f"model API still failing after {MAX_ATTEMPTS} attempts: {last_error}")


class TranslationAgent:
    def __init__(
        self,
        *,
        model: str | None = None,
        models: dict[str, str] | None = None,
        transport: Transport | None = None,
        cache_dir: Path | None = None,
        use_cache: bool = True,
    ):
        """`model` 是默认模型（所有角色都用它）；`models` 按角色另指定，例如 {"reviser": "claude-sonnet-5-5"}。"""
        self.model = model or os.environ.get("ANTHROPIC_MODEL") or DEFAULT_MODEL
        self.models = dict(models or {})
        self.transport = transport or http_transport
        self.cache_dir = cache_dir
        self.use_cache = use_cache
        self.usage = Usage()
        self.calls: list[dict] = []

    def model_for(self, role: str) -> str:
        return self.models.get(role) or self.model

    # ---- 请求 ----
    def _body(self, payload: dict, role: str = ROLE_TRANSLATOR, *, system: str = SYSTEM_PROMPT, tool: dict = TOOL) -> dict:
        return {
            "model": self.model_for(role),
            "max_tokens": 16000,
            "system": system,
            "tools": [tool],
            "tool_choice": {"type": "tool", "name": tool["name"]},
            "messages": [{"role": "user", "content": json.dumps(payload, ensure_ascii=False, indent=1)}],
        }

    def call_tool(self, payload: dict, *, system: str, tool: dict, role: str, label: str) -> dict:
        """别的角色（通读、审校）用：发一次请求，强制用 `tool` 交回，返回工具的输入；没交回就抛 ValueError。"""
        response = self._call(self._body(payload, role, system=system, tool=tool), label=label, role=role)
        for part in response.get("content") or []:
            if part.get("type") == "tool_use" and part.get("name") == tool["name"]:
                return part.get("input") or {}
        raise ValueError(f"model response has no {tool['name']} tool call")

    def _call(self, body: dict, *, label: str, role: str = ROLE_TRANSLATOR) -> dict:
        key = hashlib.sha256(json.dumps(body, ensure_ascii=False, sort_keys=True).encode("utf-8")).hexdigest()[:24]
        path = self.cache_dir / f"{key}.json" if self.cache_dir else None
        call = {"label": label, "key": key, "role": role, "model": body["model"]}
        if self.use_cache and path and path.exists():
            cached = json.loads(path.read_text(encoding="utf-8"))
            self.usage.add(cached["response"], 0, True)
            self.calls.append(dict(call, cached=True, latency_ms=cached.get("latency_ms", 0), usage=cached["response"].get("usage")))
            return cached["response"]
        start = time.monotonic()
        response = self.transport(body)
        latency = int((time.monotonic() - start) * 1000)
        self.usage.add(response, latency, False)
        self.calls.append(dict(call, cached=False, latency_ms=latency, usage=response.get("usage")))
        if path:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(json.dumps({"request": body, "response": response, "latency_ms": latency}, ensure_ascii=False, indent=1), encoding="utf-8")
        return response

    @staticmethod
    def _parse(response: dict) -> dict:
        """取出工具调用里的译文、报上的术语、声明的例外；同一个 id 交了多次的记下来。"""
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
                return {
                    "translations": out,
                    "notes": str(data.get("notes") or ""),
                    "duplicates": duplicates,
                    "terms": [t for t in data.get("terms") or [] if isinstance(t, dict)],
                    "term_exceptions": [e for e in data.get("term_exceptions") or [] if isinstance(e, dict)],
                }
        raise ValueError("model response has no submit_translations tool call")

    def _payload(self, page: PageInput, records: list[dict], **extra) -> dict:
        payload = {"document": page.document, "page": page.page_label, "section_path": page.section_path}
        if page.context:
            payload["context"] = {k: v for k, v in page.context.items() if k not in {"hash", "estimated_tokens", "truncated", "glossary_version"}}
        payload.update(extra)
        payload["blocks"] = records
        return payload

    def _meta(self, page: PageInput, block, *, role: str, attempt: int) -> dict:
        """这一块是谁、用哪个版本翻的；`used_terms` 记原文里出现的、上下文包给了的术语（含候选）和表的版本，术语改了能反查。"""
        version = page.context.get("glossary_version") if page.context else None
        used = [[t["id"], version] for t in find_terms(block.text, context_terms(page.context))] if page.context else []
        return {
            "model": self.model_for(role),
            "prompt_version": PROMPT_VERSION,
            "contract_version": CONTRACT_VERSION,
            "role": role,
            "round": 1,
            "attempt": attempt,
            "glossary_version": version,
            "used_terms": used,
            "context_hash": page.context.get("hash") if page.context else None,
        }

    def _check(self, page: PageInput, block, text: str | None, exceptions: dict[str, set[str]]) -> list[dict]:
        issues = check_block(block.text, text)
        if page.context:
            issues += check_terms(block.text, text, context_terms(page.context), exceptions.get(block.id))
            for item in _first_uses(page).get(block.id, []):
                if not text:
                    continue
                if item["kind"] == "abbr" and not re.search(rf"[\u4e00-\u9fff]\s*[（(][^（()）]*{re.escape(item['source'])}[^（()）]*[)）]", text):
                    issues.append(
                        {"code": "abbr_first_use", "severity": "error", "message": f"全书第一次用到缩写 {item['source']}，要写成“中文全称（{item['source']}）”"}
                    )
                elif item["kind"] == "name" and not re.search(rf"{re.escape(item['target'])}\s*[（(]\s*{re.escape(item['source'])}", text):
                    issues.append(
                        {"code": "name_first_use", "severity": "error", "message": f"全书第一次出现 {item['source']}，要写成“{item['target']}（{item['source']}）”"}
                    )
        return issues + style_signals(block.text, text)

    # ---- 一页 ----
    def translate_page(self, page: PageInput) -> tuple[dict[str, BlockResult], dict]:
        wanted = {b.id for b in page.to_translate()}
        if not wanted:
            # 这一页没有要翻的（都不翻，或者都是已定好的译文）：不发请求
            return self._fixed_results(page, {}), {"notes": "", "extra_ids": [], "duplicates": [], "terms": [], "term_exceptions": []}
        records = request_records(page.blocks, wanted)
        payload = self._payload(page, records, required_ids=[r["id"] for r in records if r["translate"]])
        response = self._call(self._body(payload), label=f"page {page.page_label}")
        parsed = self._parse(response)
        raw, duplicates = parsed["translations"], parsed["duplicates"]
        exceptions = _exceptions_by_block(parsed["term_exceptions"])
        per_block, split_issues = expand_translations(raw, page.blocks, wanted)
        record_ids = {r["id"] for r in records if r["translate"]}
        extra = sorted(set(raw) - record_ids)
        results: dict[str, BlockResult] = {}
        for block in page.to_translate():
            issues = self._check(page, block, per_block.get(block.id), exceptions) + split_issues.get(block.id, [])
            if block.id in duplicates:
                issues.append({"code": "duplicate", "severity": "warn", "message": "同一块交了不止一次，取最后一条"})
            meta = self._meta(page, block, role=ROLE_TRANSLATOR, attempt=1)
            results[block.id] = BlockResult(block.id, per_block.get(block.id), issues, 1, status_of(issues), meta=meta)
        self._apply_group_checks(page.to_translate(), results)
        # 不合格的：单块的合成一次请求一起重翻，接续组各自整组重翻
        failed = [b for b in page.to_translate() if results[b.id].status == STATUS_ERROR]
        singles = [b for b in failed if not b.group]
        groups: dict[str, list] = {}
        for block in failed:
            if block.group:
                groups[block.group["id"]] = self._unit_of(page, block)
        retry_terms: list[dict] = []
        retry_exceptions: list[dict] = []
        for unit in ([singles] if singles else []) + list(groups.values()):
            fixed, retry_parsed = self._retry_unit(page, unit, results)
            results.update(fixed)
            retry_terms += retry_parsed.get("terms", [])
            retry_exceptions += retry_parsed.get("term_exceptions", [])
        # 重翻以后还不合格：先看能不能保住译文（只是术语没照用、只是接续组断点没放对），保不住才退回原文、待人看
        _salvage(page, results)
        self._fixed_results(page, results)
        for block_id, result in list(results.items()):
            if result.status == STATUS_ERROR:
                results[block_id] = _fallback_to_source(result)
        info = {
            "notes": parsed["notes"],
            "extra_ids": extra,
            "duplicates": duplicates,
            "terms": parsed["terms"] + retry_terms,
            "term_exceptions": parsed["term_exceptions"] + retry_exceptions,
        }
        return results, info

    def _fixed_results(self, page: PageInput, results: dict[str, BlockResult]) -> dict[str, BlockResult]:
        """已定好的译文（通读定的标题、目录）原样交回。"""
        for block in page.fixed():
            meta = dict(self._meta(page, block, role=ROLE_READER, attempt=0), model=None)
            results[block.id] = BlockResult(block.id, block.fixed_translation, [], 0, STATUS_OK, meta=meta)
        return results

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
            _forgive_moved_marks(members, results)

    # ---- 按重排 agent 的要求改稿 ----
    def revise(self, page: PageInput, requests: list[RevisionRequest]) -> dict[str, BlockResult]:
        """只改 `requests` 列出的块（同一页的其它块作上下文）。改完还不合格（含超出 max_chars）就再改一次。

        改稿不许删内容，所以两次都缩不到 max_chars 是正常结果：交回改过的版本里最短的、没有别的错的那版，
        `still_too_long` 降成警告，由排版缩字号或给人看。
        """
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
            payload = self._payload(
                page,
                request_records(page.blocks, ids),
                revise=[_revision_record(r, results.get(r.id)) for r in pending],
                required_ids=sorted(ids),
            )
            response = self._call(self._body(payload, ROLE_REVISER), label="revise " + ",".join(sorted(ids)), role=ROLE_REVISER)
            try:
                parsed = self._parse(response)
            except ValueError:
                parsed = {"translations": {}, "term_exceptions": []}
            per_block, _ = expand_translations(parsed["translations"], page.blocks, ids)
            exceptions = _exceptions_by_block(parsed["term_exceptions"])
            next_round: list[RevisionRequest] = []
            for request in pending:
                text = per_block.get(request.id)
                issues = self._check(page, by_id[request.id], text, exceptions)
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
                meta = self._meta(page, by_id[request.id], role=ROLE_REVISER, attempt=attempt)
                results[request.id] = BlockResult(request.id, text, issues, attempt, status_of(issues), history, meta)
                if results[request.id].status == STATUS_ERROR:
                    next_round.append(request)
            pending = next_round
        for request in pending:
            results[request.id] = _shortest_over_limit(results[request.id])
        return results

    def _retry_unit(self, page: PageInput, unit: list, results: dict) -> tuple[dict[str, BlockResult], dict]:
        """不合格的块（接续组就整组）重翻一次：同一页其它块作为上下文，并告诉模型上次哪里不对。"""
        ids = {b.id for b in unit}
        records = request_records(page.blocks, ids)

        def problems(block_ids) -> list[str]:
            return sorted({i["message"] for b in block_ids for i in results[b].issues if i["severity"] != "info"})

        retry: list[dict] = []
        if unit[0].group and len(unit) > 1:
            retry.append(
                {
                    "id": unit[0].group["id"],
                    "previous_translation": BREAK.join(results[b.id].translation or "" for b in unit),
                    "problems": problems([b.id for b in unit]),
                    # 每个断点前后的原文几个词，帮模型找到断点在译文里的位置
                    "breaks": [{"after": " ".join(a.text.split()[-6:]), "before": " ".join(b.text.split()[:6])} for a, b in zip(unit, unit[1:])],
                }
            )
        else:
            for b in unit:
                retry.append({"id": b.id, "previous_translation": results[b.id].translation, "problems": problems([b.id])})
        payload = self._payload(page, records, retry=retry, required_ids=[r["id"] for r in retry])
        response = self._call(self._body(payload), label="retry " + ",".join(r["id"] for r in retry))
        try:
            parsed = self._parse(response)
        except ValueError:
            parsed = {"translations": {}, "terms": [], "term_exceptions": []}
        per_block, split_issues = expand_translations(parsed["translations"], page.blocks, ids)
        exceptions = _exceptions_by_block(parsed["term_exceptions"])
        fixed: dict[str, BlockResult] = {}
        for block in unit:
            first = results[block.id]
            issues = self._check(page, block, per_block.get(block.id), exceptions) + split_issues.get(block.id, [])
            history = first.history + [{"translation": first.translation, "issues": first.issues}]
            meta = self._meta(page, block, role=ROLE_TRANSLATOR, attempt=first.attempts + 1)
            fixed[block.id] = BlockResult(block.id, per_block.get(block.id), issues, first.attempts + 1, status_of(issues), history, meta)
        self._apply_group_checks(unit, fixed)
        return fixed, parsed


# 中文语序会把公式、引用、脚注标记挪过接续组的断点：按块查是"丢了"，按整组查还在，就只记警告
MOVABLE = {"formula_changed", "citation_lost", "footnote_mark_lost", "code_changed"}


def _forgive_moved_marks(members: list, results: dict[str, BlockResult]) -> None:
    if len(members) < 2 or any(results[b.id].translation is None for b in members):
        return
    whole = check_block(" ".join(b.text for b in members), "".join(results[b.id].translation or "" for b in members))
    still_lost = {i["code"] for i in whole}
    for block in members:
        result = results[block.id]
        if not any(i["code"] in MOVABLE and i["code"] not in still_lost for i in result.issues):
            continue
        result.issues = [
            dict(i, code="mark_moved", severity="warn", message=i["message"] + "（整组里还在，挪到了接续组的另一块）")
            if i["code"] in MOVABLE and i["code"] not in still_lost
            else i
            for i in result.issues
        ]
        result.status = status_of(result.issues)


def _first_uses(page: PageInput) -> dict[str, list[dict]]:
    """上下文包里标了 first_use 的缩写和人名，落在这一页第一个用到它的块上：{块 id: [条目, …]}。"""
    out: dict[str, list[dict]] = {}
    items = [dict(i, kind="abbr", source=i["abbr"]) for i in (page.context or {}).get("abbreviations") or []]
    items += [dict(i, kind="name") for i in (page.context or {}).get("names") or []]
    for item in items:
        if not item.get("first_use"):
            continue
        pattern = re.compile(rf"(?<![\w-]){re.escape(item['source'])}(?![\w-])")
        block = next((b for b in page.to_translate() if pattern.search(b.text)), None)
        if block is not None:
            out.setdefault(block.id, []).append(item)
    return out


def _exceptions_by_block(exceptions: list[dict]) -> dict[str, set[str]]:
    out: dict[str, set[str]] = {}
    for item in exceptions:
        out.setdefault(str(item.get("block_id", "")), set()).add(str(item.get("source", "")).lower())
    return out


# 重翻后只剩这些错，译文本身没坏：降成警告保留译文（术语交给术语专员或人，断点交给排版）
TERM_ONLY = {"term_mismatch", "keep_original_lost", "abbr_first_use", "name_mismatch", "name_first_use"}
BREAK_ONLY = {"group_break", "group_overlap"}


def _salvage(page: PageInput, results: dict[str, BlockResult]) -> None:
    for block in page.to_translate():
        result = results.get(block.id)
        if result is None or result.status != STATUS_ERROR:
            continue
        errors = {i["code"] for i in result.issues if i["severity"] == "error"}
        if errors <= TERM_ONLY:
            result.issues = [
                dict(i, severity="warn", message=i["message"] + "（重翻后仍没照用，保留译文，交给术语专员或人看）") if i["code"] in TERM_ONLY else i
                for i in result.issues
            ]
            result.status = status_of(result.issues)
    groups: dict[str, list] = {}
    for block in page.to_translate():
        if block.group and block.id in results:
            groups.setdefault(block.group["id"], []).append(block)
    for members in groups.values():
        members.sort(key=lambda b: b.group["index"])
        member_results = [results[b.id] for b in members]
        if not all(r.status == STATUS_ERROR for r in member_results):
            continue
        if not all({i["code"] for i in r.issues if i["severity"] == "error"} <= BREAK_ONLY | TERM_ONLY for r in member_results):
            continue
        if not any(i["code"] == "group_break" for i in member_results[0].issues):
            continue
        # 断点两次都放多了：整段译文放进第一块，其余块留空（内容一点不丢，排版时第一块可能要缩字号）
        whole = re.sub(r"\s*\[\[BREAK\]\]\s*", "", member_results[0].translation or "").strip()
        if not whole.strip():
            continue
        for index, (block, result) in enumerate(zip(members, member_results)):
            issue = {
                "code": "group_merged",
                "severity": "warn",
                "message": "接续组的断点没放对，整段译文放在第一块" if index == 0 else "整段译文已放在接续组第一块，这块留空",
            }
            kept = [i for i in result.issues if i["code"] not in BREAK_ONLY | {"group_share", "too_long", "too_short"}]
            history = result.history + [{"translation": result.translation, "issues": result.issues}]
            results[block.id] = BlockResult(block.id, whole if index == 0 else "", kept + [issue], result.attempts, "", history, result.meta)
            results[block.id].status = status_of(results[block.id].issues)


def _fallback_to_source(result: BlockResult) -> BlockResult:
    """重翻后还不合格：译文置空（显示原文），没过校验的那版进 history，状态 fallback_source。"""
    history = result.history + [{"translation": result.translation, "issues": result.issues}]
    issues = result.issues + [{"code": "fallback_source", "severity": "error", "message": "重翻后仍不合格，保留原文、待人看"}]
    return BlockResult(result.id, None, issues, result.attempts, STATUS_FALLBACK_SOURCE, history, result.meta)


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
    """把模型交回的（块 id 或接续组 id → 译文）拆回各块。

    组的 BREAK 放少了（含一个没放）：程序按原文长度比例在附近的中文标点切开，记警告，不重翻；放多了才整组记不合格。
    后面一块以标点开头的，标点挪回前一块末尾。
    """
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
        if len(parts) > len(members):
            message = f"接续组的断点标记应有 {len(members) - 1} 个，交回了 {len(parts) - 1} 个"
            for member in members:
                issues.setdefault(member.id, []).append({"code": "group_break", "severity": "error", "message": message})
                per_block[member.id] = text
            continue
        if len(parts) < len(members):
            parts = split_by_ratio(text.replace(BREAK, ""), [len(m.text) for m in members])
            message = f"断点标记应有 {len(members) - 1} 个，交回了 {text.count(BREAK)} 个，程序按原文长度比例在标点处切开"
            for member in members:
                issues.setdefault(member.id, []).append({"code": "group_split_by_program", "severity": "warn", "message": message})
        for member, part in zip(members, move_leading_punctuation([p.strip() for p in parts])):
            per_block[member.id] = part
    return per_block, issues


def _revision_record(request: RevisionRequest, previous: BlockResult | None) -> dict:
    """改稿请求里的一块：替模型算好现在多少字、至少要删多少（模型自己数字数不准）。"""
    current = (previous.translation if previous and previous.translation else None) or request.current_translation
    chars = visible_length(current)
    record = {"id": request.id, "current_translation": current, "current_chars": chars, "reason": request.reason, "note": request.note}
    if request.max_chars:
        record.update(max_chars=request.max_chars, must_cut=max(0, chars - request.max_chars))
    if previous:
        record["problems"] = [i["message"] for i in previous.issues if i["severity"] != "info"]
    return record


def _revision_issue(request: RevisionRequest) -> dict:
    target = f"，要求不超过 {request.max_chars} 字" if request.max_chars else ""
    return {"code": f"revision_{request.reason}", "severity": "info", "message": f"重排要求改稿：{request.reason}{target}"}


def _shortest_over_limit(result: BlockResult) -> BlockResult:
    """两次改稿都超长：在除了超长没有别的错的版本里取最短的，超长降成警告；有别的错就原样留着（状态仍是错误）。"""

    def only_too_long(issues: list[dict]) -> bool:
        return all(i["code"] == "still_too_long" or i["severity"] != "error" for i in issues)

    tries = [(result.translation, result.issues)] + [(h["translation"], h["issues"]) for h in result.history if "attempts" in h]
    usable = [(text, issues) for text, issues in tries if text and only_too_long(issues)]
    if not usable:
        return result
    text, issues = min(usable, key=lambda t: visible_length(t[0]))
    issues = [
        dict(i, severity="warn", message=i["message"] + "；不删内容缩不到，交回最短的一版，请排版缩字号")
        if i["code"] == "still_too_long"
        else i
        for i in issues
    ]
    return BlockResult(result.id, text, issues, result.attempts, status_of(issues), result.history)
