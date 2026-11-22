"""Recover corrupted OCR text from a matching embedded PDF text layer."""
from __future__ import annotations

from difflib import SequenceMatcher
import re
import unicodedata


_GREEK = dict(zip(
    'αβγδεζηθικλμνξοπρστυφχψω',
    ('alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu nu xi '
     'omicron pi rho sigma tau upsilon phi chi psi omega').split(),
))
_SYMBOLS = {'∈': r'\in ', '≤': r'\le ', '≥': r'\ge ', '∞': r'\infty ', '×': r'\times ', '⋅': r'\cdot '}


def _math_char(char: str) -> bool:
    return 0x1D400 <= ord(char) <= 0x1D7FF or char in _GREEK or char in _SYMBOLS


def _tex(text: str) -> str:
    return ''.join(('\\' + _GREEK[c] + ' ') if c in _GREEK else _SYMBOLS.get(c, c)
                   for c in unicodedata.normalize('NFKC', text))


def _line_text(line: dict) -> str:
    chunks, math = [], []
    baseline = size = 0.0

    def flush() -> None:
        if math:
            chunks.append('$' + ''.join(math).strip() + '$')
            math.clear()

    for span in line['spans']:
        text = span['text']
        # Mathematical spans can include punctuation, digits and subscripts.
        is_math = any(_math_char(c) for c in text)
        continuation = bool(math) and bool(re.fullmatch(r'[\d\s(),.\[\]+=−\-]+|[A-Z]{1,3}', text)) and bool(text.strip())
        if is_math or continuation:
            lowered = (math and span['size'] < size * 0.85
                       and span['origin'][1] > baseline + size * 0.1)
            raised = (math and span['size'] < size * 0.85
                      and span['origin'][1] < baseline - size * 0.1)
            if lowered or raised:
                math.append(('_{' if lowered else '^{') + _tex(text) + '}')
            else:
                math.append(_tex(text))
                if is_math:
                    baseline, size = span['origin'][1], span['size']
        else:
            flush()
            chunks.append(text)
    flush()
    return ''.join(chunks).strip()


def recover_corrupted_pdf_text(document: dict, pdf) -> int:
    """Repair only replacement-character blocks with a close text-layer match.

    Image-only pages and unrelated text-layer regions keep the provider text.
    Coordinates must already have been converted to PDF points.
    """
    import fitz

    repaired = 0
    for page_index, page in enumerate(document.get('pages', [])):
        if page_index >= len(pdf):
            break
        for block in page.get('blocks', []):
            original = block.get('text', '')
            if '\ufffd' not in original:
                continue
            region = fitz.Rect(block['bbox']) + (-1, -1, 1, 1)
            embedded = pdf[page_index].get_text('dict', clip=region)
            lines = [line for b in embedded['blocks'] for line in b.get('lines', [])]
            plain = ' '.join(''.join(s['text'] for s in line['spans']) for line in lines)
            compact = lambda value: ''.join(value.split())
            # A short formula may lose most of its symbols; require all of its
            # remaining punctuation/operators to match the embedded expression.
            original_compact = compact(original)
            known = original_compact.replace('\ufffd', '')
            damaged_pattern = '.+?'.join(re.escape(part) for part in re.split('\ufffd+', original_compact))
            formula_match = len(known) >= 8 and re.fullmatch(damaged_pattern, compact(plain)) is not None
            if not formula_match and '=' in known and original_compact.count('\ufffd') > len(original_compact) / 2:
                # OCR may drop a terminal subscript as well as replace symbols.
                formula_match = len(known) >= 8 and re.fullmatch(
                    damaged_pattern + r'[A-Za-z0-9]{0,3}',
                    unicodedata.normalize('NFKC', compact(plain)),
                ) is not None
            close_text = SequenceMatcher(None, original_compact, compact(plain), autojunk=False).ratio() >= 0.8
            if not plain or '\ufffd' in plain or not (close_text or formula_match):
                continue
            restored_lines = [_line_text(line) for line in lines]
            _replace_block_text(block, lines, restored_lines)
            block.setdefault('metadata', {})['pdf_text_recovered'] = True
            repaired += 1
    return repaired


def _inside(bbox, container) -> list:
    """文字层的行框按"块框外放 1pt"取，校验要求行框在块框里：收回块框。"""
    if not isinstance(container, list) or len(container) != 4:
        return list(bbox)
    x0, y0, x1, y1 = (float(v) for v in bbox)
    cx0, cy0, cx1, cy1 = (float(v) for v in container)
    x0, x1 = min(max(x0, cx0), cx1), min(max(x1, cx0), cx1)
    y0, y1 = min(max(y0, cy0), cy1), min(max(y1, cy0), cy1)
    return [x0, y0, x1, y1]


def _replace_block_text(block: dict, lines: list, restored_lines: list[str]) -> None:
    """恢复后的文字写回块上所有带文字的地方：text、content（翻译读的是 content.text，校验要求它和 text 一样）、
    lines、segments。以前只改 text 和 lines：content.text 还是乱码，翻译照旧拿到乱码，校验判"两份不一样"整个任务失败
    （2026-11-22，一本 583 页的书第 480 页一块 photore\\ufffdsistors）。"""
    container = (block.get('geometry') or {}).get('bbox') or block.get('bbox')
    text = ' '.join(restored_lines)
    raw_type = next((str(segment.get('raw_type') or '') for segment in block.get('segments') or []
                     if isinstance(segment, dict) and segment.get('raw_type')), '') or 'text'
    block['text'] = text
    block['lines'] = [dict(bbox=_inside(line['bbox'], container), spans=[dict(
        type='text', raw_type=raw_type, text=line_text, bbox=_inside(line['bbox'], container), score=1.0)])
        for line, line_text in zip(lines, restored_lines)]
    block['segments'] = [dict(type='text', raw_type=raw_type, text=line_text, bbox=_inside(line['bbox'], container),
                              score=1.0, bbox_precision='line')
                         for line, line_text in zip(lines, restored_lines) if line_text.strip()]
    content = block.get('content')
    if isinstance(content, dict):
        content['text'] = text
        line_texts = [line_text for line_text in restored_lines if line_text.strip()]
        if line_texts:
            content['line_texts'] = line_texts
        else:
            content.pop('line_texts', None)
