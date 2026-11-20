"""Page-priority dispatch without page-completion barriers.

Semantic continuation units remain indivisible. Only transport batches split
at page boundaries; a late-page item cannot ride inside an early-page batch.
"""
from itertools import groupby


def item_order(item):
    def number(value):
        return value if isinstance(value, int) and not isinstance(value, bool) and value >= 0 else 2**31
    members = item.get("translation_unit_members") or []
    pages = [number(item.get("page_idx"))]
    pages.extend(number(member.get("page_idx")) for member in members if isinstance(member, dict))
    return (min(pages), number(item.get("reading_order")), number(item.get("block_idx")), str(item.get("item_id", "")))


def page_ordered_batches(batches):
    result = []
    for batch in batches:
        for _, members in groupby(sorted(batch, key=item_order), key=lambda item: item_order(item)[0]):
            result.append(list(members))
    return sorted(result, key=lambda batch: item_order(batch[0]))


def task_order(task):
    return min((item_order(item) for item in task[3]), default=(2**31, 2**31, 2**31, ""))
