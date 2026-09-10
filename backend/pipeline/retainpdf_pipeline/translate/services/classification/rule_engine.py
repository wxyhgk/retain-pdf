from retainpdf_pipeline.translate.core.item_reader import item_is_textual
from retainpdf_pipeline.translate.core.item_reader import item_is_bodylike
from retainpdf_pipeline.translate.services.policy.soft_hints import looks_like_code_literal_text_value

CLASSIFY_BLOCK_TYPES = {"text", "title", "list"}
MAX_NO_TRANS_REVIEW_CHARS = 160


def compact_source_text(item: dict) -> str:
    return " ".join(str(item.get("source_text", "") or "").split()).strip()


def is_short_no_trans_candidate(item: dict) -> bool:
    return len(compact_source_text(item)) <= MAX_NO_TRANS_REVIEW_CHARS


def looks_like_no_trans_code_candidate(item: dict) -> bool:
    text = compact_source_text(item)
    if not text:
        return False
    if looks_like_code_literal_text_value(text):
        return True
    raw_lines = str(item.get("source_text", "") or "").splitlines()
    stripped_lines = [line.strip() for line in raw_lines if line.strip()]
    if len(stripped_lines) >= 2 and sum(1 for line in stripped_lines if line.startswith(("|", "$", ">", "-"))) >= 2:
        return True
    return text.startswith(("$ ", "> ", "./", "../"))


def should_include(item: dict) -> bool:
    text = compact_source_text(item)
    if not text:
        return False
    if str(item.get("continuation_group", "") or "").strip():
        return False
    if item_is_bodylike(item) and not looks_like_no_trans_code_candidate(item):
        return False
    if not is_short_no_trans_candidate(item):
        return False
    if not item.get("should_translate", True):
        return False
    label = str(item.get("classification_label", "") or "")
    if label.startswith(("translate_", "skip_", "code")):
        return False
    return item_is_textual(item)


def rule_label(item: dict) -> str:
    return "review"
