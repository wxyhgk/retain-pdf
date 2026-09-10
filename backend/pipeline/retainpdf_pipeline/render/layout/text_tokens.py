from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from enum import Enum


class TextTokenKind(str, Enum):
    DISPLAY_MATH = "display_math"
    INLINE_MATH = "inline_math"
    PROTECTED_FORMULA = "protected_formula"
    FORMULA_PLACEHOLDER = "formula_placeholder"
    WHITESPACE = "whitespace"
    WORD = "word"
    ZH_CHAR = "zh_char"
    OTHER = "other"


FORMULA_TOKEN_KINDS = frozenset(
    {
        TextTokenKind.DISPLAY_MATH,
        TextTokenKind.INLINE_MATH,
        TextTokenKind.PROTECTED_FORMULA,
        TextTokenKind.FORMULA_PLACEHOLDER,
    }
)
RAW_MATH_TOKEN_KINDS = frozenset({TextTokenKind.DISPLAY_MATH, TextTokenKind.INLINE_MATH})
MAX_INLINE_MATH_CHARS = 1200


@dataclass(frozen=True)
class TextToken:
    kind: TextTokenKind
    value: str
    start: int = 0
    end: int = 0


TokenMatcher = Callable[[str, int], int]


@dataclass(frozen=True)
class TokenRule:
    kind: TextTokenKind
    match_end: TokenMatcher


def _is_ascii_alnum(char: str) -> bool:
    return ("A" <= char <= "Z") or ("a" <= char <= "z") or ("0" <= char <= "9")


def _is_formula_suffix_char(char: str) -> bool:
    return ("a" <= char <= "z") or ("0" <= char <= "9")


def _is_zh_char(char: str) -> bool:
    return "\u4e00" <= char <= "\u9fff"


def _is_escaped(text: str, index: int) -> bool:
    backslashes = 0
    cursor = index - 1
    while cursor >= 0 and text[cursor] == "\\":
        backslashes += 1
        cursor -= 1
    return backslashes % 2 == 1


def _match_formula_placeholder(text: str, index: int) -> int:
    for prefix, suffix in (
        ("[[FORMULA_", "]]"),
        ("__FORMULA_", "__"),
        ("⟦FORMULA_", "⟧"),
        ("<FORMULA_", ">"),
    ):
        if not text.startswith(prefix, index):
            continue
        cursor = index + len(prefix)
        digit_start = cursor
        while cursor < len(text) and text[cursor].isdigit():
            cursor += 1
        if cursor == digit_start or not text.startswith(suffix, cursor):
            continue
        return cursor + len(suffix)
    return index


def _match_protected_formula(text: str, index: int) -> int:
    if index + 7 > len(text) or text[index] != "<":
        return index
    cursor = index + 1
    if text[cursor] not in "futnvc":
        return index
    cursor += 1
    digit_start = cursor
    while cursor < len(text) and text[cursor].isdigit():
        cursor += 1
    if cursor == digit_start or cursor >= len(text) or text[cursor] != "-":
        return index
    suffix_start = cursor + 1
    suffix_end = suffix_start + 3
    suffix = text[suffix_start:suffix_end]
    if len(suffix) != 3 or not all(_is_formula_suffix_char(char) for char in suffix):
        return index
    if not text.startswith("/>", suffix_end):
        return index
    return suffix_end + 2


def _match_display_math(text: str, index: int) -> int:
    if not text.startswith("$$", index) or _is_escaped(text, index):
        return index
    cursor = index + 2
    while cursor + 1 < len(text):
        if text[cursor] == "\\":
            cursor += 2
            continue
        if text.startswith("$$", cursor):
            return cursor + 2
        cursor += 1
    return index


def _match_inline_math(text: str, index: int) -> int:
    if (
        text[index] != "$"
        or text.startswith("$$", index)
        or _is_escaped(text, index)
        or index + 1 >= len(text)
    ):
        return index
    cursor = index + 1
    while cursor < len(text):
        if cursor - index > MAX_INLINE_MATH_CHARS:
            return index
        char = text[cursor]
        if char == "\n":
            return index
        if char == "\\":
            cursor += 2
            continue
        if char == "$":
            body = text[index + 1 : cursor].strip()
            return cursor + 1 if body else index
        cursor += 1
    return index


def _match_whitespace(text: str, index: int) -> int:
    if not text[index].isspace():
        return index
    cursor = index + 1
    while cursor < len(text) and text[cursor].isspace():
        cursor += 1
    return cursor


def _match_word(text: str, index: int) -> int:
    if not _is_ascii_alnum(text[index]):
        return index
    cursor = index + 1
    while cursor < len(text) and _is_ascii_alnum(text[cursor]):
        cursor += 1
    while cursor + 1 < len(text) and text[cursor] in "-'" and _is_ascii_alnum(text[cursor + 1]):
        cursor += 2
        while cursor < len(text) and _is_ascii_alnum(text[cursor]):
            cursor += 1
    return cursor


def _match_zh_char(text: str, index: int) -> int:
    return index + 1 if _is_zh_char(text[index]) else index


TOKEN_RULES: tuple[TokenRule, ...] = (
    TokenRule(TextTokenKind.FORMULA_PLACEHOLDER, _match_formula_placeholder),
    TokenRule(TextTokenKind.PROTECTED_FORMULA, _match_protected_formula),
    TokenRule(TextTokenKind.DISPLAY_MATH, _match_display_math),
    TokenRule(TextTokenKind.INLINE_MATH, _match_inline_math),
    TokenRule(TextTokenKind.WHITESPACE, _match_whitespace),
    TokenRule(TextTokenKind.WORD, _match_word),
    TokenRule(TextTokenKind.ZH_CHAR, _match_zh_char),
)


def iter_text_tokens(text: str) -> list[TextToken]:
    source = text or ""
    tokens: list[TextToken] = []
    index = 0
    while index < len(source):
        for rule in TOKEN_RULES:
            end = rule.match_end(source, index)
            if end > index:
                tokens.append(TextToken(rule.kind, source[index:end], index, end))
                index = end
                break
        else:
            tokens.append(TextToken(TextTokenKind.OTHER, source[index : index + 1], index, index + 1))
            index += 1
    return tokens


def tokenize_text(text: str) -> list[str]:
    return [token.value for token in iter_text_tokens(text)]


def iter_formula_tokens(text: str) -> list[TextToken]:
    return [token for token in iter_text_tokens(text) if token.kind in FORMULA_TOKEN_KINDS]


def strip_formula_tokens(text: str, *, replacement: str = " ") -> str:
    return "".join(
        replacement if token.kind in FORMULA_TOKEN_KINDS else token.value
        for token in iter_text_tokens(text)
    )


def classify_token_value(token: str) -> TextTokenKind:
    tokens = iter_text_tokens(token or "")
    if len(tokens) == 1 and tokens[0].value == (token or ""):
        return tokens[0].kind
    return TextTokenKind.OTHER


def is_formula_token(token: str) -> bool:
    return classify_token_value(token) in FORMULA_TOKEN_KINDS


def math_token_body(token: TextToken | str) -> str:
    value = token.value if isinstance(token, TextToken) else str(token or "")
    kind = token.kind if isinstance(token, TextToken) else classify_token_value(value)
    if kind == TextTokenKind.DISPLAY_MATH and value.startswith("$$") and value.endswith("$$"):
        return value[2:-2].strip()
    if kind == TextTokenKind.INLINE_MATH and value.startswith("$") and value.endswith("$"):
        return value[1:-1].strip()
    return value


def replace_non_formula_segments(text: str, replacer: Callable[[str], str]) -> str:
    chunks: list[str] = []
    plain: list[str] = []
    for token in iter_text_tokens(text):
        if token.kind in RAW_MATH_TOKEN_KINDS:
            if plain:
                chunks.append(replacer("".join(plain)))
                plain.clear()
            chunks.append(token.value)
            continue
        plain.append(token.value)
    if plain:
        chunks.append(replacer("".join(plain)))
    return "".join(chunks)


__all__ = [
    "FORMULA_TOKEN_KINDS",
    "RAW_MATH_TOKEN_KINDS",
    "TextToken",
    "TextTokenKind",
    "classify_token_value",
    "is_formula_token",
    "iter_formula_tokens",
    "iter_text_tokens",
    "math_token_body",
    "replace_non_formula_segments",
    "strip_formula_tokens",
    "tokenize_text",
]
