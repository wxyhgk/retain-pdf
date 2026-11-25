"""翻译引擎 agent（任务的 translation.engine=agent）：逐页翻交给 retainpdf-translation-agent，其余照旧。

和现有流程（legacy）共用前半段 `workflow/prepare.py` 的 `prepare_book_payloads`（读每页模板、接续段、页面策略），也共用后面的
清单、质检、断点收尾（`execution_runner`）；只替换"逐页翻"那一步：

- 每页模板记录 → agent 的 `PageInput`：类别按规范化文档的 sub_type 换成 agent 的分类，原文用 `$…$` 直写公式
  （agent 引擎强制 math_mode=direct_typst），参考文献角标 "$ ^{40} $" 换成脚注标记 `{{fn:40}}`、写回时换回去；
  接续组（`__cg__:` 单元）整组放进组头那一页；组里两块之间夹着的独立公式填进 `formula_before`。
- `DocumentRun` 整篇顺序翻：先通读（体裁、术语、人名、标题），每页翻完审校。状态（续跑用）在翻译目录的 `agent/` 下，
  换了文档或引擎版本（提示词、交接格式、检查规则）就清掉重来。请求缓存各任务共用（`paths.AGENT_REQUEST_CACHE_DIR`），
  键是整个请求体的哈希：重试翻译会新建任务，问过的一模一样的请求不再花钱。注意每页的请求带着上一页的译文作上下文，
  哪一页的译文变了，后面各页的请求也跟着变，要重新问。调度同时写编辑部事件 `agent/run/events.jsonl`（editorial.v1），
  前端「进度」面板的编辑部画面从 `GET /api/v1/jobs/:job_id/progress/editorial` 读它。
- 每页做完：译文写回模板记录（单块和 `revision.py` 一样用 `apply_revised_member_text`，接续组再重建整组字段），
  落盘、提交断点（实时译文照常），发 `translation_batches` 进度，记用量台账。
- agent 交回 `fallback_source`（重翻还不合格）的块：标成死信（保留原文，不卡发布，任务完成时提示有几块没翻）。
- 额度用完、密钥不对、一直限流：保存进度后让这一阶段失败，重试时从断点接着跑。

模型请求用任务的密钥和地址，不读服务器的 `ANTHROPIC_API_KEY`。任务的接口协议是 `anthropic` 时 agent 自己发 Messages 请求
（`make_http_transport`）；`openai` / `openai_responses` 时经 `agent_openai` 换算成翻译共用的请求层（2026-11-18 起，以前只收 anthropic）。
"""

from __future__ import annotations

import os

import hashlib
import threading
import json
import re
import shutil
from pathlib import Path
from typing import TYPE_CHECKING
from typing import Any
from typing import Callable

from retainpdf_base.cache_ttl import prune_expired_once
from retainpdf_base.cache_ttl import ttl_seconds
from retainpdf_base import paths
from retainpdf_base.events import emit_stage_progress
from retainpdf_base.events import emit_stage_transition
from retainpdf_base.upstream_wait import begin_upstream_wait
from retainpdf_base.upstream_wait import build_wait_info
from retainpdf_base.upstream_wait import end_upstream_wait
from retainpdf_base.upstream_wait import vendor_for_base_url
from retainpdf_translation.artifacts import TranslationRunDiagnostics
from retainpdf_translation_agent_engine.identity import agent_engine_identity
from retainpdf_translation.core.execution_policy import item_fixed_translation
from retainpdf_translation.core.item_reader import item_normalized_sub_type
from retainpdf_translation.core.payload import load_translations
from retainpdf_translation.core.payload.parts.apply import apply_revised_member_text
from retainpdf_translation.core.payload.parts.apply import apply_revised_unit_text
from retainpdf_translation.core.payload.parts.apply import join_unit_text
from retainpdf_translation.core.payload.parts.common import is_group_unit_id
from retainpdf_translation.core.payload.parts.diagnostics import record_translation_diagnostics
from retainpdf_translation.core.payload.parts.formula_gaps import formulas_between
from retainpdf_translation.core.payload.parts.policy_state import mark_translation_failed_policy_state
from retainpdf_translation.core.payload.parts.policy_state import mark_policy_skip
from retainpdf_translation.llm.shared.control_context import TranslationControlContext
from retainpdf_translation.llm.shared import model_wire
from retainpdf_translation.llm.shared.model_wire import anthropic_usage
from retainpdf_translation.llm.shared.upstream_error_codes import agent_http_classifier
from retainpdf_translation.llm.shared.upstream_resilience import REGION_FAILURE_SUGGESTION
from retainpdf_translation.llm.shared.upstream_resilience import REGION_FAILURE_SUMMARY
from retainpdf_translation.llm.shared.usage_ledger import record_model_usage
from retainpdf_translation.services.policy import TranslationPolicyConfig
from retainpdf_translation_agent_engine.agent_openai import make_openai_transport
from retainpdf_translation.workflow.prepare import prepare_book_payloads
from retainpdf_translation.workflow.page_policies import build_page_summaries
from retainpdf_translation.workflow.pages import save_pages
from retainpdf_translation_agent import DEFAULT_MODEL
from retainpdf_translation_agent import EVENTS_FILE
from retainpdf_translation_agent import STATUS_FALLBACK_SOURCE
from retainpdf_translation_agent import BlockInput
from retainpdf_translation_agent import BlockResult
from retainpdf_translation_agent.checks import escape_currency
from retainpdf_translation_agent.checks import nothing_to_translate
from retainpdf_translation_agent import DocumentRun
from retainpdf_translation_agent import PageInput
from retainpdf_translation_agent import TranslationAgent
from retainpdf_translation_agent import glossary_from_entries
from retainpdf_translation_agent import make_http_transport

if TYPE_CHECKING:
    from retainpdf_translation.workflow.checkpoint import TranslationCheckpointSession

AGENT_STATE_DIR = "agent"
RUN_DIR = "run"
# 编辑部事件相对翻译目录的位置。rust_api 读事件的接口按同一个路径找（retainpdf-core 的
# storage_paths::AGENT_EDITORIAL_EVENTS_RELATIVE_PATH），改了两边一起改，test_agent_flow 钉着。
EDITORIAL_EVENTS_RELATIVE_PATH = f"{AGENT_STATE_DIR}/{RUN_DIR}/{EVENTS_FILE}"
STATE_FINGERPRINT = "fingerprint.json"
SUBSTAGE = "translation_batches"

# 规范化文档的 sub_type → agent 的块分类（和测试系统 devtools/agent_lab/real_doc.py 一致）
SUB_TYPE_CLASS = {
    "body": "paragraph",
    "display_formula": "display_formula",
    "formula_number": "formula_number",
    "header": "running_header",
    "footer": "running_footer",
    "page_number": "page_number",
    "heading": "section_heading",
    "title": "section_heading",
    "image_body": "figure",
    "figure_caption": "figure_caption",
    "table_caption": "table_caption",
    "image_footnote": "float_note",
    "table_footnote": "float_note",
    "table_html": "table",
    "footnote": "footnote",
    "reference": "reference_entry",
    "list_item": "list_item",
    "abstract": "abstract",
    "code": "code_block",
    "algorithm": "algorithm",
}
HEADING_NUMBER_RE = re.compile(r"^\s*(\d+(?:\.\d+)*)\s+\S")
# OCR 把参考文献的上标角标写成公式 "$ ^{48-50} $"：交给 agent 前换成脚注标记（受保护、丢了查得出），写回时换回原样。
# 只认正整数、列表、范围（"34""2-6""40,52,53"）。负数是单位的指数（"mL $ ^{-1} $"），紧跟在数字、单位后面的是乘方
# （"10 $ ^{5} $""mm $ ^{3} $"），都留着当公式：2026-10-31 一篇 ACS 论文 Methods 里的 "ng mL $ ^{-1} $" 被换成 {{fn:-1}}，
# 模型写回 $^{-1}$、校验报"脚注标记丢了"，重翻两次一样，6 段整段退回原文
# OCR 有时在多位数中间加空格（"$ ^{1 1} $" 是 11，11-20《The Interloper》两处漏成原样）：数字之间允许一个空格
CITATION_SUPERSCRIPT_RE = re.compile(r"\$\s*\^\s*\{\s*([1-9](?: ?\d)*(?:\s*[,–-]\s*[1-9](?: ?\d)*)*)\s*\}\s*\$")
EXPONENT_BEFORE_RE = re.compile(r"(?:\d|(?<![A-Za-z])(?:[kcmnpµμ]?m|[mµμ]?L|[mµμk]?g|mol|[mµμn]?M|s|min|h|Hz|Pa|cm|nm|K|°C|Å))\s*\$?\s*$")
FN_TOKEN_RE = re.compile(r"\{\{fn:([^{}]+)\}\}")


class AgentRunStopped(RuntimeError):
    """额度用完、密钥不对、一直限流：进度已保存，修好后重试这个任务会从断点接着翻。"""

    retain_failure_code = ""


class AgentQuotaExhausted(AgentRunStopped):
    """模型 API 的余额、额度、预算用完（402，或 429 等 + 计费业务码）：结构化失败归 ``upstream_quota_exhausted``。"""

    retain_failure_code = "upstream_quota_exhausted"


class AgentAuthFailed(AgentRunStopped):
    """Key 被拒、没权限、套餐不能用这个模型：结构化失败归 ``auth_failed``。"""

    retain_failure_code = "auth_failed"


class AgentModelUnavailable(AgentRunStopped):
    """模型不存在、没开通，或接口地址写错（404 等）：结构化失败归 ``upstream_model_unavailable``，改好模型后从翻译续跑。"""

    retain_failure_code = "upstream_model_unavailable"


class AgentRegionUnsupported(AgentAuthFailed):
    """服务商不支持当前所在地区：归 ``upstream_region_unsupported``（2026-11-24 以前归 ``auth_failed``），说法是换网络或换服务商（换 Key 没用）。"""

    retain_failure_code = "upstream_region_unsupported"
    failure_summary = REGION_FAILURE_SUMMARY
    failure_suggestion = REGION_FAILURE_SUGGESTION


_STOP_ERRORS = {
    "quota_exhausted": AgentQuotaExhausted,
    "auth_failed": AgentAuthFailed,
    "model_unavailable": AgentModelUnavailable,
    "region_unsupported": AgentRegionUnsupported,
}


def _stopped_error(outcome) -> AgentRunStopped:
    """停下的原因放进说明：额度用完时带 HTTP 状态和服务商的业务码。"""
    message = f"translation agent stopped: reason={outcome.stop_reason} pages_done={outcome.pages_done}/{outcome.pages_total}"
    detail = str(getattr(outcome, "stop_message", "") or "").strip()
    if detail:
        message = f"{message} | {detail}"
    return _STOP_ERRORS.get(outcome.stop_reason, AgentRunStopped)(message)



def agent_structure() -> str:
    """翻译结构：人文社科、通俗读物默认按节翻（翻译 agent 第二版，`retainpdf_translation_agent/section.py`，2026-11-19 起
    默认，用户定；三段评测样例 Haiku 都比原来好，qwen 和原来差不多、请求少四分之三）。`RETAIN_AGENT_STRUCTURE=page` 退回逐页
    （第一版）；别的值、没设都按节。论文、教材等别的体裁不受影响，照旧逐页。"""
    value = os.environ.get("RETAIN_AGENT_STRUCTURE", "").strip().lower()
    return "page" if value == "page" else "section"

def messages_url(base_url: str) -> str:
    """任务的 base_url（如 https://api.anthropic.com/v1）→ Messages 接口地址。"""
    base = (base_url or "").strip().rstrip("/")
    if not base:
        return "https://api.anthropic.com/v1/messages"
    return base if base.endswith("/messages") else f"{base}/messages"


# ---- 模板记录 → PageInput ----


def _block_source(item: dict) -> str:
    """这一块自己的原文（直写公式下就是带 `$…$` 的原文）。不走 item_source_text 的完整链：那条链给接续组成员的是整组原文，
    agent 要的是每块各自的原文，接续组由它自己合起来翻、再按比例分回各块。"""
    return str(item.get("protected_source_text") or item.get("source_text") or "").strip()


def _block_class(item: dict) -> str:
    sub_type = (item_normalized_sub_type(item) or str(item.get("block_type") or "")).strip()
    return SUB_TYPE_CLASS.get(sub_type, "paragraph" if sub_type == "text" else "unknown")


def _heading_level(item: dict) -> int:
    if item_normalized_sub_type(item) == "title":
        return 1
    match = HEADING_NUMBER_RE.match(_block_source(item))
    return min(6, match.group(1).count(".") + 1) if match else 3


def _page_sizes(data: dict) -> dict[int, tuple[float, float]]:
    sizes: dict[int, tuple[float, float]] = {}
    for position, page in enumerate((data or {}).get("pages") or []):
        if not isinstance(page, dict):
            continue
        index = int(page.get("page_index", position) if page.get("page_index") is not None else position)
        width, height = page.get("width"), page.get("height")
        if isinstance(width, (int, float)) and isinstance(height, (int, float)) and width > 0 and height > 0:
            sizes[index] = (float(width), float(height))
    return sizes


def _where(item: dict, size: tuple[float, float] | None, label: str) -> str:
    bbox = item.get("bbox") or []
    if size is None or len(bbox) != 4:
        return f"第 {label} 页"
    width, height = size
    x0, y0, x1, y1 = (float(v) for v in bbox)
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    if x1 < width * 0.1 or x0 > width * 0.9:
        column = "页边"
    elif x1 - x0 > width * 0.55:
        column = "通栏"
    else:
        column = "左栏" if cx < width / 2 else "右栏"
    vertical = "上部" if cy < height / 3 else "中部" if cy < height * 2 / 3 else "下部"
    return f"第 {label} 页，{column}{vertical}"


def _agent_text(item: dict, cls: str) -> tuple[str, dict[str, str]]:
    """交给 agent 的原文和换掉的角标（脚注标记 → 原来的公式写法）。价格里的 `$`（"$12.59"）写成反斜杠加美元符，不当公式边界。"""
    text = escape_currency(_block_source(item))
    marks: dict[str, str] = {}
    if cls in ("display_formula", "formula_number"):
        return text, marks

    def to_mark(match: re.Match) -> str:
        if EXPONENT_BEFORE_RE.search(text[max(0, match.start() - 8) : match.start()]):
            return match.group(0)
        number = re.sub(r"\s+", "", match.group(1))
        marks.setdefault(number, match.group(0))
        return "{{fn:" + number + "}}"

    return CITATION_SUPERSCRIPT_RE.sub(to_mark, text), marks


def _restore_marks(text: str, marks: dict[str, str]) -> str:
    """脚注标记换回原来的写法。这一块的表里没有的（接续组切开时从另一块挪过来、模型把 "13, 33" 写成 "13,33"）
    写成上标公式：交给 agent 的标记都是从引用角标换来的，原样留着 {{fn:…}} 会露在译文里。"""
    return FN_TOKEN_RE.sub(lambda m: marks.get(m.group(1)) or f"$ ^{{{m.group(1)}}} $", text)


INDEX_HEADINGS = {"index", "subject index", "name index", "author index", "general index", "index of names", "index of subjects"}
INDEX_FROM_SHARE = 0.75  # 索引标题只在书的最后四分之一里认
HEADER_NUMBER_RE = re.compile(r"^\[?(\d{1,4})\]?\s+\S.{0,48}$|^\S.{0,48}?\s+\[?(\d{1,4})\]?$")


def _printed_page_offset(page_payloads: dict[int, list[dict]]) -> int | None:
    """PDF 第几页（从 1 数）减去书上印的页码，全书最常见的那个差；页脚没有数字页码时 None。"""
    from collections import Counter

    offsets = Counter()
    for page_idx, items in page_payloads.items():
        for item in items:
            text = _block_source(item)
            if item_normalized_sub_type(item) == "page_number" and text.isdigit():
                offsets[page_idx + 1 - int(text)] += 1
    if not offsets:
        return None
    offset, count = offsets.most_common(1)[0]
    return offset if count >= 3 else None


def _printed_page_numbers(page_payloads: dict[int, list[dict]], source_pdf_path: Path | None) -> dict[int, int]:
    """每页书上印的页码（只要阿拉伯数字的）：先看原 PDF 的页码标签（出版社的 PDF 多半有，PDF 第 181 页标着 "170"），
    没有再拿页脚页码块算出全书的页码差。都没有就是空的。"""
    printed: dict[int, int] = {}
    if source_pdf_path is not None and Path(source_pdf_path).exists():
        try:
            import fitz

            with fitz.open(source_pdf_path) as pdf:
                for page_idx in page_payloads:
                    if 0 <= page_idx < pdf.page_count:
                        label = str(pdf[page_idx].get_label() or "").strip()
                        if label.isdigit():
                            printed[page_idx] = int(label)
        except Exception:
            printed = {}
    if printed:
        return printed
    offset = _printed_page_offset(page_payloads)
    return {} if offset is None else {page_idx: page_idx + 1 - offset for page_idx in page_payloads}


def skip_nothing_to_translate(page_payloads: dict[int, list[dict]]) -> dict[str, int]:
    """没有要翻的话的块（只有引注、纯数字符号网址代码公式）交给 agent 之前就标成保留原文，写明原因
    （2026-11-20 用户定：这类块算「按设计保留原文」，不算没翻成）。以前交给模型，原样交回判漏翻，重交几次后进死信，
    阅读页「待处理」、书详情「没翻成」都把它们当问题列出来（《The Interloper》书末注释 11 条）。
    接续组的成员不管（整组一起翻）。返回各原因标了几块。"""
    counts: dict[str, int] = {}
    for items in page_payloads.values():
        for item in items:
            if not item.get("should_translate", True) or str(item.get("final_status") or ""):
                continue
            if len(item.get("translation_unit_member_ids") or []) > 1:
                continue
            reason = nothing_to_translate(_block_source(item))
            if reason:
                mark_policy_skip(item, reason)
                counts[reason] = counts.get(reason, 0) + 1
    return counts


def skip_back_matter(page_payloads: dict[int, list[dict]], source_pdf_path: Path | None = None) -> dict[str, int]:
    """交给 agent 之前，把两类不该翻的块标成保留原文（2026-11-20，Sonnet 审读《The Interloper》时查出）：

    - 被 OCR 认成标题的页眉："[170] NOTES" 里的数字正好是这一页印的页码（按全书页脚算出 PDF 页和印的页码差几页）。
      以前通读把它定成标题译文「[170] 注释」，之后谁也不再看。页码先看 PDF 的页码标签，没有再用页脚页码。
    - 书后的索引：最后四分之一里出现 Index 这类标题，它后面到书尾都保留原文。索引翻出来按中文排序全乱、页码是英文版的，
      还白花钱（这本书 3 页索引 88 段）。参考文献以前在 OCR 规范化时就标好了不翻，索引没人管。
    返回各标了几块。"""
    counts = {"running_header": 0, "index": 0}
    printed = _printed_page_numbers(page_payloads, source_pdf_path)
    if printed:
        for page_idx, items in page_payloads.items():
            for item in items:
                if not item.get("should_translate", True) or item_normalized_sub_type(item) not in ("title", "heading"):
                    continue
                match = HEADER_NUMBER_RE.match(_block_source(item))
                number = match and (match.group(1) or match.group(2))
                if number and printed.get(page_idx) == int(number):
                    mark_policy_skip(item, "skip_running_header")
                    counts["running_header"] += 1
    if not page_payloads:
        return counts
    last_page = max(page_payloads)
    started = False
    for page_idx in sorted(page_payloads):
        for item in page_payloads[page_idx]:
            if started:
                if item.get("should_translate", True):
                    mark_policy_skip(item, "skip_back_matter_index")
                    counts["index"] += 1
                continue
            if (
                page_idx >= last_page * INDEX_FROM_SHARE
                and item_normalized_sub_type(item) in ("title", "heading")
                and " ".join(re.sub(r"[^a-z ]+", " ", _block_source(item).lower()).split()) in INDEX_HEADINGS
            ):
                started = True
    return counts


def build_agent_pages(
    page_payloads: dict[int, list[dict]],
    data: dict,
    *,
    document_title: str = "",
) -> tuple[list[PageInput], dict[str, dict[str, str]]]:
    """每页模板记录 → `PageInput` 列表（按页序），以及每块换掉的角标（块 id → {编号: 原写法}）。"""
    sizes = _page_sizes(data)
    labels = {
        page_idx: next(
            (_block_source(item) for item in items if item_normalized_sub_type(item) == "page_number" and _block_source(item)),
            str(page_idx + 1),
        )
        for page_idx, items in page_payloads.items()
    }
    items_by_id = {str(item.get("item_id") or ""): (page_idx, item) for page_idx, items in page_payloads.items() for item in items}

    # 接续组：只算要翻的成员，两块以上才算组；组按 translation_unit_member_ids 的顺序编号
    groups: dict[str, list[str]] = {}
    for page_idx in sorted(page_payloads):
        for item in page_payloads[page_idx]:
            unit_id = str(item.get("translation_unit_id") or "")
            if not is_group_unit_id(unit_id) or unit_id in groups:
                continue
            members = [m for m in (item.get("translation_unit_member_ids") or []) if m in items_by_id and items_by_id[m][1].get("should_translate", True)]
            groups[unit_id] = members
    groups = {unit_id: members for unit_id, members in groups.items() if len(members) >= 2}
    group_of = {member: (unit_id, index, len(members)) for unit_id, members in groups.items() for index, member in enumerate(members, start=1)}
    # 组里两块之间夹着的独立公式：合组时放进整段，切回各块时在这里切（`formula_gaps`）
    flat = [item for page_idx in sorted(page_payloads) for item in page_payloads[page_idx]]
    formula_before = {
        member: formula
        for members in groups.values()
        for member, formula in zip(members, formulas_between(flat, [items_by_id[m][1] for m in members]))
        if formula
    }
    home_page = {member: items_by_id[members[0]][0] for members in groups.values() for member in members}

    marks_by_block: dict[str, dict[str, str]] = {}
    blocks_by_page: dict[int, list[BlockInput]] = {page_idx: [] for page_idx in page_payloads}
    for page_idx in sorted(page_payloads):
        for item in page_payloads[page_idx]:
            item_id = str(item.get("item_id") or "")
            cls = _block_class(item)
            text, marks = _agent_text(item, cls)
            if marks:
                marks_by_block[item_id] = marks
            attributes = {"level": _heading_level(item)} if cls == "section_heading" else {}
            group = None
            if item_id in group_of:
                unit_id, index, count = group_of[item_id]
                group = {"id": unit_id, "index": index, "of": count}
            block = BlockInput(
                id=item_id,
                cls=cls,
                text=text,
                translate=bool(item.get("should_translate", True)) and bool(text),
                where=_where(item, sizes.get(page_idx), labels[page_idx]),
                group=group,
                attributes=attributes,
                formula_before=formula_before.get(item_id, ""),
                # 翻译开头定好的译文（目录 agent，底座 workflow/fixed_translations.py）：组里的块不给，agent 照旧整段翻
                fixed_translation=(item_fixed_translation(item) or None) if group is None else None,
            )
            blocks_by_page[home_page.get(item_id, page_idx)].append(block)

    pages: list[PageInput] = []
    section: list[str] = []
    chapter = ""
    document = {"title": document_title, "source_lang": "en", "target_lang": "zh-CN"}
    for page_idx in sorted(page_payloads):
        blocks = blocks_by_page[page_idx]
        headings = [b for b in blocks if b.cls == "section_heading" and b.translate]
        chapter = next((b.id for b in headings if b.attributes.get("level") == 1), chapter)
        pages.append(PageInput(page_label=labels[page_idx], blocks=blocks, section_path=list(section), document=document, chapter=chapter))
        for block in headings:
            level = int(block.attributes.get("level") or 1)
            section = section[: level - 1] + [block.text]
    return pages, marks_by_block


# PDF 元数据里常见的垃圾书名：排版软件、转换工具自动写的，或者就是文件名
_JUNK_TITLE = re.compile(r"^(untitled|microsoft word|microsoft powerpoint|document\d*|book\d*|layout \d+)\b|\.(pdf|docx?|indd|tex|qxd|ps)$", re.I)


def _pdf_metadata_title(source_pdf_path: Path | None) -> str:
    """原 PDF 元数据里的书名；没有、读不出、或者是垃圾值（文件名、Microsoft Word 开头、纯数字）时给空串。"""
    if source_pdf_path is None or not Path(source_pdf_path).exists():
        return ""
    try:
        import fitz

        with fitz.open(source_pdf_path) as pdf:
            title = " ".join(str((pdf.metadata or {}).get("title") or "").split())
    except Exception:
        return ""
    if len(title) < 3 or title.isdigit() or _JUNK_TITLE.search(title):
        return ""
    return title


def _document_title(page_payloads: dict[int, list[dict]], source_pdf_path: Path | None = None) -> str:
    """书名：先看原 PDF 元数据，再退回 OCR 认出的第一个标题块。
    11-20 以前只看标题块：封面是图的书（《The Interloper》）第一个标题块是第一章的 "Introduction"，通读、初译、审校、兜底收到的书名都是它。
    书库里用户改过的书名翻译阶段拿不到（stage spec 里没有），以后要的话从 spec 传进来。"""
    title = _pdf_metadata_title(source_pdf_path)
    if title:
        return title
    for page_idx in sorted(page_payloads):
        for item in page_payloads[page_idx]:
            if item_normalized_sub_type(item) == "title" and _block_source(item):
                return _block_source(item)
    return ""


# ---- 写回 ----


def _mark_dead_letter(item: dict, reason: str, result: BlockResult | None) -> None:
    mark_translation_failed_policy_state(item)
    record_translation_diagnostics(
        item,
        "agent",
        {
            "item_id": item.get("item_id", ""),
            "page_idx": item.get("page_idx"),
            "route_path": ["agent", "dead_letter"],
            "fallback_to": "dead_letter_queue",
            "degradation_reason": reason,
            "final_status": "failed",
            "dead_letter": True,
            "agent_attempts": result.attempts if result is not None else 0,
            "agent_issue_codes": sorted({str(issue.get("code", "")) for issue in (result.issues if result is not None else [])}),
        },
    )


def apply_agent_results(
    page_payloads: dict[int, list[dict]],
    results: dict[str, BlockResult],
    marks_by_block: dict[str, dict[str, str]],
) -> set[int]:
    """agent 的块结果写回模板记录，返回改动了的页。"""
    items_by_id = {str(item.get("item_id") or ""): (page_idx, item) for page_idx, items in page_payloads.items() for item in items}
    changed: set[int] = set()
    touched_units: dict[str, list[dict]] = {}
    for block_id, result in results.items():
        if block_id not in items_by_id:
            continue
        page_idx, item = items_by_id[block_id]
        if not item.get("should_translate", True):
            continue
        changed.add(page_idx)
        unit_id = str(item.get("translation_unit_id") or "")
        is_member = is_group_unit_id(unit_id) and len(item.get("translation_unit_member_ids") or []) > 1
        if result.status == STATUS_FALLBACK_SOURCE or not result.translation:
            _mark_dead_letter(item, "agent_fallback_source", result)
            continue
        marks = dict(marks_by_block.get(block_id, {}))
        if is_member:
            # 中文语序会把角标挪过切点：用整组的角标表（2026-10-31 ACS 论文第 2 页 {{fn:28-32}} 露在了前一块）
            for member_id in item.get("translation_unit_member_ids") or []:
                for number, original in marks_by_block.get(member_id, {}).items():
                    marks.setdefault(number, original)
        text = _restore_marks(result.translation, marks)
        apply_revised_member_text(item, text, single_unit=not is_member)
        record_translation_diagnostics(
            item,
            "agent",
            {
                "route_path": ["agent"],
                "agent_status": result.status,
                "agent_attempts": result.attempts,
                "agent_issue_codes": sorted({str(issue.get("code", "")) for issue in result.issues}),
            },
        )
        if is_member:
            touched_units[unit_id] = [items_by_id[m][1] for m in item.get("translation_unit_member_ids") or [] if m in items_by_id]
    # 接续组：成员各自的译文写好后，整组的 translation_unit_* / group_* 用成员译文拼起来重建（和人工改译文一样）
    for members in touched_units.values():
        apply_revised_unit_text(members, join_unit_text([str(member.get("protected_translated_text") or "") for member in members]))
        changed.update(items_by_id[str(member.get("item_id"))][0] for member in members)
    return changed


def _mark_unanswered(page_payloads: dict[int, list[dict]]) -> set[int]:
    """要翻却没拿到结果的块（不该发生，兜底）：标成死信，不让发布门槛卡住整份文档。"""
    changed: set[int] = set()
    for page_idx, items in page_payloads.items():
        for item in items:
            if not item.get("should_translate", True) or str(item.get("final_status") or ""):
                continue
            if not _block_source(item):
                continue
            _mark_dead_letter(item, "agent_no_result", None)
            changed.add(page_idx)
    return changed


# ---- 状态目录 ----


def _prepare_state_dir(state_dir: Path, pages: list[PageInput], model: str) -> None:
    """状态目录对应这份文档和这个引擎版本：块 id、原文、模型、版本有一样变了就清掉重来（不沿用别的输入的进度）。
    请求缓存不在这里（各任务共用），不受影响。"""
    digest = hashlib.sha256()
    for page in pages:
        for block in page.blocks:
            digest.update(json.dumps([page.page_label, block.id, block.text, block.translate, block.group, block.formula_before], ensure_ascii=False, sort_keys=True).encode("utf-8"))
    fingerprint = {"pages": digest.hexdigest(), "model": model, **agent_engine_identity()}
    path = state_dir / STATE_FINGERPRINT
    try:
        current = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        current = None
    if current != fingerprint and state_dir.exists():
        shutil.rmtree(state_dir)
    state_dir.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(fingerprint, ensure_ascii=False) + "\n", encoding="utf-8")


# ---- 用量 ----

USAGE_LABELS = {"translator": "agent-translate", "reviser": "agent-revise", "reader": "agent-read", "reviewer": "agent-review"}


class _UsageRecorder:
    """agent 每次真发出去的请求（缓存命中的不算）记一行用量台账。

    `connections`：模型 → (地址, 要不要在这里记)。OpenAI 协议的连接由共用请求层自己记，这里不记；编辑另配了模型时按请求的模型找连接。
    """

    def __init__(self, agent: TranslationAgent, *, connections: dict[str, tuple[str, bool]]) -> None:
        self.agent = agent
        self.connections = connections
        self.recorded = 0

    def flush(self) -> None:
        for call in self.agent.calls[self.recorded :]:
            model = str(call.get("model") or "")
            base_url, enabled = self.connections.get(model, ("", False))
            if call.get("cached") or not enabled:
                continue
            record_model_usage(
                anthropic_usage({"usage": call.get("usage")}),
                model=model,
                base_url=base_url,
                protocol="anthropic",
                request_label=f"{USAGE_LABELS.get(str(call.get('role') or ''), 'agent-translate')} {call.get('label', '')}",
            )
        self.recorded = len(self.agent.calls)


# ---- 入口 ----


def agent_effort(*, base_url: str, model: str) -> str | None:
    """初译、重翻、改稿的思考档位：和 legacy 同一套换算（任务的 thinking → ``model_wire.anthropic_thinking_candidates``），
    off / auto（claude-haiku-5-5）都是 low。2026-10-31 论文 16 页各两遍：low 和 medium 公式外露、`$` 不成对、漏交都是 0，
    输出 token 少 32%、每页快 30%。None 是不发字段（模型默认）。"""
    profile = model_wire.resolve_profile(base_url=base_url, model=model)
    fields = model_wire.anthropic_thinking_candidates(profile.thinking, model=model)[0]
    effort = (fields.get("output_config") or {}).get("effort")
    return str(effort) if effort else None


def _is_anthropic(*, base_url: str, model: str) -> bool:
    profile = model_wire.registered_profile(base_url=base_url, model=model)
    return profile is None or profile.protocol == model_wire.PROTOCOL_ANTHROPIC


def _upstream_wait_reporter(base_url: str) -> Callable[[dict | None], None]:
    """Anthropic 协议的请求被服务商限流退避等待时，往任务进度里报「等待中」/「等完了」（OpenAI 两种协议走共用请求层，那边自己报）。"""
    provider = vendor_for_base_url(base_url)
    reported = threading.local()

    def on_wait(wait: dict | None) -> None:
        if wait is None:
            if getattr(reported, "active", False):
                reported.active = False
                end_upstream_wait(user_stage="translation")
            return
        info = build_wait_info(
            provider=provider,
            http_status=int(wait.get("http_status") or 429),
            wait_s=float(wait.get("retry_after_s") or 0.0),
            attempt=wait.get("attempt"),
            max_attempts=wait.get("max_attempts"),
            code=str(wait.get("code") or ""),
            wait_source=str(wait.get("wait_source") or ""),
        )
        reported.active = begin_upstream_wait(user_stage="translation", info=info)

    return on_wait


def _connection_transport(*, api_key: str, model: str, base_url: str) -> Callable[[dict], dict]:
    """按阶段入口登记的协议选：Anthropic 走 agent 自己的 Messages 请求，OpenAI 两种协议走共用请求层（agent_openai.py）。"""
    profile = model_wire.registered_profile(base_url=base_url, model=model)
    if profile is None or profile.protocol == model_wire.PROTOCOL_ANTHROPIC:
        # 429 不全是限流：按业务码认出额度用完、消费封顶，第一次就停（upstream_error_codes）；真限流等待时报进度（upstream_wait）
        return make_http_transport(
            api_key,
            url=messages_url(base_url),
            classify=agent_http_classifier,
            on_wait=_upstream_wait_reporter(base_url),
        )
    return make_openai_transport(api_key=api_key, model=model, base_url=base_url, protocol=profile.protocol)


def _route_by_model(transports: dict[str, Callable[[dict], dict]], *, default: Callable[[dict], dict]) -> Callable[[dict], dict]:
    def transport(body: dict) -> dict:
        return transports.get(str(body.get("model") or ""), default)(body)

    return transport


def _separate_reviewer(reviewer: Any, *, model: str, base_url: str) -> str | None:
    """用户另配了审校模型、而且能单独发请求时返回它的模型名；否则 None（审校、编辑也用翻译模型）。
    请求按模型名分到连接上，所以模型名和翻译模型一样（只换了地址）时没法分开，照旧用翻译模型。"""
    if reviewer is None or getattr(reviewer, "inherited", True):
        return None
    reviewer_model = str(reviewer.model or "").strip()
    if not reviewer_model or reviewer_model == model:
        return None
    if not str(reviewer.api_key or "").strip():
        print(f"agent: reviewer {reviewer_model} has no API key for {reviewer.base_url}; reviewer uses the translation model", flush=True)
        return None
    return reviewer_model


def translate_book_with_agent(
    *,
    data: dict,
    output_dir: Path,
    page_indices: range,
    api_key: str,
    workers: int,
    model: str,
    base_url: str,
    mode: str,
    classify_batch_size: int,
    skip_title_translation: bool,
    sci_cutoff_page_idx: int | None,
    sci_cutoff_block_idx: int | None,
    policy_config: TranslationPolicyConfig | None = None,
    translation_context: TranslationControlContext | None = None,
    run_diagnostics: TranslationRunDiagnostics | None = None,
    checkpoint: TranslationCheckpointSession | None = None,
    glossary_entries: list | None = None,
    reviewer: Any = None,
    transport: Callable[[dict], dict] | None = None,
    source_pdf_path: Path | None = None,
) -> tuple[dict[int, list[dict]], list[dict]]:
    """返回值和 `translate_book_with_global_continuations` 一样：（页 → 记录，每页小结）。`transport` 只给测试注入假模型。

    `reviewer`：审校模型的连接（`execution.resolve_reviewer_connection`）。用户另配了模型时，agent 的审校、编辑重写走它，
    其余（通读、初译、重翻）走翻译模型；没配就全用翻译模型。`source_pdf_path`：原 PDF，取元数据里的书名。"""
    translation_paths, page_payloads = prepare_book_payloads(
        data=data,
        output_dir=output_dir,
        page_indices=page_indices,
        api_key=api_key,
        workers=workers,
        model=model,
        base_url=base_url,
        mode=mode,
        classify_batch_size=classify_batch_size,
        skip_title_translation=skip_title_translation,
        sci_cutoff_page_idx=sci_cutoff_page_idx,
        sci_cutoff_block_idx=sci_cutoff_block_idx,
        policy_config=policy_config,
        translation_context=translation_context,
        run_diagnostics=run_diagnostics,
        checkpoint=checkpoint,
    )
    statuses_before = {idx: [item.get("final_status") for item in items] for idx, items in page_payloads.items()}
    skipped = skip_back_matter(page_payloads, source_pdf_path)
    if any(skipped.values()):
        print(f"book: agent keeps original for running headers={skipped['running_header']} index blocks={skipped['index']}", flush=True)
    nothing = skip_nothing_to_translate(page_payloads)
    if nothing:
        print(f"book: agent keeps original for blocks with nothing to translate {nothing}", flush=True)
    # 标成保留原文的页当场存盘：以前只存 agent 交回结果的页，整页都保留原文的（书后索引、书名页）存下来的还是「要翻、没状态」
    marked = {idx for idx, items in page_payloads.items() if [item.get("final_status") for item in items] != statuses_before.get(idx)}
    if marked:
        save_pages(page_payloads, translation_paths, marked)
    pages, marks_by_block = build_agent_pages(page_payloads, data, document_title=_document_title(page_payloads, source_pdf_path))
    model = (model or "").strip() or DEFAULT_MODEL
    reviewer_model = _separate_reviewer(reviewer, model=model, base_url=base_url)
    state_dir = Path(output_dir) / AGENT_STATE_DIR
    structure = agent_structure()
    # 编辑另配的模型、按节翻也算进指纹：换了编辑模型、切换翻译结构重试时从头做，不沿用旧的页
    fingerprint = model if reviewer_model is None else f"{model}+reviewer:{reviewer_model}"
    _prepare_state_dir(state_dir, pages, fingerprint if structure == "page" else f"{fingerprint}+structure:{structure}")
    # 请求缓存以前只增不减（2026-11-02 起默认 90 天过期，RETAIN_AGENT_REQUEST_CACHE_TTL_DAYS=0 关掉）
    prune_expired_once(
        paths.AGENT_REQUEST_CACHE_DIR,
        ttl=ttl_seconds("RETAIN_AGENT_REQUEST_CACHE_TTL_DAYS", 90),
        label="agent request cache",
    )
    # 协议看阶段入口登记的连接（任务的 api_protocol）；没登记过的（老入口、开发工具）照以前一律按 Anthropic
    anthropic = _is_anthropic(base_url=base_url, model=model)
    connections = {model: (base_url, anthropic)}
    if reviewer_model is not None:
        connections[reviewer_model] = (reviewer.base_url, _is_anthropic(base_url=reviewer.base_url, model=reviewer_model))
    if transport is None:
        transport = _connection_transport(api_key=api_key, model=model, base_url=base_url)
        if reviewer_model is not None:
            transport = _route_by_model(
                {reviewer_model: _connection_transport(api_key=reviewer.api_key, model=reviewer_model, base_url=reviewer.base_url)},
                default=transport,
            )
    agent = TranslationAgent(
        model=model,
        models={"reviewer": reviewer_model} if reviewer_model is not None else None,
        transport=transport,
        cache_dir=paths.AGENT_REQUEST_CACHE_DIR,
        # OpenAI 协议的思考档位由共用请求层按任务的 thinking 换算，请求体里不带 Anthropic 的思考字段
        effort=agent_effort(base_url=base_url, model=model) if anthropic else None,
    )
    # OpenAI 协议的请求由共用请求层自己记用量台账，这里再记就重了
    usage = _UsageRecorder(agent, connections=connections)
    run = DocumentRun(
        agent,
        state_dir / RUN_DIR,
        glossary=glossary_from_entries(glossary_entries or []),
        read_first=True,
        review=True,
        structure=structure,
    )

    total_blocks = sum(len(page.to_translate()) for page in pages)
    progress = {"blocks": 0, "pages": 0}
    if run_diagnostics is not None:
        run_diagnostics.mark_phase_start(SUBSTAGE)
    emit_stage_transition(stage="translating", substage=SUBSTAGE, message="开始翻译（翻译 agent：先通读全文，再逐页翻译和审校）")
    print(f"book: agent engine pages={len(pages)} blocks={total_blocks} model={model}", flush=True)

    def on_page(index: int, page: PageInput, results: dict[str, BlockResult]) -> None:
        changed = apply_agent_results(page_payloads, results, marks_by_block)
        if changed:
            save_pages(page_payloads, translation_paths, changed)
            if checkpoint is not None:
                checkpoint.update("translating", page_payloads, translation_paths, detect_item_changes=True)
        usage.flush()
        progress["blocks"] += len(page.to_translate())
        progress["pages"] += 1
        emit_stage_progress(
            stage="translating",
            substage=SUBSTAGE,
            message=f"已翻译 {progress['blocks']}/{total_blocks} 块，{progress['pages']}/{len(pages)} 页",
            progress_current=progress["blocks"],
            progress_total=total_blocks,
            payload={
                "substage": SUBSTAGE,
                "progress_unit": "block",
                "engine": "agent",
                "completed_page_count": progress["pages"],
                "page_count": len(pages),
                "page_label": page.page_label,
            },
        )

    try:
        outcome = run.run(pages, on_page=on_page)
    finally:
        usage.flush()
        if run_diagnostics is not None:
            run_diagnostics.mark_phase_end(SUBSTAGE)
    if outcome.status != "done":
        raise _stopped_error(outcome)
    changed = _mark_unanswered(page_payloads)
    if changed:
        save_pages(page_payloads, translation_paths, changed)
    if checkpoint is not None:
        checkpoint.update("validating", page_payloads, translation_paths, detect_item_changes=True)
    print(
        f"book: agent engine done requests={agent.usage.requests} cached={agent.usage.cached} "
        f"input_tokens={agent.usage.input_tokens} output_tokens={agent.usage.output_tokens} glossary_version={outcome.glossary.version}",
        flush=True,
    )
    translated_pages_map = {page_idx: load_translations(translation_paths[page_idx]) for page_idx in sorted(page_payloads)}
    summaries = build_page_summaries(translated_pages_map=translated_pages_map, translation_paths=translation_paths)
    return translated_pages_map, summaries


__all__ = [
    "EDITORIAL_EVENTS_RELATIVE_PATH",
    "AgentAuthFailed",
    "AgentModelUnavailable",
    "AgentQuotaExhausted",
    "AgentRegionUnsupported",
    "AgentRunStopped",
    "agent_engine_identity",
    "apply_agent_results",
    "build_agent_pages",
    "messages_url",
    "agent_effort",
    "translate_book_with_agent",
]
