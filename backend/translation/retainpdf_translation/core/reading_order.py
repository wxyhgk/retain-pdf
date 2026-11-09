from __future__ import annotations


def continuation_reading_order(items: list[dict]) -> list[dict]:
    """Read annotated double-column runs left-to-right, each column top-to-bottom.

    OCR array order may interleave columns by line height. Work on a copy:
    block identities and the payload's physical order belong to the renderer.
    Full-width blocks delimit runs so section headings remain in place.
    """
    ordered: list[dict] = []
    run: list[dict] = []

    def flush() -> None:
        ordered.extend(sorted(run, key=lambda item: (
            0 if item['layout_zone'] == 'left_column' else 1,
            item['bbox'][1], item['bbox'][0],
        )))
        run.clear()

    for item in items:
        if run and item.get('page_idx') != run[0].get('page_idx'):
            flush()
        if (item.get('layout_mode') == 'double'
                and item.get('layout_zone') in {'left_column', 'right_column'}
                and len(item.get('bbox', [])) == 4):
            run.append(item)
        else:
            flush()
            ordered.append(item)
    flush()
    return ordered
