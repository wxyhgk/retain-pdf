__all__ = [
    "execute_render_plan",
    "render_translated_pages_map",
]


def __getattr__(name: str):
    if name == "execute_render_plan":
        from services.rendering.workflow.executor import execute_render_plan

        return execute_render_plan
    if name == "render_translated_pages_map":
        from services.rendering.workflow.direct_overlay import render_translated_pages_map

        return render_translated_pages_map
    raise AttributeError(name)
