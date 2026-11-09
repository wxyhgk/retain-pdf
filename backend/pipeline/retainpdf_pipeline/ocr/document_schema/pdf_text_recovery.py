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
            block['text'] = ' '.join(restored_lines)
            block['lines'] = [dict(bbox=list(line['bbox']), spans=[dict(
                type='text', text=text, bbox=list(line['bbox']), score=1.0)])
                for line, text in zip(lines, restored_lines)]
            block.setdefault('metadata', {})['pdf_text_recovered'] = True
            repaired += 1
    return repaired
