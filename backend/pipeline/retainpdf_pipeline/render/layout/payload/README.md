# Payload Layout Policies

`body_pipeline.py` is the orchestration layer for body text layout. Keep it as a stage list only. It depends on `body_policy_facade`, not on every leaf helper.

Policy boundaries:

- `body_common.py`: shared body-context predicates and geometry helpers.
- `body_policy_facade.py`: stable stage API consumed by `body_pipeline.py`.
- `body_font_dense_policy.py`: dense-body pressure tightening, force-fit marking, and underfilled body growth.
- `body_font_inheritance_policy.py`: short body line font inheritance from same-column body anchors.
- `body_font_unify_policy.py`: same-column similar-font unification.
- `body_font_harmonize_policy.py`: long body paragraph font/leading harmonization.
- `body_font_policy.py`: stable facade for body font stages. Pipeline code imports this facade so leaf font files can move without changing orchestration.
- `body_leading_policy.py`: body leading and line-spacing decisions.
- `body_fit_policy.py`: Typst fit budget decisions, including relaxed height for short body boxes.
- `body_smoothing_policy.py`: adjacent body-pair smoothing.

New rendering rules should be placed in the narrowest policy module that owns the field being mutated, then exposed through `body_policy_facade.py` if the pipeline needs to run it. Avoid adding layout rules directly to `body_pipeline.py`, and avoid making the pipeline import leaf helpers one by one.
