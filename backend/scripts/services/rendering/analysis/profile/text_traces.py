from __future__ import annotations

import fitz


def text_trace_visibility_counts(page: fitz.Page) -> tuple[int, int]:
    try:
        traces = page.get_texttrace()
    except Exception:
        traces = []
    visible = 0
    hidden = 0
    for trace in traces or []:
        try:
            trace_type = int(trace.get("type", 0))
        except Exception:
            trace_type = 0
        opacity = float(trace.get("opacity", 1.0) or 0.0)
        if trace_type == 3 or opacity <= 0.0:
            hidden += 1
        else:
            visible += 1
    return visible, hidden
