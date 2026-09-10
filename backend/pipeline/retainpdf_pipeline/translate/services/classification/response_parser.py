def expand_page_ranges(spec: str, valid_orders: set[int]) -> set[int]:
    result: set[int] = set()
    for raw_part in spec.split(","):
        part = raw_part.strip()
        if not part:
            continue
        if "~" in part:
            left, right = [chunk.strip() for chunk in part.split("~", 1)]
            if not left.isdigit() or not right.isdigit():
                continue
            start = int(left)
            end = int(right)
            if start > end:
                start, end = end, start
            for order in range(start, end + 1):
                if order in valid_orders:
                    result.add(order)
            continue
        if part.isdigit():
            order = int(part)
            if order in valid_orders:
                result.add(order)
    return result


def parse_no_trans_response(content: str, review_items: list[dict]) -> dict[str, str]:
    review_by_order = {item["order"]: item for item in review_items}
    selected_orders: set[int] = set()
    for raw_line in content.splitlines():
        line = raw_line.strip()
        if not line.lower().startswith("no-trans:"):
            continue
        spec = line.split(":", 1)[1].strip()
        selected_orders = expand_page_ranges(spec, set(review_by_order))
        break
    labels = {item["item_id"]: "translate" for item in review_items}
    for order in selected_orders:
        labels[review_by_order[order]["item_id"]] = "code"
    return labels
