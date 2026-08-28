# Why PDF Font Size Cannot Be Fixed: A "Page-Varying" Font Size Algorithm

When first attempting "layout-preserving translation", many intuitively think of a simple approach:

"The original is roughly 10pt, so I'll just use 10pt uniformly after translation, right?"

This seems reasonable, but trying it on a few paper pages quickly reveals problems. Text blocks in PDFs are not identical blank sheets. Some are in double columns, some in captions, some boxes are wide, some narrow; some source sentences have only a dozen words, while Chinese translations may change length significantly.

Therefore, **font size cannot be a global constant; it must be a "quantity varying with page and block"**.

This article does not discuss specific code, only the underlying reasoning:

- Why font size cannot be fixed
- What basis we actually use to determine whether font size should increase or decrease
- How a reasonable dynamic algorithm should make judgments step by step
- Several concrete examples illustrating this judgment process

---

## 1. Before Calculating Font Size, Clarify What the Problem Actually Is

Placing translated text back into original boxes is essentially doing one thing:

**Fitting text as naturally as possible, as close to original visual style as possible, within limited rectangular space.**

There are actually three simultaneous goals:

1. Text must fit
2. Must not appear jarring
3. Must look coordinated within same page

If pursuing only "fitting", simplest method shrinks all text very small. This certainly prevents overflow but makes pages ugly.

If pursuing only "looking large", easily exceeds box, overlaps, hits bottom, or crowds other elements.

So the problem is not "finding a fixed font size", but:

**Dynamically finding balance between "fitting" and "looking like original".**

---

## 2. First Basis for Font Size Judgment: Whether Page Itself Is Dense or Sparse

Consider an intuitive example first.

### Example 1: Both Body Pages But Completely Different Density

Suppose two paper pages:

- Page A: Double-column body text dense, tight line spacing, almost no whitespace
- Page B: Only a few short paragraphs, large image in middle, very empty

If both forced to same font size:

- Page A likely cannot fit; more prone to overflow after translation
- Page B appears too small, empty

So first judgment must be:

**First determine whether page overall is "dense page" or "sparse page".**

This step need not be complex; core is observing blocks that "look like body text" on page and their typical rhythm:

- Average line height
- How tight lines are spaced
- Approximately how many characters fit at same width
- Whether most body blocks on page look compact or spacious

Think of it as:

**First find a "page baseline font size" for each page.**

This baseline is not final result but acts as anchor. Each subsequent block adjusts around this anchor.

---

## 3. Second Basis: How Large Is Block Box, Especially "Width" and "Height"

Page baseline alone insufficient because different blocks on same page have completely different environments.

### Example 2: Two Boxes on Same Page

Suppose same page has two text blocks:

- Block A: width 420, height 110
- Block B: width 180, height 110

Same height but width differs by over double.

If both use same font size:

- A has less line-break pressure
- B has very high line-break pressure

Especially after Chinese translation; once sentences slightly longer, text in narrow boxes rapidly accumulates into more lines.

So second judgment is:

**Same font size produces completely different effects in wide vs narrow boxes.**

Algorithm must focus on two geometric quantities:

- Box width: determines approximately how many characters per line
- Box height: determines maximum tolerable lines

Width mainly affects "will it line-break wildly"; height mainly affects "can it still fit after line-breaking".

---

## 4. Third Basis: How Much Translated Text "Expanded" vs Original

Box alone insufficient; must also consider content itself.

### Example 3: English Sentence Significantly Longer After Translation

Source:

`The catalyst significantly improves conversion efficiency under mild conditions.`

Translated:

`Chất xúc tác này có thể cải thiện đáng kể hiệu suất chuyển hóa trong điều kiện phản ứng tương đối nhẹ.`

Some language pairs have minor length changes, but some blocks expand noticeably, especially when:

- English abbreviations expanded
- Technical phrases lengthen in Chinese
- Formula placeholders require surrounding text reorganization

What truly matters is not "original point size" but:

**How much translated content density exceeds box capacity.**

Practical judgment method:

1. Estimate how many "text units" box can hold at current font size
2. Estimate how many "text unit spaces" translated content needs
3. Subtract to know whether currently loose or crowded

"Text unit" need not be strict character count; can be more visual, e.g.:

- Estimated visual lines after wrapping
- Character count excluding whitespace
- Different weights for formulas, punctuation, long words

Core idea is not specific formula but:

**Compare "content demand" against "box capacity".**

---

## 5. Real Core: Font Size Not Calculated Once But Decided in Three Layers

More stable dynamic algorithm usually not "one-shot guess" but three layers.

### Layer 1: Page Provides Baseline First

Based on overall page body density, give page rough baseline.

E.g.:

- Dense page: baseline 9.2pt
- Normal page: baseline 9.8pt
- Sparse page: baseline 10.4pt

Solves "should this page overall be tight or loose".

### Layer 2: Each Block Adjusts Based on Own Box and Content

Then examine block:

- Is box particularly narrow
- Is height very limited
- Is translated text significantly longer
- Many formulas, poor line-break space

If answers lean "crowded", adjust down from page baseline.
If answers lean "loose", allow slight increase.

Solves "compared to page average, is this block harder or easier to fit".

### Layer 3: Final Fit Check Before Actual Rendering

Even if first two layers reasonable, errors possible. Real rendering encounters unforeseen issues:

- Some glyphs wider than expected
- CJK-Latin mixed actual width differs from estimate
- Inline formula stretches line wider
- Punctuation distribution causes worse actual wrapping than estimated

Mature solutions must do final step:

**Actually test current font size; if still exceeds box, scale proportionally.**

This is final safety net.

---

## 6. What Algorithm Actually Looks At: 5 Judgment Signals

Compressing above reasoning into core judgment bases yields five signal categories:

### 1. Page Density

Denser page overall → smaller baseline font.
Sparser page overall → larger baseline font.

### 2. Box Width

Narrower box → higher line-break pressure → more conservative font size.
Wider box → more room to maintain natural font size.

### 3. Box Height

Shorter box → fewer tolerable total lines → riskier font size.
Taller box → more line-break margin.

### 4. Text Content Density

Longer/tighter/harder-to-split translated content → font size needs reduction.
Shorter content with clear semantic blocks → font size easier to maintain.

### 5. Special Content Ratio

When formulas, long tokens, unbreakable fragments numerous, "theoretical capacity" becomes less reliable.

For such blocks, algorithm usually more conservative; does not enlarge font as boldly as normal body.

---

## 7. Complete Example Walking Through Entire Judgment Process

More complete example below.

### Scenario

Page is double-column paper page, overall dense.

Algorithm observes:

- Most body line spacing tight
- Mainstream body blocks on page not tall
- Little whitespace

Gives page-level baseline:

- **Page baseline font = 9.4pt**

Now target block:

- bbox width: 190
- bbox height: 96
- Translated text relatively long
- Contains multiple formula placeholders

How does algorithm think?

### Step 1: Start From Page Baseline

Assume block also uses 9.4pt initially.

### Step 2: Check If Box Hard to Fit

Box relatively narrow, height not large either. Means:

- Not many characters per line
- Once line breaks increase, total height fills quickly

Algorithm concludes:

**This block harder to fit than "page average block".**

Adjusts font down from 9.4pt, e.g., to 9.0pt.

### Step 3: Check If Content Difficult

Translated text long with many formulas. Formula trouble:

- May not break as easily as normal text
- Some lines wider than estimated due to formulas

Algorithm continues conservatively, perhaps from 9.0pt to 8.7pt.

### Step 4: Final Fit Check

8.7pt not necessarily correct.
Actual render test shows last line still slightly exceeds box.

Final step shrinks further, e.g., to 8.5pt.

Final result:

- Page baseline 9.4pt
- Block-adjusted 8.7pt
- Final fit 8.5pt

Typical "dynamic variation by page and block" process.

---

## 8. Why This Algorithm More Reliable Than "Linear Scaling"

Many systems start with direct approach:

"Text exceeded by X%, shrink font by proportional %."

Useful but insufficient.

Assumes premise:

**Text length and real layout pressure have linear relationship.**

Actually not true.

E.g.:

- Same character count completely different in wide vs narrow box
- Same character count completely different with vs without formulas
- Same character count different on already-dense page vs sparse page

More reasonable algorithm looks beyond "how many characters exceeded" to comprehensive judgment:

- Is page itself tight
- Is box hard to fit
- Is content hard to lay out
- Does real render still exceed

In other words:

**Font size variation should be layered judgment converging gradually, not single linear function.**

---

## 9. Common Pitfalls of This Approach

Though much better than fixed font, easily falls into traps.

### 1. Over-Trusting OCR

If OCR misidentifies two lines as one, you think page has large line spacing and sparse content; page baseline overestimated. Entire page fonts may be too large.

### 2. Over-Relying on Character Count

Character count is rough metric only. What truly determines layout pressure:

- Can lines break
- How many lines after breaking
- Whether some lines contain particularly wide content

### 3. Hard-Capping Minimum Font Size

Global hard floor like never below 9.6pt causes many extreme narrow boxes to fail.

But floor too low degrades visual quality noticeably.

Minimum font should not be dead; should have dynamism:
Normal body, extremely dense, formula-dense blocks can have different tolerance ranges.

### 4. Estimation Only Without Final Measurement

No matter how smart estimation, without real fit check will encounter "estimated OK but actually overflows".

---

## 10. Compressing Algorithm Into One Sentence

Summarized in one sentence:

**First observe page average rhythm, then block geometric pressure, then content density, finally converge with real render result.**

This is core idea of "font size varying by page".

Not pursuing mathematical optimality but achieving more stable, natural, less box-exploding results in real PDFs.

---

## 11. Final Engineering Summary

Reliable dynamic font algorithm usually does not ask:

"What point size for this block?"

But continuously asks four questions:

1. What is overall page rhythm?
2. Relative to whole page, is this block harder or easier to lay out?
3. How much does translated content exceed box capacity?
4. After real rendering, did it actually fit?

Only after all four answered does font size look "calculated" rather than "guessed".

</content>