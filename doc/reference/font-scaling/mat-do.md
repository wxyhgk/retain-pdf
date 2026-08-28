# How Is Density Actually Determined?

If you imagine a text box as a paper box, then "density" answers one question:

**Given current font size and line spacing, is this translated content loose, just right, or overloaded when stuffed into this box?**

This seems intuitive, but implementing in code usually does not look at one metric alone. Because "crowded or not" has at least two meanings:

- Did content itself get longer
- Does box itself have capacity to hold this content

So in current implementation, density is not a single constant but determined jointly by several function groups.

---

## 1. Conclusion First: We Actually Look at Two Densities

In current implementation, most relevant to "density" is not one function but two lines:

1. **Length density**
   - Checks whether translated content "expanded" relative to source
   - Corresponding function: `translation_density_ratio(...)`

2. **Layout density**
   - Checks whether content appears too crowded in box at current font size and line spacing
   - Corresponding function: `layout_density_ratio(...)`

In [fit.py](../../backend/scripts/services/rendering/layout/payload/fit.py), both metrics participate in judgment together:

```python
length_density_ratio = translation_density_ratio(item, protected_text)
layout_density = layout_density_ratio(box, protected_text, font_size_pt=font_size_pt, line_step_pt=line_step)
is_dense_block = length_density_ratio >= COMPACT_TRIGGER_RATIO or layout_density >= LAYOUT_COMPACT_TRIGGER_RATIO
```

In other words, system asks neither only "did translation get longer" nor only "is box nearly full", but both.

---

## 2. Layer 1: Did Content Expand Noticeably

Most direct approach: source had few words but translation became very long paragraph; likely harder to lay out.

This layer handled by `translation_density_ratio(...)` in [text_common.py](../../backend/scripts/services/rendering/layout/payload/text_common.py):

```python
def translation_density_ratio(item: dict, protected_text: str) -> float:
    source_words = source_word_count(item)
    if source_words <= 0:
        return 0.0
    zh_chars = translated_zh_char_count(protected_text)
    if zh_chars <= 0:
        return 0.0
    return zh_chars / source_words
```

Function does something very simple:

- Count approximate English word count in source: `source_word_count(item)`
- Count Chinese character count after translation: `translated_zh_char_count(protected_text)`
- Get ratio via "Chinese chars / source words"

Its purpose is not "precise layout calculation" but quick judgment:

**Is this translation visually more prone to crowding than source?**

### Example

Suppose source block:

- Source word count: 20
- Translated Chinese chars: 18

Then:

`translation_density_ratio = 18 / 20 = 0.9`

Indicates reaching tight edge.

If another block:

- Source word count: 20
- Translated Chinese chars: 24

Then:

`translation_density_ratio = 24 / 20 = 1.2`

Such block belongs to "noticeable expansion"; typically treated more conservatively afterward.

Current thresholds also in same file:

- `COMPACT_TRIGGER_RATIO = 0.9`
- `HEAVY_COMPACT_RATIO = 1.0`

Plainly:

- `>= 0.9`: Starting to get tight
- `>= 1.0`: Already heavy compact block

---

## 3. Layer 2: Will Box Really Be Filled at Current Font Size

Previous layer only indicates "did content get longer"; does not look at box.

Same `ratio = 1.0` two paragraphs:

- In 400pt wide body box may be completely fine
- In 160pt wide caption box may immediately overflow

So second layer must look at "box capacity".

This step handled by `layout_density_ratio(...)` in [text_common.py](../../backend/scripts/services/rendering/layout/payload/text_common.py):

```python
def layout_density_ratio(
    inner: list[float],
    protected_text: str,
    *,
    font_size_pt: float,
    line_step_pt: float,
) -> float:
    width = max(8.0, inner[2] - inner[0])
    height = max(8.0, inner[3] - inner[1])
    zh_chars = translated_zh_char_count(protected_text)
    approx_char_width = max(font_size_pt * 0.92, 1.0)
    chars_per_line = max(4.0, width / approx_char_width)
    required_lines = max(1.0, zh_chars / chars_per_line)
    occupied_height = required_lines * line_step_pt
    return occupied_height / height
```

Function logic in plain terms:

1. Check box width and height
2. Assume approximate character width at current font size
3. Derive approximate characters per line
4. Estimate how many lines translated text needs
5. Calculate how much height these lines occupy
6. Divide occupied height by box height

Result is very intuitive ratio:

- `< 1.0`: Theoretically still fits
- `≈ 1.0`: Very tight
- `> 1.0`: Theoretically already exceeds box

### Example

Suppose box:

- Width: 180pt
- Height: 90pt
- Current font: 9pt
- Current line spacing: 12pt
- Translated Chinese chars: 72

Rough estimate:

- Single char width approx `9 × 0.92 = 8.28pt`
- Per line approx `180 / 8.28 ≈ 21.7` chars
- 72 chars need approx `72 / 21.7 ≈ 3.3` lines
- Occupied height approx `3.3 × 12 = 39.6pt`
- Layout density approx `39.6 / 90 = 0.44`

Indicates block actually not crowded.

If same content in another box:

- Width: 110pt
- Height: 48pt

Then:

- Per line approx `110 / 8.28 ≈ 13.3` chars only
- 72 chars need `72 / 13.3 ≈ 5.4` lines
- Occupied height approx `5.4 × 12 = 64.8pt`
- Layout density approx `64.8 / 48 = 1.35`

Typical high-density block; current font definitely too large.

---

## 4. Layer 3: How Box "Real Capacity" Actually Calculated

Above `layout_density_ratio(...)` is quick estimate; lightweight; suitable for initial density judgment.

Calculation closer to "how much content box can actually hold" in [capacity.py](../../backend/scripts/services/rendering/layout/payload/capacity.py).

Core is `box_capacity_units(...)`:

```python
def box_capacity_units(
    inner: list[float],
    font_size_pt: float,
    leading_em: float,
    visual_lines: int | None = None,
) -> float:
    width = max(8.0, inner[2] - inner[0])
    height = max(8.0, inner[3] - inner[1])
    line_step = max(font_size_pt * 1.02, font_size_pt * (1.0 + leading_em))
    lines = max(1, int(height / line_step))
    if visual_lines and visual_lines > 1:
        lines = min(lines, max(1, visual_lines + 1))
    chars_per_line = max(4.0, width / max(font_size_pt * 0.92, 1.0))
    return lines * chars_per_line * 0.98
```

Does three things:

1. Derives total lines possible from font size and line spacing
2. Derives content per line from box width
3. Multiplies both to get total box capacity

Critical detail here:

`visual_lines`

In other words, does not fully trust "how many lines box height allows"; references OCR / layout structure visual line count estimate for original block to avoid overly optimistic capacity assumption.

---

## 5. Layer 4: Content Demand Not Simply Character Counting

If capacity calculated, how is "demand" computed?

Handled by `text_demand_units(...)` in same file:

```python
def text_demand_units(protected_text: str, formula_map: list[dict]) -> float:
    formula_lookup = {entry["placeholder"]: entry["formula_text"] for entry in formula_map}
    return sum(token_units(token, formula_lookup) for token in tokenize_protected_text(protected_text))
```

Meaning:

- Splits text into tokens first
- Normal text counts as normal units
- Formula placeholders counted not as 1 character but closer to real visual cost

Important because looking at character count alone underestimates formula pressure.

### Example

Two texts below may have similar character count:

1. `Phương pháp này cải thiện đáng kể hiệu suất vật liệu.`
2. `Phương pháp này cải thiện đáng kể hiệu suất vật liệu trong điều kiện [[FORMULA_1]].`

But second has higher actual layout pressure due to formula.

System does not treat them as same demand; gives formula higher visual cost via `token_units(...)`.

---

## 6. Layer 5: Why Visual Line Count Introduced

Easily overlooked problem:

**Sometimes OCR "line count" unreliable.**

E.g., paragraph originally 4 lines glued into 1 line by OCR. If looking at raw `lines` only, severely overestimates box available layout space.

So [measurement.py](../../backend/scripts/services/rendering/layout/typography/measurement.py) has dedicated function set correcting this:

- `plain_text_chars_per_line(...)`
- `_predicted_wrapped_line_count(...)`
- `visual_line_count(...)`
- `is_tall_single_line_glue(...)`

Where `visual_line_count(...)` idea:

- Check OCR reported line count first
- Estimate "if wrapping normally, should be how many lines" based on text length, box width, single-line character capacity
- If predicted lines significantly higher than OCR lines, use more conservative line count

Purpose not calculating font size but preventing density judgment misled by false data.

### Typical Example

Suppose block:

- OCR gave only 1 line
- But box tall; text length 140 chars
- Geometrically impossible to fit so much in one line

Then `visual_line_count(...)` concludes:

"This likely not 1-line body but OCR glued multi-line paragraph into one."

System uses predicted value to correct subsequent capacity judgment. Density calculated this way closer to reality.

---

## 7. How Density Ultimately Affects Font Size

These functions do not directly output "final font size"; role more like providing judgment basis for layout engine.

Most direct landing point in `fit_translated_block_metrics(...)` of [fit.py](../../backend/scripts/services/rendering/layout/payload/fit.py):

```python
capacity = box_capacity_units(box, font_size_pt, leading_em, visual_lines=visual_lines)
if capacity <= 0 or (demand <= capacity * 0.96 and layout_density < LAYOUT_DENSITY_SAFE_MAX):
    return font_size_pt, leading_em
```

Logic here critical:

- If demand not approaching capacity
- And layout density not too high

Then current font size retained.

Conversely if:

- `demand > capacity`
- Or `layout_density` already too high

Then enters font size reduction, line spacing compression flow.

In other words, density does not directly output "9.2pt" or "8.8pt" but decides:

- Whether to shrink
- How many steps to shrink
- Shrink font only or compress line spacing too

---

## 8. Can Understand as Very Simple Judgment Chain

Compressing all functions into plain language yields roughly this chain:

1. **Check if translated content expanded noticeably**
   - `translation_density_ratio(...)`

2. **Check how much height this content occupies in box at current font**
   - `layout_density_ratio(...)`

3. **More rigorously estimate how many unit contents box truly holds**
   - `box_capacity_units(...)`

4. **Do not fully trust OCR line count; correct with `visual_line_count(...)`**

5. **Decide whether to shrink font using "demand vs capacity"**
   - `text_demand_units(...)` vs `box_capacity_units(...)`

---

## 9. Complete Example

Suppose translation block has these conditions:

- Box width: 145pt
- Box height: 62pt
- Initial font: 9.4pt
- Line spacing: 0.58em
- Source words: 18
- Translated Chinese chars: 22
- Contains 2 formulas

System views as:

### Step 1: Did Content Expand

`translation_density_ratio = 22 / 18 ≈ 1.22`

Already heavy compact block.

### Step 2: Will Layout Be Too Crowded at Current Font

Estimated by `layout_density_ratio(...)`:

- Box relatively narrow
- Limited chars per line at 9.4pt
- Real line-break pressure greater with formulas

Calculated layout density may approach or exceed `1.0`

### Step 3: Check Capacity and Demand

- `box_capacity_units(...)` finds total box capacity small
- `text_demand_units(...)` raises demand due to formulas

Conclusion formed:

**High-density block; current font unsafe.**

### Step 4: Enter Shrinking

`fit_translated_block_metrics(...)` starts trying:

- Reduce font slightly each step
- If insufficient, compress leading slightly
- Keep trying until demand no longer significantly exceeds capacity

This is complete process of "how density judgment actually affects font size".

---

## 10. Final Summary

So-called "box density" essentially not asking:

"How many characters in this box?"

But asking:

**At current font and line spacing, what gap remains between box usable capacity and real demand of this translated content?**

In current implementation, answered jointly by following function groups:

- Page and original line info correction:
  - [measurement.py](../../backend/scripts/services/rendering/layout/typography/measurement.py)
- Text length and layout density estimation:
  - [text_common.py](../../backend/scripts/services/rendering/layout/payload/text_common.py)
- Capacity and demand calculation:
  - [capacity.py](../../backend/scripts/services/rendering/layout/payload/capacity.py)
- Final font shrinking decision:
  - [fit.py](../../backend/scripts/services/rendering/layout/payload/fit.py)

If tracing further "why font finally got smaller", answer usually returns to:

**Because current block content demand approached or exceeded box capacity at current font.**

</content>