# Rendering Policy Layer

This package centralizes page/item rendering decisions that must be shared by
source cleanup, bbox text stripping, layout, and Typst emission.

Policy code should decide what should happen:

- `cleanup_mode`: whether original PDF text can be deleted, visually covered,
  or skipped.
- `overlay_fill`: whether Typst text blocks need an explicit background fill.
- `formula_protection_role`: why an item is protected around display formulas.

Execution code should only consume those decisions:

- `source/preparation/bbox_text_strip_candidates.py` builds strip/protection
  regions from policy decisions. The current pikepdf path protects
  `formula` / `display_formula` bbox instead of skipping an entire page just
  because it contains a formula.
- `source/background/stage.py` selects redaction strategy from page policy.
- `source/background/redaction_items.py` only builds redaction items from layout
  blocks; formula guard splitting lives in `policy/formula_guard.py`.
- `output/typst/emitter.py` writes block fill only from fields propagated by
  policy.

When adding a new rule, prefer adding it here and writing compatibility fields
with `apply_render_page_policy_fields()` instead of introducing another
stage-local flag.
