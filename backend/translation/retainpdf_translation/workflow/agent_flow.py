"""翻译引擎 agent（任务的 translation.engine=agent）：逐页翻交给 retainpdf-translation-agent，其余照旧。

和现有流程（legacy）共用前半段 `book_flow.prepare_book_payloads`（读每页模板、接续段、页面策略），也共用后面的
清单、质检、断点收尾（`execution_runner`）；只替换"逐页翻"那一步：

- 每页模板记录 → agent 的 `PageInput`：类别按规范化文档的 sub_type 换成 agent 的分类，原文用 `$…$` 直写公式
  （agent 引擎强制 math_mode=direct_typst），参考文献角标 "$ ^{40} $" 换成脚注标记 `{{fn:40}}`、写回时换回去；
  接续组（`__cg__:` 单元）整组放进组头那一页。
- `DocumentRun` 整篇顺序翻：先通读（体裁、术语、人名、标题），每页翻完审校。状态（续跑用）在翻译目录的 `agent/` 下，
  换了文档或引擎版本（提示词、交接格式、检查规则）就清掉重来。请求缓存各任务共用（`paths.AGENT_REQUEST_CACHE_DIR`），
  键是整个请求体的哈希：重试翻译会新建任务，问过的一模一样的请求不再花钱。注意每页的请求带着上一页的译文作上下文，
  哪一页的译文变了，后面各页的请求也跟着变，要重新问。调度同时写编辑部事件 `agent/run/events.jsonl`（editorial.v1），
  前端「进度」面板的编辑部画面从 `GET /api/v1/jobs/:job_id/progress/editorial` 读它。
- 每页做完：译文写回模板记录（单块和 `revision.py` 一样用 `apply_revised_member_text`，接续组再重建整组字段），
  落盘、提交断点（实时译文照常），发 `translation_batches` 进度，记用量台账。
- agent 交回 `fallback_source`（重翻还不合格）的块：标成死信（保留原文，不卡发布，任务完成时提示有几块没翻）。
- 额度用完、密钥不对、一直限流：保存进度后让这一阶段失败，重试时从断点接着跑。

模型请求用任务的密钥和地址（`make_http_transport`），不读服务器的 `ANTHROPIC_API_KEY`。
"""

from __future__ import annotations

import hashlib
import json
import re
import shutil
from pathlib import Path
from typing import TYPE_CHECKING
from typing import Callable

from retainpdf_base import paths
from retainpdf_base.events import emit_stage_progress
from retainpdf_base.events import emit_stage_transition
from retainpdf_translation.artifacts import TranslationRunDiagnostics
from retainpdf_translation.core.engine_identity import agent_engine_identity
from retainpdf_translation.core.item_reader import item_normalized_sub_type
from retainpdf_translation.core.payload import load_translations
from retainpdf_translation.core.payload.parts.apply import apply_revised_member_text
from retainpdf_translation.core.payload.parts.apply import apply_revised_unit_text
from retainpdf_translation.core.payload.parts.apply import join_unit_text
from retainpdf_translation.core.payload.parts.common import is_group_unit_id
from retainpdf_translation.core.payload.parts.diagnostics import record_translation_diagnostics
from retainpdf_translation.core.payload.parts.policy_state import mark_translation_failed_policy_state
from retainpdf_translation.llm.shared.control_context import TranslationControlContext
from retainpdf_translation.llm.shared.model_wire import anthropic_usage
from retainpdf_translation.llm.shared.usage_ledger import record_model_usage
from retainpdf_translation.services.policy import TranslationPolicyConfig
from retainpdf_translation.workflow.book_flow import prepare_book_payloads
from retainpdf_translation.workflow.page_policies import build_page_summaries
from retainpdf_translation.workflow.pages import save_pages
from retainpdf_translation_agent import DEFAULT_MODEL
from retainpdf_translation_agent import EVENTS_FILE
from retainpdf_translation_agent import STATUS_FALLBACK_SOURCE
from retainpdf_translation_agent import BlockInput
from retainpdf_translation_agent import BlockResult
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
# OCR 把参考文献的上标角标写成公式 "$ ^{48-50} $"：交给 agent 前换成脚注标记（受保护、丢了查得出），写回时换回原样
CITATION_SUPERSCRIPT_RE = re.compile(r"\$\s*\^\s*\{\s*([\d\s,–\-]+?)\s*\}\s*\$")
FN_TOKEN_RE = re.compile(r"\{\{fn:([^{}]+)\}\}")


class AgentRunStopped(RuntimeError):
    """额度用完、密钥不对、一直限流：进度已保存，修好后重试这个任务会从断点接着翻。"""


def messages_url(base_url: str) -> str:
    """任务的 base_url（如 https://api.anthropic.com/v1）→ Messages 接口地址。"""
    base = (base_url or "").strip().rstrip("/")
    if not base:
        return "https://api.anthropic.com/v1/messages"
    return base if base.endswith("/messages") else f"{base}/messages"


# ---- 模板记录 → PageInput ----


def _block_source(item: dict) -> str:
    """这一块自己的原文（直写公式下就是带 `$…$` 的原文）。不走 item_source_text 的完整链：那条链给接续组成员的是整组原文，
    agent 要的是每块各自的原文，接续组由它自己按 [[BREAK]] 合起来翻、再分回各块。"""
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
    """交给 agent 的原文和换掉的角标（脚注标记 → 原来的公式写法）。"""
    text = _block_source(item)
    marks: dict[str, str] = {}
    if cls in ("display_formula", "formula_number"):
        return text, marks

    def to_mark(match: re.Match) -> str:
        number = re.sub(r"\s+", "", match.group(1))
        marks.setdefault(number, match.group(0))
        return "{{fn:" + number + "}}"

    return CITATION_SUPERSCRIPT_RE.sub(to_mark, text), marks


def _restore_marks(text: str, marks: dict[str, str]) -> str:
    if not marks:
        return text
    return FN_TOKEN_RE.sub(lambda m: marks.get(m.group(1), m.group(0)), text)


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


def _document_title(page_payloads: dict[int, list[dict]]) -> str:
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
        text = _restore_marks(result.translation, marks_by_block.get(block_id, {}))
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
            digest.update(json.dumps([page.page_label, block.id, block.text, block.translate, block.group], ensure_ascii=False, sort_keys=True).encode("utf-8"))
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
    """agent 每次真发出去的请求（缓存命中的不算）记一行用量台账。"""

    def __init__(self, agent: TranslationAgent, *, base_url: str) -> None:
        self.agent = agent
        self.base_url = base_url
        self.recorded = 0

    def flush(self) -> None:
        for call in self.agent.calls[self.recorded :]:
            if call.get("cached"):
                continue
            record_model_usage(
                anthropic_usage({"usage": call.get("usage")}),
                model=str(call.get("model") or ""),
                base_url=self.base_url,
                protocol="anthropic",
                request_label=f"{USAGE_LABELS.get(str(call.get('role') or ''), 'agent-translate')} {call.get('label', '')}",
            )
        self.recorded = len(self.agent.calls)


# ---- 入口 ----


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
    transport: Callable[[dict], dict] | None = None,
) -> tuple[dict[int, list[dict]], list[dict]]:
    """返回值和 `translate_book_with_global_continuations` 一样：（页 → 记录，每页小结）。`transport` 只给测试注入假模型。"""
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
    pages, marks_by_block = build_agent_pages(page_payloads, data, document_title=_document_title(page_payloads))
    model = (model or "").strip() or DEFAULT_MODEL
    state_dir = Path(output_dir) / AGENT_STATE_DIR
    _prepare_state_dir(state_dir, pages, model)
    agent = TranslationAgent(
        model=model,
        transport=transport or make_http_transport(api_key, url=messages_url(base_url)),
        cache_dir=paths.AGENT_REQUEST_CACHE_DIR,
    )
    usage = _UsageRecorder(agent, base_url=base_url)
    run = DocumentRun(agent, state_dir / RUN_DIR, glossary=glossary_from_entries(glossary_entries or []), read_first=True, review=True)

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
        raise AgentRunStopped(
            f"translation agent stopped: reason={outcome.stop_reason} pages_done={outcome.pages_done}/{outcome.pages_total}"
        )
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
    "AgentRunStopped",
    "agent_engine_identity",
    "apply_agent_results",
    "build_agent_pages",
    "messages_url",
    "translate_book_with_agent",
]
