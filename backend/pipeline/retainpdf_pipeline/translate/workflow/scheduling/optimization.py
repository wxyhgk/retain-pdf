"""Page-local batching mechanics; strategy selection belongs to the caller."""
from retainpdf_pipeline.translate.workflow.scheduling.page_order import item_order


def page_local_batches(items, batch_size, source_text):
    """Keep semantic units intact; bound source characters, not guessed tokens."""
    output, batch, chars, current = [], [], 0, None
    limit = min(8, max(1, batch_size))
    for item in sorted(items, key=item_order):
        key = (item_order(item)[0], item.get("math_mode", "placeholder"))
        size = len(source_text(item))
        if batch and (key != current or len(batch) >= limit or chars + size > 2400):
            output.append(batch)
            batch, chars = [], 0
        current = key
        batch.append(item)
        chars += size
        if size > 2400:
            output.append(batch)
            batch, chars = [], 0
    if batch:
        output.append(batch)
    return output
