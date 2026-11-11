"""Recover corrupted OCR text from a matching embedded PDF text layer."""
from __future__ import annotations

from difflib import SequenceMatcher
import re
import unicodedata

from retainpdf_pipeline.ocr.document_schema.estimated_lines import DOLLAR_MATH_RE, build_segments


_GREEK = dict(zip(
    'αβγδεζηθικλμνξοπρστυφχψω',
    ('alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu nu xi '
     'omicron pi rho sigma tau upsilon phi chi psi omega').split(),
))
_SYMBOLS = {'∈': r'\in ', '≤': r'\le ', '≥': r'\ge ', '∞': r'\infty ', '×': r'\times ', '⋅': r'\cdot '}
_REPLACEMENT = '\ufffd'
_REPLACEMENT_RUN = re.compile(r'\ufffd+')
_STYLED_MATH_LETTERS = '[\U0001d400-\U0001d7ff' + ''.join(_GREEK) + ']'


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


def _letters(text: str) -> str:
    return ''.join(c for c in unicodedata.normalize('NFKC', text) if c.isalnum())


def _recover_prose_glyphs(original: str, plain: str) -> list[str]:
    """Match single glyphs by surrounding prose, without reconstructing nearby math."""
    parts = original.split(_REPLACEMENT)
    if any(not _letters(part) for part in parts[1:-1]):
        return []
    glyphs = [(key, char) for char in plain for key in _letters(char)]
    compact = ''.join(key for key, _ in glyphs)
    replacements = []
    for before, after in zip(parts, parts[1:]):
        left, right = _letters(before)[-12:], _letters(after)[:12]
        # Allow a glyph near the block edge or next to a differently encoded
        # formula, but require matching text on both sides when available.
        left_min, right_min = min(len(left), 4), min(len(right), 4)
        candidates = []
        for index, (_, char) in enumerate(glyphs):
            if len(_letters(char)) != 1:
                continue
            prefix, suffix = compact[max(0, index - 12):index], compact[index + 1:index + 13]
            left_len = next((n for n in range(len(left), left_min - 1, -1) if not n or prefix.endswith(left[-n:])), -1)
            right_len = next((n for n in range(len(right), right_min - 1, -1) if suffix.startswith(right[:n])), -1)
            if left_len >= left_min and right_len >= right_min and left_len + right_len >= 12:
                candidates.append(char)
        if len(candidates) != 1:
            return []
        char = candidates[0]
        replacements.append('$' + _tex(char).strip() + '$' if _math_char(char) else char)
    return replacements


def _recover_math_runs(context: str, lines: list[dict]) -> list[str]:
    """Recover simple styled math inside a line with matching OCR prose."""
    compact = lambda text: ''.join(text.split())
    parts = re.split(r'(\ufffd+)', compact(context))
    widths = [len(part) for part in parts[1::2]]
    if sum(len(_letters(part)) for part in parts[::2]) < 12:
        return []
    # An OCR run can omit one subscript. Math typography, rather than a
    # wildcard over arbitrary prose, supplies the missing characters.
    body = ''.join(
        f'({_STYLED_MATH_LETTERS}{{{len(part)},{len(part) + (len(part) > 1)}}})'
        if index % 2 else re.escape(unicodedata.normalize('NFKC', part))
        for index, part in enumerate(parts)
    )
    left = '' if parts[0] else f'(?<!{_STYLED_MATH_LETTERS})'
    right = '' if parts[-1] else f'(?!{_STYLED_MATH_LETTERS})'
    pattern = re.compile(left + body + right)
    candidates = []
    for line in lines:
        chars = [(char, span) for span in line['spans'] for char in span['text'] if not char.isspace()]
        search_text = ''.join(char if _math_char(char) else unicodedata.normalize('NFKC', char)
                              for char, _ in chars)
        if len(search_text) != len(chars):
            continue
        for match in pattern.finditer(search_text):
            recovered = []
            for (start, end), width in zip(match.regs[1:], widths):
                # Keep the geometry needed to restore an actual PDF subscript.
                spans = [dict(span, text=char) for char, span in chars[start:end]]
                value = _line_text({'spans': spans})
                if not re.fullmatch(r'\$[^$]+\$', value) or (end - start > width and '_{' not in value):
                    break
                recovered.append(value)
            else:
                candidates.append(recovered)
    return candidates[0] if len(candidates) == 1 else []


def _replace_prose_glyphs(block: dict, content: dict, replacements: list[str]) -> bool:
    """Keep existing OCR spans and line geometry; update all text projections together."""
    segments = block.get('segments') or []
    spans = [span for line in block.get('lines', []) for span in line.get('spans', [])]
    damaged_spans = [span for span in segments + spans if _REPLACEMENT in span['text']]
    if any(span['type'] != 'text' for span in damaged_spans):
        return False
    line_texts = content.get('line_texts') or []
    fields = (
        [(block, 'text')] if 'text' in block else [],
        [(content, 'text')] if 'text' in content else [],
        [(line_texts, index) for index in range(len(line_texts))],
        [(span, 'text') for span in segments],
        [(span, 'text') for span in spans],
    )
    # A projection may be absent, but if it has damage it must agree on the
    # number of missing characters before we apply the replacements in order.
    for group in fields:
        if sum(len(_REPLACEMENT_RUN.findall(record[key])) for record, key in group) not in (0, len(replacements)):
            return False
    updates = []
    for group in fields:
        values = iter(replacements)
        for record, key in group:
            if _REPLACEMENT in record[key]:
                updates.append((record, key, _REPLACEMENT_RUN.sub(lambda _: next(values), record[key])))
    for record, key, value in updates:
        record[key] = value
    return True


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
            content = block.get('content') or {}
            original = content.get('text', block.get('text', ''))
            if _REPLACEMENT not in original:
                continue
            block_box = fitz.Rect((block.get('geometry') or {}).get('bbox') or block['bbox'])
            region = block_box + (-1, -1, 1, 1)
            embedded = pdf[page_index].get_text('dict', clip=region)
            lines = [line for b in embedded['blocks'] for line in b.get('lines', [])]
            plain = ' '.join(''.join(s['text'] for s in line['spans']) for line in lines)
            if not plain or _REPLACEMENT in plain:
                continue
            kind = content.get('kind', block.get('type', 'text'))
            segments = block.get('segments') or []
            inline_math = list(DOLLAR_MATH_RE.finditer(original))
            if kind == 'text' and not any(_REPLACEMENT in match[0] for match in inline_math):
                damaged = [span['text'] for span in segments if _REPLACEMENT in span['text']]
                # Provider spans end at equation boundaries, so adjacent LaTeX
                # tokens need not match the PDF's typography to anchor prose.
                contexts = damaged or [original]
                matches = [
                    _recover_prose_glyphs(context, plain) or _recover_math_runs(context, lines)
                    for context in contexts
                ]
                replacements = [value for match in matches for value in match]
                if (all(matches) and len(replacements) == len(_REPLACEMENT_RUN.findall(original))
                        and _replace_prose_glyphs(block, content, replacements)):
                    repaired += 1
                    continue
            # Rebuilding math from linearized PDF text can lose fraction and
            # radical structure. Preserve intact OCR formulas in mixed prose.
            if kind == 'text' and (inline_math or any(
                span.get('type') == 'inline_formula' for span in segments
            )):
                continue
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
            if not (close_text or formula_match):
                continue
            recovered_lines = []
            restored_lines = []
            raw_label = 'formula' if kind == 'formula' else 'text'
            for line in lines:
                bbox = fitz.Rect(line['bbox']) & block_box
                text = _line_text(line)
                if bbox.is_empty or not text:
                    continue
                spans = build_segments(text, raw_label)
                for span in spans:
                    span['bbox'] = list(bbox)
                recovered_lines.append(dict(bbox=list(bbox), spans=spans))
                restored_lines.append(text)
            if not restored_lines:
                continue
            restored_text = ' '.join(restored_lines)
            block['text'] = restored_text
            block['lines'] = recovered_lines
            block['segments'] = [dict(span) for line in recovered_lines for span in line['spans']]
            if content:
                content['text'] = restored_text
                content['line_texts'] = restored_lines
            block.setdefault('metadata', {})['pdf_text_recovered'] = True
            repaired += 1
    return repaired
