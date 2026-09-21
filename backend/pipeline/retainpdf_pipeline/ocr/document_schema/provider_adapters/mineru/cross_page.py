from __future__ import annotations

"""Undo MinerU's semantic paragraph merges before assigning physical PDF pages.

Cross-page spans keep coordinates from their physical page, not from the
paragraph's owning page. Resolve them against preproc_blocks; geometry alone
cannot distinguish an ordinary out-of-block line from a different PDF page.
"""

from collections import Counter, defaultdict
from copy import deepcopy

from .geometry import valid_bbox
from .text import iter_child_blocks, iter_direct_lines, iter_spans


def _blocks(blocks: list[dict], prefix: str):
    for index, block in enumerate(blocks):
        if not isinstance(block, dict):
            continue
        path = f"{prefix}/{index}"
        yield block, path
        if not block.get("lines_deleted"):
            yield from _blocks(iter_child_blocks(block), f"{path}/blocks")


def _spans(block: dict) -> list[dict]:
    return [
        span
        for line in iter_direct_lines(block)
        for span in iter_spans(line.get("spans"))
    ]


def _key(span: dict) -> tuple:
    bbox = valid_bbox(span.get("bbox"))
    if bbox is None:
        raise ValueError("MinerU cross-page recovery requires a valid span bbox")
    return (span.get("type"), str(span.get("content", "")), tuple(bbox))


def _without_cross_page_lines(block: dict) -> None:
    lines = []
    for line in iter_direct_lines(block):
        spans = list(iter_spans(line.get("spans")))
        if not any(span.get("cross_page") for span in spans):
            lines.append(line)
            continue
        remaining = [span for span in spans if not span.get("cross_page")]
        if remaining:
            boxes = [valid_bbox(span.get("bbox")) for span in remaining]
            if any(box is None for box in boxes):
                raise ValueError(
                    "MinerU cross-page recovery requires valid remaining span bboxes"
                )
            lines.append(
                {
                    **line,
                    "spans": remaining,
                    "bbox": [
                        min(b[0] for b in boxes),
                        min(b[1] for b in boxes),
                        max(b[2] for b in boxes),
                        max(b[3] for b in boxes),
                    ],
                }
            )
    block["lines"] = lines
    if not lines:
        block["lines_deleted"] = True


def restore_cross_page_spans(pages: list[dict]) -> tuple[list[dict], dict]:
    """Return a non-mutating, evidence-backed page projection or fail explicitly.

    Only pages with explicit cross_page spans take the recovery path. Preproc
    spans are indexed once; repeated text or missing evidence must not silently
    turn into guessed page assignments. Unrelated deleted shells stay deleted.
    """
    merged = [
        (page_index, path, block)
        for page_index, page in enumerate(pages)
        for field in ("para_blocks", "discarded_blocks")
        for block, path in _blocks(
            page.get(field, []) or [], f"/pdf_info/{page_index}/{field}"
        )
        if not block.get("lines_deleted")
        and any(span.get("cross_page") for span in _spans(block))
    ]
    if not merged:
        return pages, {}

    pages = deepcopy(pages)
    physical = defaultdict(list)
    roots = {}
    for page_index, page in enumerate(pages):
        roots[page_index] = list(
            _blocks(
                page.get("para_blocks", []) or [], f"/pdf_info/{page_index}/para_blocks"
            )
        )
        for block, path in _blocks(
            page.get("preproc_blocks", []) or [],
            f"/pdf_info/{page_index}/preproc_blocks",
        ):
            for span in _spans(block):
                if (
                    not span.get("cross_page")
                    and valid_bbox(span.get("bbox")) is not None
                ):
                    physical[_key(span)].append((page_index, path, block))

    plans = {}
    for source_page, source_path, block in merged:
        for span in _spans(block):
            if not span.get("cross_page"):
                continue
            # physical[...] 是按 span 逐条 append 的:同一段里出现两个完全一样的
            # span(同 type、同 content、同 bbox —— 一段里重复出现同一个公式就是
            # 这样)会塞进两条,但**两条指向同一个 block**。
            #
            # 这道检查本意是拦「页面归属不明确」,即同样内容出现在不同页/不同段。
            # 去重前它分不清这两件事,于是「同段两个一样的公式」被误判成歧义直接抛。
            # 按目标身份(页号 + preproc 路径)去重之后,只有真正落在不同 block 上
            # 才算歧义。
            matches = {
                (entry[0], entry[1]): entry
                for entry in physical[_key(span)]
                if entry[0] > source_page
            }
            if len(matches) != 1:
                raise ValueError(
                    f"MinerU cross-page span at {source_path} has {len(matches)} physical matches; "
                    "cannot safely assign its PDF page"
                )
            target_page, preproc_path, original = next(iter(matches.values()))
            plan = plans.setdefault(
                preproc_path,
                {
                    "page": target_page,
                    "original": original,
                    "spans": Counter(),
                    "sources": set(),
                },
            )
            plan["spans"][_key(span)] += 1
            plan["sources"].add(source_path)

    # Strip only explicitly marked spans, including when a recovered page also
    # owns the next cross-page paragraph. Do not change ordinary orphan lines.
    for page_index, page in enumerate(pages):
        for field in ("para_blocks", "discarded_blocks"):
            for block, _path in _blocks(
                page.get(field, []) or [], f"/pdf_info/{page_index}/{field}"
            ):
                if any(span.get("cross_page") for span in _spans(block)):
                    _without_cross_page_lines(block)

    for preproc_path, plan in plans.items():
        original = plan["original"]
        candidates = [
            block
            for block, _path in roots[plan["page"]]
            if block.get("type") == original.get("type")
            and block.get("index") == original.get("index")
            and valid_bbox(block.get("bbox")) == valid_bbox(original.get("bbox"))
        ]
        if len(candidates) != 1:
            raise ValueError(
                f"MinerU cross-page recovery has no unique paragraph for {preproc_path}"
            )
        target = candidates[0]
        existing = (
            Counter(_key(span) for span in _spans(target))
            if not target.get("lines_deleted")
            else Counter()
        )
        expected = Counter(_key(span) for span in _spans(original))
        # 这道检查的名字就是它的语义:**证据有没有覆盖全**。恢复动作是把 target 的
        # lines 整体换成 original 的,所以不需要「正好等于」,只需要「没有缺口」。
        #
        # 原来写的是 `existing | plan["spans"] != expected`(逐键 max)。两种写法各自
        # 只对一半:
        #   - 取 max:段落被跨页切开、两半各有一个**完全一样**的 span 时,
        #     existing=1 / plan=1 → max 仍是 1,而 expected=2 → 误报缺口。
        #   - 改成相加:目标页已经有完整尾巴的幂等重跑会算成超量 → 同样误报。
        # 单个 span 时两种写法恰好都对,所以这个分歧只有重复 key 才暴露。
        #
        # Counter 减法只保留正数,所以 shortfall 非空 ⟺ 确实有 span 没被任何证据覆盖。
        # 超量(幂等重跑)不算缺口,被容忍。
        shortfall = expected - (existing + plan["spans"])
        if shortfall:
            raise ValueError(
                f"MinerU cross-page recovery has incomplete span coverage for {preproc_path}"
            )
        target["lines"] = deepcopy(original.get("lines", []))
        target.pop("lines_deleted", None)
        target["_retainpdf_cross_page_recovery"] = {
            "cross_page_recovered_span_count": sum(plan["spans"].values()),
            "cross_page_source_paths": sorted(plan["sources"]),
            "cross_page_physical_path": preproc_path,
        }

    return pages, {
        "cross_page_recovered_block_count": len(plans),
        "cross_page_recovered_span_count": sum(
            sum(plan["spans"].values()) for plan in plans.values()
        ),
    }
