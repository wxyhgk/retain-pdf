"""接续组当一块翻：被分栏、分页拆开的同一段话，进 agent 前合成一块，翻译、校验、重翻、审校、退回原文都按整段算，
交回前才按原文比例切回各块。

2026-10-31 用户定（"跨栏跨页部分如何更优雅"）。以前整段翻完马上切开、再逐块校验：中文语序把内容挪过切点，
一块"太短"、标记"丢了"，要一串补丁替它开脱（整组不短只记警告、标记挪到另一块只记警告、占比偏了记警告）；
一块判错就只退回那一块，一段话前半中文、后半英文。现在切开以后不再查，一组要么整段是译文，要么整段退回原文。
"""

from __future__ import annotations

from dataclasses import replace

from retainpdf_translation_agent.breaks import move_leading_punctuation
from retainpdf_translation_agent.breaks import split_at_formulas
from retainpdf_translation_agent.breaks import split_by_ratio
from retainpdf_translation_agent.checks import prose_length
from retainpdf_translation_agent.contract import BlockInput
from retainpdf_translation_agent.contract import BlockResult
from retainpdf_translation_agent.contract import PageInput


def merge_groups(page: PageInput) -> tuple[PageInput, dict[str, list[BlockInput]]]:
    """这一页要翻的接续组各合成一块（id 用组号、原文接成一整段、放在组里第一块的位置），返回（合好的页，组号 → 按顺序的各块）。
    组里只有一块要翻的（别的块不用翻）就当普通的块。"""
    found: dict[str, list[BlockInput]] = {}
    for block in page.to_translate():
        if block.group:
            found.setdefault(block.group["id"], []).append(block)
    groups = {group_id: sorted(members, key=lambda b: b.group["index"]) for group_id, members in found.items() if len(members) > 1}
    group_of = {member.id: group_id for group_id, members in groups.items() for member in members}
    alone = {members[0].id for group_id, members in found.items() if group_id not in groups}
    blocks: list[BlockInput] = []
    for block in page.blocks:
        group_id = group_of.get(block.id)
        if group_id is None:
            blocks.append(replace(block, group=None) if block.id in alone else block)
        elif block.id == groups[group_id][0].id:
            blocks.append(_merged(group_id, groups[group_id]))
    return replace(page, blocks=blocks), groups


def _merged(group_id: str, members: list[BlockInput]) -> BlockInput:
    head = members[0]
    return BlockInput(
        id=group_id,
        cls=head.cls,
        text=_join_members(members),
        translate=True,
        where=" → ".join(m.where for m in members),
        cls_label=head.cls_label,
        source_lang=head.source_lang,
        relations=head.relations,
        attributes=head.attributes,
        members=[m.id for m in members],
    )


def _join_members(members: list[BlockInput]) -> str:
    """各块原文用空格接起来；两块之间夹着独立公式的（`formula_before`），公式原文放在中间、各占一行。"""
    text = ""
    for member in members:
        if not text:
            text = member.text
        elif member.formula_before.strip():
            text = f"{text}\n{member.formula_before.strip()}\n{member.text}"
        else:
            text = f"{text} {member.text}"
    return text


def _split_members(translation: str, members: list[BlockInput]) -> list[str]:
    weights = [max(1, prose_length(m.text)) for m in members]
    return list(move_leading_punctuation([p.strip() for p in split_by_ratio(translation, weights)]))


def split_units(results: dict[str, BlockResult], groups: dict[str, list[BlockInput]]) -> dict[str, BlockResult]:
    """合成的块切回各块：译文按原文各块的正文长度比例，在附近的中文标点处切开（`breaks.split_by_ratio`，不切开公式和标记），
    后一块以标点开头的，标点挪回前一块末尾。问题、状态、历史各块照抄整段的（说的是这一整段），`meta.unit_id` 记组号。
    退回原文的整组各块都退回。"""
    out: dict[str, BlockResult] = {}
    for result_id, result in results.items():
        members = groups.get(result_id)
        if not members:
            out[result_id] = result
            continue
        if result.translation is None:
            parts: list[str | None] = [None] * len(members)
        else:
            # 夹着独立公式的先在公式处切开（公式删掉，它在版面上单独一块），每段再按比例切给其中的几块
            pieces = split_at_formulas(result.translation, [m.formula_before for m in members]) or [(result.translation, 0, len(members))]
            parts = [part for piece, start, end in pieces for part in _split_members(piece, members[start:end])]
        for member, part in zip(members, parts):
            meta = dict(result.meta or {}, unit_id=result_id)
            out[member.id] = BlockResult(member.id, part, list(result.issues), result.attempts, result.status, list(result.history), meta)
    return out
