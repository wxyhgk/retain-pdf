import re


CLASSIFY_BLOCK_TYPES = {"text", "title", "list"}
NATURAL_WORD_RE = re.compile(r"[A-Za-z]{3,}")
FILE_OR_FLAG_RE = re.compile(r"(^|\s)(-{1,2}[A-Za-z0-9][\w.-]*|[A-Za-z0-9_.-]+\.[A-Za-z0-9]{1,6})(?=\s|$)")
ASSIGNMENT_RE = re.compile(r"\b[A-Z][A-Z_ ]{1,}\s*=\s*[\w.+-]+")
COORD_LINE_RE = re.compile(r"^[A-Z][a-z]?\s+-?\d+\.\d+\s+-?\d+\.\d+\s+-?\d+\.\d+$")
PATHISH_RE = re.compile(r"[./\\][\w./\\-]+|[\w.-]+/[\w./\\-]+")
SHORT_FLAG_LINE_RE = re.compile(r"^-[A-Za-z][\w-]*(?:\s*<[^<>\n]+>)?$")
COMMAND_LINE_RE = re.compile(r"^[A-Za-z][\w.-]*(?:\s+-[\w-]+(?:\s+[^\s].*)?)?$")
COMMAND_TITLE_RE = re.compile(r"^[A-Za-z][\w.-]*\s+<[^<>\n]+>$")


def should_include(item: dict) -> bool:
    text = item.get("source_text", "").strip()
    return bool(text) and item.get("block_type", "unknown") in CLASSIFY_BLOCK_TYPES


def _code_line_score(line: str) -> int:
    score = 0
    stripped = line.strip()
    if not stripped:
        return score
    if COORD_LINE_RE.match(stripped):
        score += 4
    if FILE_OR_FLAG_RE.search(stripped):
        score += 2
    if ASSIGNMENT_RE.search(stripped):
        score += 3
    if PATHISH_RE.search(stripped):
        score += 1
    if re.search(r"[<>]|=>|::|\|\||&&", stripped):
        score += 2
    if re.search(r"\b\d+\.\d+\b", stripped):
        score += 1
    if sum(1 for ch in stripped if ch in "{}[]()_=:/\\.-+") >= 5:
        score += 2
    tokens = stripped.split()
    short_tokens = sum(1 for token in tokens if len(token) <= 3)
    if tokens and short_tokens / len(tokens) >= 0.55:
        score += 1
    return score


def rule_label(item: dict) -> str:
    text = " ".join((item.get("source_text", "") or "").split())
    if not text:
        return "translate"
    role = item.get("metadata", {}).get("structure_role", "")

    line_texts = [line for line in item.get("line_texts", []) if line]
    line_count = len(line_texts)
    code_scores = [_code_line_score(line) for line in line_texts]
    strong_code_lines = sum(1 for score in code_scores if score >= 4)
    total_code_score = sum(code_scores)
    natural_words = len(NATURAL_WORD_RE.findall(text))
    is_title = item.get("block_type") == "title"

    if role in {"index_entry", "option_header", "example_line"}:
        return "code"
    if role in {"option_description", "example_intro"}:
        return "translate"
    if is_title and COMMAND_TITLE_RE.fullmatch(text):
        return "code"
    if line_count <= 2 and all(SHORT_FLAG_LINE_RE.fullmatch(line.strip()) for line in line_texts):
        return "code"
    if line_count == 1 and COMMAND_LINE_RE.fullmatch(text) and (" -" in text or text.count(" ") >= 1) and natural_words <= 4:
        return "code"
    if line_count >= 3 and strong_code_lines >= max(2, line_count - 1):
        return "code"
    if line_count >= 2 and total_code_score >= 8 and natural_words <= 6:
        return "code"
    if line_count == 1 and total_code_score >= 6 and natural_words <= 4:
        return "code"
    return "review"
