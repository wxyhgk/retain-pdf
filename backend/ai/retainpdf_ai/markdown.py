"""Deterministic Markdown chunking and lightweight local retrieval.

The first question-answering mode deliberately treats ``md/full.md`` as its
only evidence source.  It does not open normalized document JSON, translation
manifests, PDF text, favorites, or the library-wide FTS index.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path


MAX_MARKDOWN_BYTES = 4 * 1024 * 1024
DEFAULT_CHUNK_CHARS = 1800
CHUNK_OVERLAP_CHARS = 180
_HEADING_RE = re.compile(r"^(#{1,6})\s+(.+?)\s*$")
_LATIN_WORD_RE = re.compile(r"[A-Za-z0-9][A-Za-z0-9_+./-]*")
_CJK_RUN_RE = re.compile(r"[\u3400-\u9fff]+")


@dataclass(frozen=True)
class MarkdownImageRef:
    alt: str
    path: str
    char_start: int
    char_end: int


@dataclass(frozen=True)
class MarkdownChunk:
    chunk_id: str
    heading: str
    text: str
    char_start: int
    char_end: int
    images: tuple[MarkdownImageRef, ...] = ()


def load_markdown_chunks(job_root: Path) -> list[MarkdownChunk]:
    path = job_root / "md" / "full.md"
    if not path.is_file():
        raise FileNotFoundError(f"Markdown not found for job: {job_root.name}")
    if path.stat().st_size > MAX_MARKDOWN_BYTES:
        raise ValueError(
            f"Markdown is too large ({path.stat().st_size} bytes; max {MAX_MARKDOWN_BYTES})"
        )
    text = path.read_text(encoding="utf-8")
    return chunk_markdown(text)


def chunk_markdown(
    markdown: str,
    *,
    max_chars: int = DEFAULT_CHUNK_CHARS,
    overlap_chars: int = CHUNK_OVERLAP_CHARS,
) -> list[MarkdownChunk]:
    max_chars = max(400, int(max_chars))
    overlap_chars = max(0, min(int(overlap_chars), max_chars // 3))
    sections = _markdown_sections(markdown)
    drafts: list[tuple[str, str, int, int]] = []
    for heading, body, section_start in sections:
        evidence = body.strip()
        if not evidence:
            continue
        prefix = f"{heading}\n\n" if heading else ""
        available = max(200, max_chars - len(prefix))
        pieces = _split_text(evidence, available, overlap_chars)
        search_from = 0
        for piece in pieces:
            relative = evidence.find(piece, search_from)
            if relative < 0:
                relative = search_from
            start = section_start + relative
            end = start + len(piece)
            drafts.append((heading, f"{prefix}{piece}".strip(), start, end))
            search_from = max(0, relative + len(piece) - overlap_chars)
    return [
        MarkdownChunk(
            chunk_id=f"md-{index:04d}",
            heading=heading,
            text=text,
            char_start=start,
            char_end=end,
            images=tuple(markdown_image_refs(text)),
        )
        for index, (heading, text, start, end) in enumerate(drafts, start=1)
    ]


def search_markdown_chunks(
    chunks: list[MarkdownChunk],
    query: str,
    *,
    limit: int = 8,
) -> list[tuple[MarkdownChunk, float]]:
    terms = _query_terms(query)
    if not terms:
        return []
    ranked: list[tuple[MarkdownChunk, float]] = []
    phrase = " ".join(str(query or "").lower().split())
    for chunk in chunks:
        heading = chunk.heading.lower()
        # 文件名、URL 和图片 alt 不是正文证据；否则查询通用词（例如
        # ``figure``/``image``）会把所有图片路径都误判为命中。
        body = markdown_text_for_model(chunk.text).lower()
        score = 0.0
        if phrase and phrase in body:
            score += 12.0
        for term in terms:
            body_count = body.count(term)
            heading_count = heading.count(term)
            if body_count:
                score += min(body_count, 8) * (1.0 + min(len(term), 12) / 12.0)
            if heading_count:
                score += heading_count * 5.0
        if score > 0:
            ranked.append((chunk, round(score, 3)))
    ranked.sort(key=lambda item: (-item[1], item[0].char_start, item[0].chunk_id))
    return ranked[: max(1, min(int(limit), 12))]


def find_markdown_chunk(chunks: list[MarkdownChunk], chunk_id: str) -> MarkdownChunk | None:
    wanted = str(chunk_id or "").strip().lower()
    return next((chunk for chunk in chunks if chunk.chunk_id.lower() == wanted), None)


def _markdown_sections(markdown: str) -> list[tuple[str, str, int]]:
    text = str(markdown or "").replace("\r\n", "\n").replace("\r", "\n")
    heading_stack: list[str] = []
    sections: list[tuple[str, str, int]] = []
    body: list[str] = []
    body_start = 0
    offset = 0

    def flush() -> None:
        nonlocal body, body_start
        content = "\n".join(body).strip()
        if content:
            sections.append((" > ".join(heading_stack), content, body_start))
        body = []

    for line in text.split("\n"):
        match = _HEADING_RE.match(line)
        if match:
            flush()
            level = len(match.group(1))
            title = match.group(2).strip()
            heading_stack[:] = heading_stack[: level - 1]
            heading_stack.append(title)
            body_start = offset + len(line) + 1
        else:
            if not body:
                body_start = offset
            body.append(line)
        offset += len(line) + 1
    flush()
    return sections


def _split_text(text: str, max_chars: int, overlap_chars: int) -> list[str]:
    if len(text) <= max_chars:
        return [text]
    pieces: list[str] = []
    image_spans = [(item.char_start, item.char_end) for item in markdown_image_refs(text)]
    start = 0
    while start < len(text):
        hard_end = min(len(text), start + max_chars)
        end = hard_end
        if hard_end < len(text):
            candidates = [
                text.rfind("\n\n", start + max_chars // 2, hard_end),
                text.rfind("\n", start + max_chars // 2, hard_end),
                text.rfind("。", start + max_chars // 2, hard_end),
                text.rfind(". ", start + max_chars // 2, hard_end),
            ]
            boundary = max(candidates)
            if boundary > start:
                end = boundary + (2 if text[boundary : boundary + 2] in {"\n\n", ". "} else 1)
        # 图片语法是一个原子：绝不能把 ``![alt](path)`` 从路径中间截断，
        # 否则后续既无法生成受控 asset URL，也会把残缺 URL 喂给模型。
        for span_start, span_end in image_spans:
            if span_start < end < span_end:
                end = span_end
                break
        piece = text[start:end].strip()
        if piece:
            pieces.append(piece)
        if end >= len(text):
            break
        next_start = max(start + 1, end - overlap_chars)
        for span_start, span_end in image_spans:
            if span_start < next_start < span_end:
                next_start = span_start
                break
        if next_start <= start:
            next_start = end
        start = next_start
    return pieces


def markdown_image_refs(markdown: str) -> list[MarkdownImageRef]:
    """Extract inline Markdown images while preserving balanced path parentheses.

    This is intentionally narrower than a full Markdown parser.  It accepts the
    provider form ``![alt](images/page-N/...)`` and leaves HTML images to the
    normal Markdown renderer; only these refs become AI-visible assets.
    """
    text = str(markdown or "")
    refs: list[MarkdownImageRef] = []
    cursor = 0
    while True:
        start = text.find("![", cursor)
        if start < 0:
            break
        alt_end = _find_unescaped(text, "](", start + 2)
        if alt_end < 0:
            cursor = start + 2
            continue
        depth = 1
        index = alt_end + 2
        escaped = False
        while index < len(text):
            char = text[index]
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == "(":
                depth += 1
            elif char == ")":
                depth -= 1
                if depth == 0:
                    path = text[alt_end + 2 : index].strip()
                    if path:
                        refs.append(
                            MarkdownImageRef(
                                alt=text[start + 2 : alt_end].strip(),
                                path=path,
                                char_start=start,
                                char_end=index + 1,
                            )
                        )
                    cursor = index + 1
                    break
            index += 1
        else:
            cursor = alt_end + 2
    return refs


def markdown_text_for_model(markdown: str) -> str:
    """Replace image syntax with a neutral label and remove its path from evidence."""
    text = str(markdown or "")
    refs = markdown_image_refs(text)
    if not refs:
        return text
    output: list[str] = []
    cursor = 0
    for ref in refs:
        output.append(text[cursor : ref.char_start])
        output.append(f"[图片: {ref.alt}]" if ref.alt else "[图片资源]")
        cursor = ref.char_end
    output.append(text[cursor:])
    return "".join(output)


def _find_unescaped(text: str, needle: str, start: int) -> int:
    index = start
    while True:
        index = text.find(needle, index)
        if index < 0:
            return -1
        slashes = 0
        probe = index - 1
        while probe >= 0 and text[probe] == "\\":
            slashes += 1
            probe -= 1
        if slashes % 2 == 0:
            return index
        index += len(needle)


def _query_terms(query: str) -> list[str]:
    normalized = " ".join(str(query or "").lower().split())
    terms: list[str] = []
    for word in _LATIN_WORD_RE.findall(normalized):
        if len(word) >= 2 and word not in terms:
            terms.append(word)
    for run in _CJK_RUN_RE.findall(normalized):
        candidates = [run] if len(run) <= 2 else [run, *(run[i : i + 2] for i in range(len(run) - 1))]
        for term in candidates:
            if term and term not in terms:
                terms.append(term)
    return terms


__all__ = [
    "MarkdownChunk",
    "MarkdownImageRef",
    "chunk_markdown",
    "find_markdown_chunk",
    "load_markdown_chunks",
    "markdown_image_refs",
    "markdown_text_for_model",
    "search_markdown_chunks",
]
