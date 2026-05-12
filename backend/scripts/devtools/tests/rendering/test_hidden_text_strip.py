import sys
from pathlib import Path


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from services.rendering.source.preparation.hidden_text_strip import _text_object_is_hidden
from services.rendering.source.preparation.hidden_text_strip import _analyze_text_object_visibility


def test_text_object_is_hidden_when_all_text_show_uses_render_mode_3() -> None:
    text_object = [
        ([], "BT"),
        ([3], "Tr"),
        (["hello"], "Tj"),
        ([], "ET"),
    ]

    assert _text_object_is_hidden(text_object) is True


def test_text_object_is_not_hidden_when_text_show_uses_visible_render_mode() -> None:
    text_object = [
        ([], "BT"),
        ([0], "Tr"),
        (["hello"], "Tj"),
        ([], "ET"),
    ]

    assert _text_object_is_hidden(text_object) is False


def test_text_object_is_not_hidden_when_render_mode_switches_before_text_show() -> None:
    text_object = [
        ([], "BT"),
        ([3], "Tr"),
        ([0], "Tr"),
        (["visible"], "Tj"),
        ([], "ET"),
    ]

    assert _text_object_is_hidden(text_object) is False


def test_text_object_inherits_hidden_render_mode_from_previous_object() -> None:
    text_object = [
        ([], "BT"),
        (["inherited"], "Tj"),
        ([], "ET"),
    ]

    hidden, final_render_mode = _analyze_text_object_visibility(
        text_object,
        initial_render_mode=3,
    )

    assert hidden is True
    assert final_render_mode == 3


def test_text_object_returns_final_render_mode_for_following_objects() -> None:
    text_object = [
        ([], "BT"),
        ([3], "Tr"),
        (["hidden"], "Tj"),
        ([], "ET"),
    ]

    hidden, final_render_mode = _analyze_text_object_visibility(text_object)

    assert hidden is True
    assert final_render_mode == 3
