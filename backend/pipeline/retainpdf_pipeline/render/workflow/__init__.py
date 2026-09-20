__all__ = [
    "execute_render_plan",
]


def __getattr__(name: str):
    if name == "execute_render_plan":
        from retainpdf_pipeline.render.workflow.executor import execute_render_plan

        return execute_render_plan
    raise AttributeError(name)
