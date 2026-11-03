"""整块是命令行 / 代码时不送模型、保留原文（services/policy/command_listing.py）。

样例取自 2026-11-03 那本 6574 页的 Tessent 命令手册（卡在导出门禁的 322 块），反例取自几本化学、物理书里
差点被认错的正文（斜杠词组、带 $…$ 公式的短句、方括号）。
"""

from __future__ import annotations

import pytest

from retainpdf_translation.artifacts.status import blocking_untranslated_items
from retainpdf_translation.services.policy import translation_policy_verdict
from retainpdf_translation.services.policy.command_listing import looks_like_command_listing
from retainpdf_translation.workflow.batching.plan import _build_translation_batches
from retainpdf_translation.llm.shared.control_context import build_translation_control_context


def _item(item_id: str, source_text: str, **overrides) -> dict:
    item = {
        "item_id": item_id,
        "block_type": "text",
        "block_kind": "text",
        "source_text": source_text,
        "protected_source_text": source_text,
        "should_translate": True,
    }
    item.update(overrides)
    return item


@pytest.mark.parametrize(
    "source",
    [
        "set_edt_pins output 1 tdo tap_i/tap_edt_channel_reg_in",
        "find_design_names /ret_i/add_2* -instance -netlist -hier",
        "set spec [create_dft_specification -sri_sib_list occ] report_config_data $spec",
        "puts [format_dictionary $mydict -keys_that_are_list partners -list_elements_per_line 1]",
        "set_test_setup_icall \"m8051_m8051_B1_edt_i.setup edt_low_power_shift_en on \\ edt_bypass off\"",
        "{corea_rtl2_tessent_sib_sri_inst.client corea_rtl2_tessent_sib_sri_inst.host}",
        "- MemoryInterface(id)/scan_bypass_logic : async_mux | none | sync_mux | from_library ;",
        "set_edt_options -lockup on -retime_chain_boundaries on set_system_mode analysis report_edt_lockup_cells",
        "add_scan_chains c1 g1 si so",
        "SETUP> set_design_sources -format icl -search_design_load_path On",
        "add_config_message \"this is an error string \\non two lines\" \\ -config_element [get_config_el rtl_extension -in $spec] \\ -error -display",
        "set_current_simulation_context",
        "get_attribute_list",
    ],
)
def test_command_lines_from_a_tool_manual_are_recognised(source: str) -> None:
    assert looks_like_command_listing(source)


@pytest.mark.parametrize(
    "source",
    [
        "The density functional is evaluated on the numerical grid.",
        "Use set_edt_pins to specify which pins are connected to the decompressor and the compactor.",
        "- DECisions A literal that displays all the aborted, undetected faults that exceeded the maximum number of decisions.",
        "4.45 Battery/resistor loop **",
        "GB/SA see generalized Born/surface area",
        "C.2.5 Electric field: volt/meter vs. statvolt/centimeter",
        "$ ^{a} $From Cade and Huo [21].",
        "c) [See Hint.]",
        "Expanding $ L_{+} $ gives",
        "Fig. 2.4.1 Overlapping between s-type and $ p_{x} $ -type orbitals",
        "Since I = -dQ/dt, we have",
        "TESTING",
        "量子化学的基本方程是 Schrödinger 方程。",
    ],
)
def test_prose_with_symbols_is_not_mistaken_for_commands(source: str) -> None:
    assert not looks_like_command_listing(source)


def test_command_listing_keeps_origin_without_calling_the_model_or_blocking_export() -> None:
    verdict = translation_policy_verdict(_item("p3228-b003", "set_edt_pins output 1 tdo tap_i/tap_edt_channel_reg_in"))

    assert verdict.action == "keep_origin"
    assert verdict.reason == "command_listing"
    assert verdict.should_call_model is False
    assert verdict.blocks_export is False
    assert verdict.fast_path_keep_origin is True


def test_command_listing_judges_the_raw_source_not_the_protected_placeholders() -> None:
    # 保护过的原文里公式成了占位符（带下划线、括号），不能因此把正文当成代码
    item = _item(
        "p12-b003",
        "Expanding $ L_{+} $ gives",
        protected_source_text="Expanding [[FORMULA_1]] gives",
    )

    assert translation_policy_verdict(item).action == "translate"


def test_command_lines_skip_the_network_batch_and_never_block_the_export_gate() -> None:
    context = build_translation_control_context()
    batches, immediate = _build_translation_batches(
        [
            _item("p3228-b003", "set_edt_pins output 1 tdo tap_i/tap_edt_channel_reg_in"),
            _item("body", "This sentence describes the scan insertion flow and provides enough body text for translation."),
        ],
        effective_batch_size=4,
        translation_context=context,
    )

    assert [[item["item_id"] for item in batch] for batch in batches] == [["body"]]
    [result] = immediate
    assert list(result) == ["p3228-b003"]
    payload = dict(result["p3228-b003"])
    assert payload["translation_diagnostics"]["degradation_reason"] == "command_listing"
    item = _item("p3228-b003", "set_edt_pins output 1 tdo tap_i/tap_edt_channel_reg_in", **{
        key: value for key, value in payload.items() if key != "translation_diagnostics"
    })
    item["translation_diagnostics"] = payload["translation_diagnostics"]
    assert blocking_untranslated_items({0: [item]}) == []
