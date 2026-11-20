from __future__ import annotations

import re

MEMORY_VERSION = 1
MAX_SUMMARY_TERMS = 20
MAX_SUMMARY_PRESERVE_HINTS = 8
MAX_RETRIEVED_SUMMARY_TERMS = 8
MAX_RETRIEVED_PRESERVE_HINTS = 2
MAX_TERM_RECORDS = 160
MAX_PRESERVE_HINT_RECORDS = 80
MIN_TERM_HITS_FOR_PROMPT = 1
MAX_TRANSLATED_TERM_VALUE_CHARS = 12
MAX_TRANSLATED_TERM_VALUE_CJK = 8
MAX_TERM_KEY_WORDS_FOR_PROMPT = 4
TERM_VALUE_BLOCKLIST_WORDS = {"的", "已", "将", "被", "从", "在", "这", "其"}

TERM_PAIR_PATTERNS = (
    re.compile(r"(?P<zh>[\u4e00-\u9fff][\u4e00-\u9fffA-Za-z0-9·\-]{1,24})（(?:或称|又称|简称)?(?P<en>[A-Za-z][A-Za-z0-9 ._+/\-]{1,48})）"),
    re.compile(r"(?P<zh>[\u4e00-\u9fff][\u4e00-\u9fffA-Za-z0-9·\-]{1,24})\((?:or |also known as )?(?P<en>[A-Za-z][A-Za-z0-9 ._+/\-]{1,48})\)"),
    re.compile(r"(?P<zh>[\u4e00-\u9fff][\u4e00-\u9fffA-Za-z0-9·\-]{1,24})（(?P<en>[A-Za-z][A-Za-z0-9 ._+/\-]{1,48})）"),
)
TECH_TOKEN_RE = re.compile(r"\b[A-Z][A-Za-z0-9]*(?:[-_/][A-Za-z0-9]+)*(?:\s+[A-Z][A-Za-z0-9]*(?:[-_/][A-Za-z0-9]+)*){0,3}\b")
