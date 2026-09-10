from functools import lru_cache
from importlib import resources
from string import Formatter


PROMPTS_PACKAGE = "retainpdf_pipeline.translate.prompts"


@lru_cache(maxsize=None)
def load_prompt(name: str) -> str:
    return resources.files(PROMPTS_PACKAGE).joinpath(name).read_text(encoding="utf-8").strip()


def render_prompt(name: str, **values: object) -> str:
    template = load_prompt(name)
    field_names = {
        field_name
        for _literal, field_name, _format_spec, _conversion in Formatter().parse(template)
        if field_name
    }
    defaults = {field_name: "" for field_name in field_names}
    defaults.update({key: str(value) for key, value in values.items()})
    return template.format(**defaults).strip()
