"""Move preserved PDF link hit areas onto their translated anchors."""
from __future__ import annotations

from pathlib import Path
import re

import fitz
import pikepdf


def _inside(x, y, region) -> bool:
    """和 PyMuPDF 的 ``point in rect`` 一样（左上含、右下不含），只是用浮点数比，不建 fitz 对象。

    以前每个字、每个链接都建 fitz.Point / fitz.Rect 再交给 MuPDF 判断：一篇 JACS 论文 10 页 321 个引用链接，
    88 万次判断，链接重定位用了约 2 分钟，排版本身才 18 秒（2026-11-22 c16bb6）。"""
    return region[0] <= x < region[2] and region[1] <= y < region[3]


class _Char(tuple):
    """一个字：(字符, 框)，框是 (x0, y0, x1, y1)；``center`` 是框的中心。换行标记的框是 None。"""
    __slots__ = ()

    @property
    def center(self):
        box = self[1]
        return ((box[0] + box[2]) / 2, (box[1] + box[3]) / 2)


def _characters(page, regions):
    regions = [tuple(region) for region in regions]
    chars = []
    for block in page.get_text('rawdict')['blocks']:
        for line in block.get('lines', []):
            for span in line['spans']:
                for char in span['chars']:
                    box = tuple(char['bbox'])
                    cx, cy = (box[0] + box[2]) / 2, (box[1] + box[3]) / 2
                    if any(_inside(cx, cy, region) for region in regions):
                        chars.append(_Char((char['c'], box)))
            chars.append(_Char(('\n', None)))
    return chars


def _in_rect(chars, rect):
    """``chars`` 里中心落在 ``rect`` 里的字（保持顺序）。"""
    region = tuple(rect)
    return [char for char in chars if char[1] and _inside(*char.center, region)]


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


class _PageChars:
    """Per-page character lists, read only for pages that actually need them.

    Pages are visited in order and a continuation group spans neighbouring
    pages, so entries far behind the current page are dropped to keep memory
    flat on long books.
    """

    def __init__(self, pdf, page_number):
        self._pdf = pdf
        self._page_number = page_number
        self._cache = {}

    def __getitem__(self, page_index):
        if page_index not in self._cache:
            page = self._pdf[self._page_number(page_index)]
            self._cache[page_index] = _characters(page, [page.rect])
        return self._cache[page_index]

    def forget_before(self, page_index):
        for key in [key for key in self._cache if key < page_index]:
            del self._cache[key]


_KEEP_PAGES_BEHIND = 2


def relocate_translated_links(output_pdf: Path, source_pdf: Path, translated_pages: dict[int, list[dict]]) -> dict:
    moved = unchanged = 0
    unresolved = []
    updates = {}
    group_members = {}
    for items in translated_pages.values():
        for item in items:
            if item.get('continuation_group'):
                group_members.setdefault(item['continuation_group'], []).append(item)
    with fitz.open(source_pdf) as source, fitz.open(output_pdf) as target:
        output_indices = {idx: idx for idx in translated_pages} if len(source) == len(target) else {
            idx: offset for offset, idx in enumerate(sorted(translated_pages))}
        page_chars = _PageChars(target, lambda idx: output_indices[idx])
        source_chars = _PageChars(source, lambda idx: idx)
        # 同一块（或同一接续组）在某页上的译文字：一页的链接多半落在同几块里，按块筛一次，不按链接每次重筛整页
        member_texts = {}

        def member_text(member_page, members):
            regions = tuple(
                (x0 - 1, y0 - 1, x1 + 1, y1 + 1)
                for x0, y0, x1, y1 in (tuple(item['bbox']) for item in members if item['page_idx'] == member_page)
            )
            key = (member_page, regions)
            if key not in member_texts:
                chars = [
                    (c, r) for c, r in page_chars[member_page]
                    if r and not c.isspace() and any(_inside((r[0]+r[2])/2, (r[1]+r[3])/2, region) for region in regions)
                ]
                member_texts[key] = (chars, ''.join(c for c, r in chars))
            return member_texts[key]

        for page_index in sorted(translated_pages):
            items = translated_pages[page_index]
            if page_index >= len(source) or output_indices[page_index] >= len(target):
                continue
            page_chars.forget_before(page_index - _KEEP_PAGES_BEHIND)
            for key in [key for key in member_texts if key[0] < page_index - _KEEP_PAGES_BEHIND]:
                del member_texts[key]
            source_chars.forget_before(page_index)
            source_page, target_page = source[page_index], target[output_indices[page_index]]
            source_links = source_page.get_links()
            if not source_links:
                continue
            target_links = target_page.get_links()
            used = set()
            for link in source_links:
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
                members = group_members.get(group) if group else None
                members = members or [owner]
                original_chars = _in_rect(source_chars[page_index], rect)
                anchor = ''.join(c for c, r in original_chars if r).strip()
                if not anchor:
                    anchor = source_page.get_textbox(rect).strip()
                if not anchor:
                    # Icon/image links have no translated text anchor.
                    unchanged += 1
                    continue
                if re.fullmatch(r'Fig(?:ure)?\.|Tables?', anchor, re.I):
                    nearby = [(c,r) for c,r in source_chars[page_index] if r
                              and rect.x1-1 <= r[0] <= rect.x1+35
                              and abs((r[1]+r[3]-rect.y0-rect.y1)/2) < rect.height]
                    following = ''.join(c for c,r in nearby)
                    number = re.search(r'\d+', following)
                    if not number:
                        region = tuple(rect)
                        indices = [idx for idx,(c,r) in enumerate(source_chars[page_index]) if r and _inside((r[0]+r[2])/2, (r[1]+r[3])/2, region)]
                        if indices:
                            following = ''.join(c for c,r in source_chars[page_index][max(indices)+1:max(indices)+14])
                            number = re.match(r'\s*(\d+)', following)
                    if number: anchor += ' ' + number.group()
                destination = link.get('nameddest', '')
                pattern = _anchor_pattern(anchor, destination)
                candidates = []
                for member_page in {item['page_idx'] for item in members if item.get('page_idx') in output_indices}:
                    chars, text = member_text(member_page, members)
                    matches = list(re.finditer(pattern, text, re.IGNORECASE)) if anchor else []
                    for match in matches:
                        boxes = [fitz.Rect(r) for c,r in chars[match.start('anchor'):match.end('anchor')]]
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
    if not updates:
        # Nothing moved: leave the rendered PDF untouched instead of rewriting it.
        return dict(moved=moved, unchanged=unchanged, unresolved=unresolved)
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
