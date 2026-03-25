from __future__ import annotations

import re


EN_WORD_RE = re.compile(r"[A-Za-z]+(?:[-'][A-Za-z]+)?")
FLAG_TOKEN_RE = re.compile(r"^-{1,2}[A-Za-z0-9][\w.-]*$")
FILE_TOKEN_RE = re.compile(r"^[A-Za-z0-9_.-]+\.[A-Za-z0-9]{1,8}$")
NUMBER_TOKEN_RE = re.compile(r"^-?\d+(?:\.\d+)?$")
COMMAND_HEAD_RE = re.compile(r"^[A-Za-z][\w.-]{0,31}$")
ARG_TOKEN_RE = re.compile(r"^<[^<>\n]+>$")

_COMMAND_OPERATORS = {">", "<", "|", "||", "&&", "2>", "1>", ">>", "=", ":"}


def normalized_source_text(item: dict) -> str:
    return " ".join((item.get("source_text") or "").split())


def extract_line_texts(item: dict) -> list[str]:
    values = [str(line).strip() for line in item.get("line_texts", []) if str(line).strip()]
    if values:
        return values
    lines: list[str] = []
    for line in item.get("lines", []) or []:
        spans = line.get("spans", []) or []
        text = " ".join(str(span.get("content", "") or "").strip() for span in spans if str(span.get("content", "") or "").strip())
        text = " ".join(text.split()).strip()
        if text:
            lines.append(text)
    return lines


def natural_word_count(text: str) -> int:
    return len([word for word in EN_WORD_RE.findall(text or "") if len(word) >= 3])


def _looks_like_command_head(token: str) -> bool:
    if not COMMAND_HEAD_RE.fullmatch(token or ""):
        return False
    return token.lower() == token or any(ch.isdigit() for ch in token) or "." in token or "-" in token


def _is_command_value_token(token: str, previous: str) -> bool:
    if not token:
        return False
    if token in _COMMAND_OPERATORS:
        return True
    if ARG_TOKEN_RE.fullmatch(token):
        return True
    if FLAG_TOKEN_RE.fullmatch(token):
        return True
    if NUMBER_TOKEN_RE.fullmatch(token):
        return True
    if FILE_TOKEN_RE.fullmatch(token):
        return True
    if any(ch in token for ch in "/\\_="):
        return True
    if previous in _COMMAND_OPERATORS:
        return True
    if previous and FLAG_TOKEN_RE.fullmatch(previous):
        return True
    return False


def _has_strong_command_prefix_evidence(tokens: list[str]) -> bool:
    if len(tokens) < 2:
        return False
    tail_tokens = tokens[1:]
    evidence = 0
    if any(FLAG_TOKEN_RE.fullmatch(token) for token in tail_tokens):
        evidence += 2
    if any(FILE_TOKEN_RE.fullmatch(token) for token in tail_tokens):
        evidence += 2
    if any(ARG_TOKEN_RE.fullmatch(token) for token in tail_tokens):
        evidence += 2
    if any(token in _COMMAND_OPERATORS for token in tokens):
        evidence += 2
    if sum(1 for token in tail_tokens if NUMBER_TOKEN_RE.fullmatch(token)) >= 2:
        evidence += 1
    if any(any(ch in token for ch in "/\\=") for token in tail_tokens):
        evidence += 1
    head = tokens[0]
    if any(ch.isdigit() for ch in head) or "." in head or "-" in head:
        evidence += 1
    return evidence >= 2


def extract_command_prefix(text: str) -> str:
    tokens = text.split()
    if len(tokens) < 3 or not _looks_like_command_head(tokens[0]):
        return ""

    consumed = 1
    previous = tokens[0]
    for token in tokens[1:]:
        if not _is_command_value_token(token, previous):
            break
        consumed += 1
        previous = token

    if consumed < 3:
        return ""
    if not _has_strong_command_prefix_evidence(tokens[:consumed]):
        return ""
    prefix = " ".join(tokens[:consumed]).strip()
    tail = " ".join(tokens[consumed:]).strip()
    if natural_word_count(tail) < 6:
        return ""
    return prefix


def _looks_like_command_line(text: str) -> bool:
    normalized = " ".join((text or "").split())
    if not normalized:
        return False
    prefix = extract_command_prefix(normalized)
    if prefix:
        return True
    tokens = normalized.split()
    if not tokens:
        return False
    if not _looks_like_command_head(tokens[0]):
        return False
    if sum(1 for token in tokens if FLAG_TOKEN_RE.fullmatch(token)) >= 1:
        return True
    if sum(1 for token in tokens if FILE_TOKEN_RE.fullmatch(token) or NUMBER_TOKEN_RE.fullmatch(token)) >= 2:
        return True
    if any(token in _COMMAND_OPERATORS for token in tokens):
        return True
    return False


def _looks_like_prose_line(text: str) -> bool:
    normalized = " ".join((text or "").split())
    if natural_word_count(normalized) < 6:
        return False
    alpha_chars = sum(ch.isalpha() for ch in normalized)
    if alpha_chars < 24:
        return False
    return True


def build_soft_rule_hints(item: dict) -> list[str]:
    hints: list[str] = []
    text = normalized_source_text(item)
    if not text:
        return hints

    line_texts = extract_line_texts(item)
    role = str(item.get("metadata", {}).get("structure_role", "") or "")
    block_type = str(item.get("block_type", "") or "")

    if role == "body" and block_type == "text":
        hints.append("body_text_block")
    if natural_word_count(text) >= 8:
        hints.append("long_english_prose")

    if line_texts:
        first_line = line_texts[0]
        tail_text = " ".join(line_texts[1:]).strip()
        command_lines = sum(1 for line in line_texts if _looks_like_command_line(line))
        prose_lines = sum(1 for line in line_texts if _looks_like_prose_line(line))

        if len(line_texts) >= 2 and _looks_like_command_line(first_line) and natural_word_count(tail_text) >= 6:
            hints.append("command_prefix_then_prose_tail")
        if command_lines >= 1 and prose_lines >= 1:
            hints.append("mixed_literal_and_prose_block")

    prefix = extract_command_prefix(text)
    if prefix:
        hints.append("single_line_command_prefix_with_prose_tail")
        hints.append("starts_with_command_prefix")

    return hints


def should_route_to_mixed_literal_llm(item: dict) -> bool:
    if not item.get("should_translate", True):
        return False
    if str(item.get("block_type", "") or "") == "code_body":
        return False
    if str(item.get("metadata", {}).get("structure_role", "") or "") not in {"", "body"}:
        return False
    hints = set(build_soft_rule_hints(item))
    return bool(
        {
            "command_prefix_then_prose_tail",
            "single_line_command_prefix_with_prose_tail",
        }
        & hints
    )


__all__ = [
    "build_soft_rule_hints",
    "extract_command_prefix",
    "extract_line_texts",
    "natural_word_count",
    "normalized_source_text",
    "should_route_to_mixed_literal_llm",
]
