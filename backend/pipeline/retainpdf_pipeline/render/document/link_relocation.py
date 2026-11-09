"""Move preserved PDF link hit areas onto their translated anchors."""
from __future__ import annotations

from pathlib import Path
import re

import fitz
import pikepdf


def _characters(page, regions):
    chars = []
    for block in page.get_text('rawdict')['blocks']:
        for line in block.get('lines', []):
            for span in line['spans']:
                for char in span['chars']:
                    rect = fitz.Rect(char['bbox'])
                    center = (rect.tl + rect.br) / 2
                    if any(center in region for region in regions):
                        chars.append((char['c'], rect))
            chars.append(('\n', None))
    return chars


def _anchor_pattern(text, destination):
    numbers = re.findall(r'\d+', text)
    if re.match(r'Fig(?:ure)?\.', text, re.I) and numbers:
        return r'(?P<anchor>图)\s*' + re.escape(numbers[0]) + r'(?!\d)'
    if re.match(r'Tables?', text, re.I) and numbers:
        return r'(?P<anchor>表)\s*' + re.escape(numbers[0]) + r'(?!\d)'
    if destination.startswith(('fig','tab')) and numbers:
        return ('图' if destination.startswith('fig') else '表') + r'\s*(?P<anchor>' + re.escape(numbers[0]) + r')(?!\d)'
    if text.startswith('Appendix'):
        return r'(?P<anchor>附录)'
    if text in {'∗', '*', '⋆'}:
        return r'(?P<anchor>[∗*⋆])'
    if destination.startswith(('figure.', 'table.', 'section.', 'equation.')) and numbers:
        prefix = {'figure': r'(?:图|Fig(?:ure)?\.?)', 'table': r'(?:表|Table)',
                  'section': r'(?:第|节|§|Section)', 'equation': r'(?:式|Eq(?:uation)?\.?)'}[destination.split('.')[0]]
        return prefix + r'\s*[（(]?\s*(?P<anchor>' + re.escape(numbers[-1]) + r')(?!\d)'
    if destination.startswith('cite.') and numbers:
        return r'(?<!\d)(?P<anchor>' + re.escape(numbers[0]) + r')(?!\d)'
    return '(?P<anchor>' + re.escape(text.strip()) + ')'


def relocate_translated_links(output_pdf: Path, source_pdf: Path, translated_pages: dict[int, list[dict]]) -> dict:
    moved = unchanged = 0
    unresolved = []
    updates = {}
    all_items = [item for items in translated_pages.values() for item in items]
    with fitz.open(source_pdf) as source, fitz.open(output_pdf) as target:
        output_indices = {idx: idx for idx in translated_pages} if len(source) == len(target) else {
            idx: offset for offset, idx in enumerate(sorted(translated_pages))}
        page_chars = {idx: _characters(target[output_indices[idx]], [target[output_indices[idx]].rect]) for idx in translated_pages}
        source_chars = {idx: _characters(source[idx], [source[idx].rect]) for idx in translated_pages}
        for page_index, items in translated_pages.items():
            if page_index >= len(source) or output_indices[page_index] >= len(target):
                continue
            source_page, target_page = source[page_index], target[output_indices[page_index]]
            target_links = target_page.get_links()
            used = set()
            for link in source_page.get_links():
                rect = link['from']
                intersecting = [item for item in items if fitz.Rect(item['bbox']).intersects(rect)]
                if not intersecting:
                    unchanged += 1
                    continue
                owner = max(intersecting, key=lambda item: (fitz.Rect(item['bbox']) & rect).width * (fitz.Rect(item['bbox']) & rect).height)
                if not owner.get('should_translate', True) or not owner.get('translated_text'):
                    unchanged += 1
                    continue
                group = owner.get('continuation_group')
                members = [item for item in all_items if group and item.get('continuation_group') == group] or [owner]
                original_chars = [(c,r) for c,r in source_chars[page_index] if r and (r.tl+r.br)/2 in rect]
                anchor = ''.join(c for c, r in original_chars if r).strip()
                if not anchor:
                    anchor = source_page.get_textbox(rect).strip()
                if not anchor:
                    # Icon/image links have no translated text anchor.
                    unchanged += 1
                    continue
                if re.fullmatch(r'Fig(?:ure)?\.|Tables?', anchor, re.I):
                    nearby = [(c,r) for c,r in source_chars[page_index] if r
                              and rect.x1-1 <= r.x0 <= rect.x1+35
                              and abs((r.y0+r.y1-rect.y0-rect.y1)/2) < rect.height]
                    following = ''.join(c for c,r in nearby)
                    number = re.search(r'\d+', following)
                    if not number:
                        indices = [idx for idx,(c,r) in enumerate(source_chars[page_index]) if r and (r.tl+r.br)/2 in rect]
                        if indices:
                            following = ''.join(c for c,r in source_chars[page_index][max(indices)+1:max(indices)+14])
                            number = re.match(r'\s*(\d+)', following)
                    if number: anchor += ' ' + number.group()
                destination = link.get('nameddest', '')
                pattern = _anchor_pattern(anchor, destination)
                candidates = []
                for member_page in {item['page_idx'] for item in members}:
                    regions = [fitz.Rect(item['bbox']) + (-1,-1,1,1) for item in members if item['page_idx'] == member_page]
                    chars = [(c,r) for c,r in page_chars[member_page] if r and not c.isspace() and any((r.tl+r.br)/2 in region for region in regions)]
                    text = ''.join(c for c,r in chars)
                    matches = list(re.finditer(pattern, text, re.IGNORECASE)) if anchor else []
                    for match in matches:
                        boxes = [r for c,r in chars[match.start('anchor'):match.end('anchor')]]
                        if not boxes: continue
                        # Wrapped URLs need one clickable rectangle per line.
                        line_boxes = []
                        for box in boxes:
                            if line_boxes and abs(box.y0-line_boxes[-1].y0) < box.height * .5:
                                line_boxes[-1] |= box
                            else: line_boxes.append(fitz.Rect(box))
                        identity = (member_page, *(round(v,2) for box in line_boxes for v in box))
                        if identity not in used: candidates.append((member_page,line_boxes,identity))
                old_links = [entry for entry in target_links if sum(abs(a-b) for a,b in zip(entry['from'], rect)) < 1]
                if not candidates or not old_links:
                    unresolved.append(dict(page=page_index+1, item_id=owner['item_id'], anchor=anchor, destination=destination))
                    continue
                # Within one paragraph repeated references retain their source proximity.
                new_page, boxes, identity = min(candidates, key=lambda value: (value[0] != page_index, abs(value[1][0].y0-rect.y0)+abs(value[1][0].x0-rect.x0)))
                used.add(identity)
                new_page = output_indices[new_page]
                updates[old_links[0]['xref']] = (new_page, [list(box * ~target[new_page].transformation_matrix) for box in boxes])
                moved += 1
    temporary = output_pdf.with_name(output_pdf.stem + '.links.pdf')
    with pikepdf.Pdf.open(output_pdf) as pdf:
        additions = {}
        for page_index,page in enumerate(pdf.pages):
            retained = []
            for annotation in page.obj.get('/Annots', []):
                replacement = updates.get(annotation.objgen[0])
                if replacement is not None:
                    new_page, boxes = replacement
                    for box in boxes:
                        copied = pikepdf.Dictionary(annotation)
                        copied['/Rect'] = pikepdf.Array(box)
                        copied['/P'] = pdf.pages[new_page].obj
                        additions.setdefault(new_page, []).append(pdf.make_indirect(copied))
                else: retained.append(annotation)
            if '/Annots' in page.obj: page.obj['/Annots'] = pikepdf.Array(retained)
        for page_index, annotations in additions.items():
            page=pdf.pages[page_index]
            page.obj['/Annots'] = pikepdf.Array(list(page.obj.get('/Annots', [])) + annotations)
        pdf.save(temporary, object_stream_mode=pikepdf.ObjectStreamMode.generate, compress_streams=True)
    temporary.replace(output_pdf)
    return dict(moved=moved, unchanged=unchanged, unresolved=unresolved)
