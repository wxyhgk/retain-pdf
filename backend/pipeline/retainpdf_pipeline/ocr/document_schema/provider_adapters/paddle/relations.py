from __future__ import annotations

from html import unescape
import re

from retainpdf_pipeline.ocr.document_schema.provider_adapters.common import classify_with_previous_anchor
from retainpdf_pipeline.ocr.document_schema.provider_adapters.paddle.block_labels import map_block_kind


_PADDLE_METADATA_TEXT_RE = re.compile(
    r"(?:^doi:|^cite this article as:|submit your manuscript here|open access|copyright|"
    r"authors declare|competing interests?|competing financial interest|funded by|received:|accepted:|published:|"
    r"supporting information is available free of charge|e-mail:|orcid)",
    re.I,
)
_PADDLE_METADATA_BULLET_RE = re.compile(
    r"^[•▪◦]\s*(?:doi:|cite this article as:|submit your manuscript here|open access|copyright|"
    r"authors declare|competing interests?|competing financial interest|funded by|received:|accepted:|published:|"
    r"supporting information is available free of charge|e-mail:|orcid)",
    re.I,
)
_ASCII_WORD_RE = re.compile(r"[A-Za-z0-9]+(?:[-'][A-Za-z0-9]+)?")
# 文末只有参考文献区的标题留原文：它下面的条目本身就不翻译（reference_content → skip_translation），
# 标题跟条目一起保持英文。致谢 / 作者贡献 / 利益声明 / 资助等小标题下面的正文都会翻译，
# 小标题也必须翻译——原来把其中几个（而且只认美式拼写）判 metadata，同一页中英混杂，
# 也和 MinerU（一律判 heading 并翻译）不一致。
# "Keywords: …" 同理不再算元数据线索：MinerU 判 body 并翻译。
_REFERENCE_SECTION_HEADINGS = {
    "reference",
    "references",
    "references and notes",
    "bibliography",
    "works cited",
    "literature cited",
}


def classify_page_blocks(parsing_res_list: list[dict]) -> list[tuple[str, str, list[str], dict]]:
    body_flow_start_order = _body_flow_start_order(parsing_res_list)

    def resolver(block: dict, previous_anchor: tuple[str, int] | None) -> tuple[str, str, list[str], dict]:
        return _resolve_block_kind(
            block,
            previous_anchor,
            order=int(block.get("__rp_order__", -1) or -1),
            body_flow_start_order=body_flow_start_order,
        )

    enriched_blocks = [
        {
            **dict(block or {}),
            "__rp_order__": order,
        }
        for order, block in enumerate(parsing_res_list or [])
    ]
    return classify_with_previous_anchor(
        enriched_blocks,
        label_getter=lambda block: str(block.get("block_label", "") or ""),
        resolver=resolver,
        anchor_getter=lambda kind: (kind[0], kind[1]),
    )


def _resolve_block_kind(
    block: dict,
    previous_anchor: tuple[str, int] | None,
    *,
    order: int,
    body_flow_start_order: int,
) -> tuple[str, str, list[str], dict]:
    raw_label = str(block.get("block_label", "") or "")
    text = str(block.get("block_content", "") or "").strip()
    label = raw_label.strip().lower()
    if label == "text" and body_flow_start_order >= 0 and 0 <= order < body_flow_start_order:
        return "text", "metadata", ["metadata", "skip_translation"], {"front_matter_text": True}
    if label == "text" and _looks_like_metadata_text(text):
        return "text", "metadata", ["metadata", "skip_translation"], {"metadata_text_cue": True}
    if label == "paragraph_title" and _looks_like_reference_section_heading(text):
        return "text", "metadata", ["metadata", "skip_translation"], {"reference_section_heading": True}
    if label == "figure_title":
        return resolve_figure_title(text=text, previous_anchor=previous_anchor)
    if label == "vision_footnote":
        return resolve_vision_footnote(text=text, previous_anchor=previous_anchor)
    return map_block_kind(raw_label, text=text)


def resolve_figure_title(
    *,
    text: str,
    previous_anchor: tuple[str, int] | None,
) -> tuple[str, str, list[str], dict]:
    del previous_anchor
    plain_text = " ".join(unescape(re.sub(r"<[^>]+>", " ", text or "")).split())
    if re.match(r"^(?:table\b|表(?:格)?\s*\d)", plain_text, flags=re.IGNORECASE):
        return "text", "table_caption", ["caption", "table_caption"], {"caption_target": "table"}
    return "text", "figure_caption", ["caption", "figure_caption"], {"caption_target": "figure"}


def resolve_vision_footnote(
    *,
    text: str,
    previous_anchor: tuple[str, int] | None,
) -> tuple[str, str, list[str], dict]:
    # 先看开头的标记，再看紧挨着的前一个块，最后才看正文里有没有整词 table / figure。以前用子串 `"table" in 文本`
    # 排在最前：stable、suitable、notable 都会把图注当成表注；图注里写「见 Table 2」也会被算到表格名下（2026-10-29 改）。
    plain_text = " ".join(unescape(re.sub(r"<[^>]+>", " ", text or "")).split())
    lowered = plain_text.lower()
    table_footnote = ("text", "table_footnote", ["footnote", "table_footnote"], {"footnote_target": "table"})
    image_footnote = ("text", "image_footnote", ["footnote", "image_footnote"], {"footnote_target": "image"})
    if lowered.startswith("表注") or re.match(r"^(?:table|tab\.)(?![a-z])", lowered):
        return table_footnote
    if lowered.startswith("图注") or re.match(r"^(?:figure|fig\.)(?![a-z])", lowered):
        return image_footnote
    if previous_anchor:
        target = previous_anchor[0]
        if target in {"table_html", "table"}:
            return table_footnote
        if target in {"image_body", "image"}:
            return image_footnote
    if re.search(r"\btables?\b", lowered):
        return table_footnote
    if re.search(r"\b(?:figures?|fig\.)(?![a-z])", lowered):
        return image_footnote
    return "text", "footnote", ["footnote"], {"footnote_target": "unknown"}


def _body_flow_start_order(parsing_res_list: list[dict]) -> int:
    has_front_matter = False
    front_matter_end_order = -1
    for order, block in enumerate(parsing_res_list or []):
        label = str((block.get("block_label", "") or "")).strip().lower()
        text = " ".join(str(block.get("block_content", "") or "").split()).strip().lower()
        if label in {"doc_title", "abstract"}:
            has_front_matter = True
            front_matter_end_order = order
            continue
        if label == "paragraph_title" and text == "abstract":
            has_front_matter = True
            front_matter_end_order = order
            continue
    if not has_front_matter:
        return -1

    for order, block in enumerate(parsing_res_list or []):
        if order <= front_matter_end_order:
            continue
        label = str((block.get("block_label", "") or "")).strip().lower()
        text = " ".join(str(block.get("block_content", "") or "").split()).strip().lower()
        if label == "paragraph_title" and text and text != "abstract" and not _looks_like_reference_section_heading(text):
            return order
        if label in {"text", "abstract"} and text and not _looks_like_metadata_text(text):
            return order
    return -1


# 线索词出现在段中时，只有短句才算元数据。版权 / 资助 / 利益声明本来就是一两句话；
# 正文顺带提到一句「copyrighted by」「funded by」「open access」很常见，原来不看长度，
# 整段正文（实测一段 189 词的方法学描述）就被当成元数据跳过、不翻译。
# 线索在开头时（"Received: …"、"Funding: …"）声明可以写得长一些，上限放宽。
_METADATA_CUE_MID_MAX_WORDS = 40
_METADATA_CUE_START_MAX_WORDS = 80


def _looks_like_metadata_text(text: str) -> bool:
    compact = " ".join((text or "").split()).strip()
    if not compact:
        return False
    if _is_short_metadata_bullet(compact):
        return True
    match = _PADDLE_METADATA_TEXT_RE.search(compact)
    if not match:
        return False
    words = _ascii_word_count(compact)
    if match.start() == 0:
        return words <= _METADATA_CUE_START_MAX_WORDS
    return words <= _METADATA_CUE_MID_MAX_WORDS


def _looks_like_reference_section_heading(text: str) -> bool:
    compact = " ".join((text or "").split()).strip().lower()
    return compact in _REFERENCE_SECTION_HEADINGS


def _ascii_word_count(text: str) -> int:
    return len(_ASCII_WORD_RE.findall(text or ""))


def _is_short_metadata_bullet(text: str) -> bool:
    compact = " ".join((text or "").split()).strip()
    if not compact or not _PADDLE_METADATA_BULLET_RE.search(compact):
        return False
    return _ascii_word_count(compact) <= 24
