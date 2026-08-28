

# 1. Kiến trúc tổng thể được khuyến nghị

Không dịch theo trang, cũng không dịch theo block thô. Khuyến nghị sử dụng **đơn vị dịch (TU - translation unit)** làm đơn vị dịch tối thiểu.

Nhưng TU ở đây không phải là một câu đơn giản, cũng không phải là một block OCR. Nó nên là một đối tượng với các ràng buộc cấu trúc:

```json
{
  "tu_id": "p0123_b0045_u0002",
  "page_idx": 123,
  "block_ids": ["b0045"],
  "source_text": "...",
  "protected_spans": [...],
  "layout_anchor": {
    "bbox": [...],
    "reading_order": 45,
    "block_kind": "text",
    "layout_role": "body"
  },
  "context": {
    "prev_summary": "...",
    "next_hint": "...",
    "section_title": "..."
  },
  "constraints": {
    "must_terms": [...],
    "placeholders": [...]
  }
}
```

Thiết kế lại pipeline được khuyến nghị:

```
OCR normalized JSON
→ layout graph construction
→ block cleanup / formula / placeholder protection
→ TU segmentation
→ continuation candidate detection
→ glossary / memory retrieval
→ immutable context snapshot
→ scheduling / batching
→ LLM structured translation
→ deterministic validator
→ targeted retry
→ targeted repair
→ second validator
→ degraded export decision
→ diagnostics / manifest
```

Ba thay đổi chính:

1. **Xây dựng đồ thị bố cục trước, sau đó phân đoạn TU**

    Không đơn giản nối theo reading_order. Xem các block như nút đồ thị với các cạnh bao gồm:

    - Same-page adjacency
    - Same-column adjacency
    - Cross-column candidates
    - Cross-page candidates
    - Title to body
    - Figure caption to figure
    - Footnote to body reference
2. **Tách biệt đơn vị dịch với đơn vị kết xuất**

    A TU can span multiple blocks, but backfill must still preserve original block anchors.

    This way, incorrect continuation decisions will not immediately destroy page structure.

3. **Tất cả đầu ra đều mang trạng thái**

    Each TU should finally have:


```json
{
  "status": "ok | repaired | warning | failed | fallback_source",
  "severity": "P0 | P1 | P2 | P3",
  "validator_errors": [...],
  "repair_attempts": 1,
  "exportable": true
}
```

Hệ thống tài liệu lớn sợ nhất một điều: hoặc tất cả thành công hoặc tất cả thất bại.

Tác vụ 500 trang phải cho phép **thất bại cục bộ, suy giảm cục bộ, xuất tổng thể**.

# 2. Cách lựa chọn giữa Block, Paragraph, Page, TU

Kết luận khuyến nghị:

| Độ chi tiết | Được khuyến nghị? | Lý do |
| --- | --- | --- |
| --- | ---: | --- |
| page | Không khuyến nghị làm đơn vị dịch tối thiểu | Prompt quá lớn, cấu trúc trang phức tạp, chi phí thất bại cao, chi phí thử lại cao |
| block | Không khuyến nghị dịch trực tiếp | Block OCR thường chia nhỏ câu; thuật ngữ và ngữ cảnh không ổn định |
| paragraph | Có thể dùng làm lớp trung gian | Phù hợp với văn bản chính, nhưng không ổn định với bảng, chú thích, chú thích cuối, văn bản gần công thức |
| TU | Được khuyến nghị | Có thể phân đoạn động theo ngữ nghĩa và bố cục; phù hợp với đồng thời, xác thực, sửa chữa, điền lại |

Kích thước TU được khuyến nghị:

```
Normal body text: 80 to 300 tokens
Complex scientific paragraphs: 100 to 500 tokens
Table cells: one cell or a group of similar cells
Captions: complete caption
Titles: standalone TU
Formula descriptions: text outside formula as separate TU; formula itself protected
Footnotes: standalone TU, but with citation context
```

Không theo đuổi TU lớn hơn.

TU lớn hơn cải thiện ngữ cảnh nhưng tăng bản dịch trống, rò rỉ giải thích, timeout và hỏng định dạng. Các triệu chứng hiện tại của bạn đã cho thấy kích thước batch hoặc TU quá lớn, ràng buộc quá nhiều và chiến lược thử lại chưa đủ phân tầng.

# 3. Nên đặt phát hiện tiếp nối ở đâu

Khuyến nghị phương pháp ba giai đoạn:

```
Before LLM: rules + layout graph generate continuation candidates
During LLM: only allow low-risk semantic relationship judgment; do not modify structure directly
After translation: only local repair; no large-scale rearrangement
```

## 3.1 Phải làm trước LLM

    Tiếp nối chủ yếu là vấn đề cấu trúc; sử dụng quy tắc để đánh giá ứng viên trước. Tín hiệu bao gồm:

1. Geometric signals
    - bbox vertical distance
    - same-column x overlap
    - column width
    - page margins
    - cross-page or not
    - in header/footer region or not
2. Text signals
    - whether previous block ends with period, question mark, colon, semicolon
    - whether next block starts lowercase
    - hyphenated word break
    - looks like list numbering
    - looks like title
    - contains formula number
3. Semantic role signals
    - body followed by body can be candidate
    - title followed by body should not merge
    - caption followed by body usually does not merge
    - footnote followed by body does not merge; only establish reference relationship
4. reading_order signals
    - consecutive order on same page
    - cross-column order jump
    - cross-page from last body of previous page to first body of next page

    Đầu ra không nên là có/không trực tiếp, mà là:

```json
{
  "edge_type": "same_paragraph_candidate",
  "confidence": 0.82,
  "risk": "low | medium | high",
  "reasons": ["no_terminal_punctuation", "same_column", "small_vertical_gap"]
}
```

## 3.2 LLM chỉ nên xử lý các ứng viên có độ tin cậy thấp

    Không để LLM tự do quyết định gộp trang chéo.

    Nó có thể trả lời:

```json
{
  "is_continuation": true,
  "confidence": 0.67,
  "reason_code": "sentence_continues"
}
```

    Nhưng nó không thể trực tiếp gộp hai block thành cấu trúc mới. Việc ghi cấu trúc phải được thực thi bởi lớp quy tắc của bạn.

## 3.3 Phương pháp giảm thiểu đánh giá sai nghiêm trọng

    Quy tắc quan trọng nhất: **không thực hiện gộp phá hủy**.

    Tức là, ngay cả khi hai block được đánh giá là tiếp nối, không xóa các block gốc. Sử dụng nhóm đoạn ảo:

```json
{
  "paragraph_group_id": "pg_123",
  "members": ["b10", "b11"],
  "merge_mode": "virtual",
  "render_split": "preserve_original_blocks"
}
```

    Trong quá trình dịch, chúng có thể được coi là một TU hoặc các TU liền kề, nhưng điền lại vẫn tách theo anchor block.

    Nếu việc tách lại khó khăn, hãy để một TU tạo ra translated_segments cho nhiều block:

```json
{
  "tu_id": "tu_123",
  "segments": [
    {"block_id": "b10", "translated_text": "..."},
    {"block_id": "b11", "translated_text": "..."}
  ]
}
```

    Chiến lược tiếp nối rủi ro cao:

```
High confidence: allow virtual merged translation
Medium confidence: translate separately, but provide read-only neighbor context
Low confidence: completely separate; only enter diagnostics
```

    Điều này ngăn việc đánh giá sai leo thang thành rò rỉ ngữ cảnh thành sự cố cấp trang.

# 4. Cấp độ cổng chất lượng

    Bạn không nên chỉ có pass/fail. Khuyến nghị bốn cấp độ.

## 4.1 P0: Phải chặn xuất bản của TU này

    Những vấn đề này không được phép:

| Loại | Ví dụ | Xử lý |
| --- | --- | --- |
| Bản dịch trống | source không trống nhưng target trống | thử lại hoặc sửa; nếu thất bại, fallback_source và đánh dấu đỏ |
| Lỗi schema | JSON parse thất bại, thiếu trường, id không khớp | thử lại |
| Lỗi đếm mục | input 10 TUs, output 9 hoặc 11 | thử lại |
| Mất placeholder | `⟦PH_001⟧` mất, trùng lặp, bị viết lại | sửa; thất bại nếu không thành công |
| Hỏng công thức | mất token LaTeX, số công thức sai | sửa hoặc khôi phục |
| Rò rỉ giải thích | xuất hiện "this can be translated as" "Here is the translation" | sửa |
| Rõ ràng không dịch | toàn bộ đoạn tiếng Anh còn nguyên khi target là tiếng Trung | thử lại/sửa |
| Cắt xén nghiêm trọng | độ dài target ngắn bất thường, ngữ nghĩa rõ ràng không đầy đủ | thử lại |
| Sai trang/id | target ghi vào tu_id khác | chặn |
| Lỗi thứ tự span được bảo vệ | trích dẫn, chú thích cuối, thứ tự công thức bị xáo trộn | sửa |

    P0 là **chặn cục bộ**, không phải chặn toàn bộ PDF.

    Trừ khi P0 vượt ngưỡng, ví dụ:

```
P0 TU ratio > 0.5%
or P0 page ratio > 2%
or 3 consecutive pages have P0
```

    Khi đó chặn xuất bản toàn bộ tài liệu.

## 4.2 P1: Phải cố gắng sửa, nhưng cho phép xuất bản suy giảm

| Loại | Ví dụ | Xử lý |
| --- | --- | --- |
| Lỗi ràng buộc thuật ngữ cứng | user glossary quy định A phải dịch thành B | sửa |
| Tiếng Anh dư thừa mức độ vừa | cụm tiếng Anh còn lại, nhưng không phải công thức/viết tắt | sửa |
| Lỗi định dạng nhỏ | đánh dấu danh sách, ngắt dòng, dấu câu không nhất quán | sửa |
| Tỷ lệ độ dài bất thường | tỷ lệ target/source bất thường | sửa |
| Đầu ra trùng lặp | cùng một câu lặp lại hai lần | sửa |
| Phong cách lệch đáng kể | trở thành tóm tắt, giải thích, viết lại | sửa |

Sau khi sửa P1 thất bại, xuất bản được phép nhưng phải ghi vào manifest.

## 4.3 P2: Chỉ vào chẩn đoán

| Loại | Ví dụ |
| --- | --- |
| Không dùng thuật ngữ ưu tiên mềm | không dùng từ được khuyến nghị trong glossary domain |
| Dư tiếng Anh nhẹ | DNA, HOMO, Gaussian có thể cố ý giữ nguyên không dịch |
| Tiếp nối độ tin cậy thấp | cấu trúc không chắc chắn nhưng không gây lỗi định dạng |
| Bản dịch hơi dài | có thể ảnh hưởng bố cục nhưng không hỏng nội dung |
| Không nhất quán phong cách nhẹ | "calculation results show" vs "calculation results indicate" |

## 4.4 P3: Số liệu thống kê

Ví dụ:

```
Tỷ lệ mở rộng độ dài trung bình
Tỷ lệ khớp thuật ngữ
Tỷ lệ sửa thành công
Số lần thử lại đuôi
Số cảnh báo mỗi trang
```

P3 không ảnh hưởng xuất bản; chỉ dùng cho số liệu sức khỏe và kiểm thử hồi quy.

# 5. How to Design Repair Pipeline

Repair must not be re-translating.

Repair should be **targeted fixes for validator errors**.

Recommended state machine:

```
translate
→ validate
→ if P0/P1: targeted retry
→ validate
→ if still failed: targeted repair
→ validate again
→ if still failed: fallback policy
→ manifest
```

LLM repair must go through validator again.

Do not blur this boundary. Whenever LLM participates in generation, results must pass validator. Structured output and validator are core defenses of production systems, not prompt accessories. Structured output reduces parsing and format drift risks but still requires schema validation and business rule checks. [Cohere, Validating Outputs, https://cohere.com/llmu/validating-llm-outputs, accessed 2026-05-27][[1]](https://cohere.com/llmu/validating-llm-outputs)

## 5.1 Repair Input Should Be Small

Do not stuff entire page into repair. Give it:

```json
{
  "source_text": "...",
  "bad_translation": "...",
  "validator_errors": [
    {
      "code": "PLACEHOLDER_MISSING",
      "missing": ["⟦MATH_003⟧"]
    }
  ],
  "constraints": {
    "must_keep_placeholders": ["⟦MATH_003⟧"]
  }
}
```

Let it output only:

```json
{
  "tu_id": "...",
  "repaired_translation": "..."
}
```

## 5.2 Repair Classification

| Error | Recommended Repair Method |
| --- | --- |
| Placeholder loss | Rule fix first if position determinable; LLM otherwise |
| Formula corruption | Prefer rule backfill; do not let LLM rewrite formulas |
| Empty translation | Re-translate; not called repair |
| English residue | LLM repair |
| Explanation leakage | Rule stripping + validator; LLM repair if necessary |
| Term miss | LLM repair, but provide hard glossary |
| Duplicate output | Rule dedup priority; LLM if semantic uncertainty |
| Continuation merge error | Do not recommend hard repair; return to TU segmentation and rerun local region |

## 5.3 What to Do After Repair Failure

Do not silently keep bad translations. Recommended strategies:

```
P0 repair failure:
  fallback_source, mark failed_exportable=false or true depending on business
  record in manifest
  prompt manual review in UI

P1 repair failure:
  keep best candidate
  status=warning
  record in diagnostics

P2:
  no repair; only record
```

Allow fallback to source text?

Yes, but must explicitly mark:

```json
{
  "status": "fallback_source",
  "reason": "EMPTY_TRANSLATION_REPAIR_FAILED",
  "display_text": "Original text...",
  "needs_review": true
}
```

Do not disguise fallback_source as successful translation. This is a major pitfall.

# 6. How to Handle Tail Latency

Your last few batches are slow, typically from four causes:

1. Batch contains extra-long items
2. Some requests trigger model slow path
3. 429 backoff causes queuing
4. When main queue nears end, only stragglers remain

Recommend three queues:

```
main_queue: first-pass translation
retry_queue: retry after 429 / 5xx / timeout
tail_queue: slow items, difficult items, repair items
```

Do not retry infinitely in main queue. Main queue should only run first attempts and minimal fast retries.

## 6.1 Timeout Strategy

Set dynamic timeout by token length:

```
timeout = base + α * input_tokens + β * expected_output_tokens
```

Do not use one timeout for all items. Long paragraphs and short titles should not be treated equally.

## 6.2 429

429 must respect `Retry-After`. When this header is absent, use exponential backoff + jitter. Common 429 handling includes rate limiting, queuing, waiting per server hints, exponential backoff. [Postman, HTTP Error 429 Too Many Requests, https://blog.postman.com/http-error-429/, accessed 2026-05-27][[2]](https://blog.postman.com/http-error-429/)

Strategy:

```
429:
  put into throttle_retry_queue
  rate limit by provider/model dimension
  do not occupy main_queue workers
```

## 6.3 5xx

```
5xx:
  retry 1 to 2 times
  exponential backoff + jitter
  exceed count → enter tail_queue
```

## 6.4 Single Slow Item

Recommend:

```
Exceeds current model p95 latency:
  mark slow_candidate

Exceeds p99 or hard deadline:
  cancel or hedge
  put into tail_queue
```

Hedged requests can reduce tail latency but use cautiously. Requests are expensive for LLMs; do not duplicate indiscriminately. Only hedge for:

```
High-value tasks
Near deadline
Few remaining in queue
Low 429 rate
Sufficient available token budget
```

## 6.5 When to Start Tail Retry

Two trigger conditions:

```
main_queue remaining < 10% to 20%
or
item age > p95_latency * 1.5
```

Resource allocation recommendation:

```
main_queue: 80% workers
retry_queue: 15% workers
tail_queue: 5% workers
```

When main_queue drops below 20%:

```
main_queue: 50%
retry_queue: 25%
tail_queue: 25%
```

This prevents tail from preempting normal tasks.

## 6.6 Batch Strategy

Do not use fixed batch size. Use token bucket batching:

```
Per-batch limits:
  max_items
  max_input_tokens
  max_expected_output_tokens
  max_layout_complexity
```

And bucket by complexity:

```
short_title
normal_paragraph
long_paragraph
table_cell
caption
formula_heavy
repair
```

Do not mix formula-heavy items with normal body text in one batch. One bad item slows the entire batch.

# 7. How to Design Glossary / Memory / Context

Terminology consistency should not rely on stuffing all glossaries into prompts.

Should implement **layering + retrieval + hard/soft constraint distinction**.

Translation memory and glossary are different things: TM reuses previously translated segments; glossary manages terminology and specified translations. Both improve consistency but serve different purposes. [Language Scientific, What's The Difference Between Translation Memory and Glossary, https://www.languagescientific.com/whats-the-difference-between-translation-memory-tm-and-a-glossary/, accessed 2026-05-27][[3]](https://www.languagescientific.com/whats-the-difference-between-translation-memory-tm-and-a-glossary/)

CAT/TMS tools also typically handle glossary, translation memory, tag or placeholder QA separately. [Smartcat, Translation memories glossaries, https://help.smartcat.com/6987550190610-leveraging-smartcat-linguistic-assets/, accessed 2026-05-27][[4]](https://help.smartcat.com/6987550190610-leveraging-smartcat-linguistic-assets/)

## 7.1 Recommended Priority

```
L0 user-enforced glossary
L1 project glossary
L2 in-document terminology table
L3 auto-extracted memory
L4 domain wordlist
L5 model default knowledge
```

On conflict:

```
User-enforced glossary > project glossary > document terminology > memory > domain wordlist
```

Each term should carry attributes:

```json
{
  "source": "oscillator strength",
  "target": "cường độ dao động tử",
  "priority": "hard | preferred | hint",
  "domain": "computational_chemistry",
  "case_sensitive": false,
  "allowed_variants": ["cường độ dao động tử"],
  "do_not_translate": false
}
```

## 7.2 Inject Per-Item by Match; Do Not Inject Globally for Entire Document

Recommend putting in prompt:

```
Global: translation style, target language, small number of highest-priority terms
Local: hard/preferred terms matched by current TU
Retrieval: top-K similar TM examples
Context: previous paragraph summary; do not include large amounts of source text
```

Local glossary retrieval:

```
source_text exact match
+ lemma/stem match
+ phrase match
+ domain match
+ section match
```

Recommended term injection counts per TU:

```
hard terms: unlimited, but usually few
preferred terms: top 10 to 30
hint terms: top 5 to 10
TM examples: top 1 to 3
```

Do not exceed these amounts. Larger prompts reduce speed and stability; you have already encountered this.

## 7.3 Term Validator

Terminology consistency should not rely solely on prompts. Implement validator:

```
If source contains hard term:
  target must contain specified translation
Otherwise P1 repair

If source contains preferred term:
  target miss → P2 diagnostics
```

Term QA and placeholder QA are common translation quality checks. [Phrase, Quality Assurance Strings, https://support.phrase.com/hc/en-us/articles/5820046486684-Quality-Assurance-Strings, accessed 2026-05-27][[5]](https://support.phrase.com/hc/en-us/articles/5820046486684-Quality-Assurance-Strings)

# 8. Translation Memory Concurrent Updates

Do not let all workers read/write the same memory in real time during translation.

This causes instability:

```
worker A translates term X as 甲 first
worker B simultaneously translates term X as 乙
worker C reads 甲
worker D reads 乙
Final result drifts across book
```

Recommend **snapshot + epoch merge**.

## 8.1 Before Document-Level Task Starts

```
Read user glossary
Read project glossary
Read domain glossary
Read historical TM
Construct memory_snapshot_v1
```

All workers read-only snapshot in same round.

## 8.2 Merge Every Chapter or Every N Pages

Example:

```
One epoch per 20 pages
or one epoch per chapter
```

After epoch ends:

```
Collect validator-passed high-confidence translations
Extract term candidates
Detect conflicts
Update document_memory_v2
Next epoch uses new snapshot
```

This improves long-document consistency without fully sacrificing earlier context for later sections.

## 8.3 What Can Enter TM

Only allow these:

```
status=ok
or status=repaired and second_validator_pass=true
and no P0/P1
and source/target length ratio normal
and no significant English residue
```

Do not write fallback_source, warning, or unconfirmed repairs into TM. Otherwise bad translations spread.

# 9. Preventing Model Explanation Leakage: What Matters Most

Ranked as follows:

```
structured output / constrained decoding
> validator
> retry / repair
> prompt constraints
```

Prompt is only a soft constraint layer.

Production systems cannot rely on "only output translation" to solve problems.

Recommended output schema:

```json
{
  "items": [
    {
      "tu_id": "string",
      "translation": "string",
      "status": "translated"
    }
  ]
}
```

Strict requirements:

```
additionalProperties=false
items count must equal input
tu_id must match exactly
translation must not be empty
translation must not contain explanatory templates
```

Explanation leakage detection can use rules:

```
"Here is the translation"
"Sure,"
"This passage means"
"Can be translated as"
"Translation follows"
"I will"
"As a"
```

But do not rely only on keywords. Add two more checks:

```
Does target contain large source copy
Does target contain instruction/prompt fragments
```

If structured output still leaks, directly P0/P1:

```
First time: retry with stricter error message
Second time: repair strip/extract
Third time: failed or fallback_source
```

# 10. How to Protect Formulas, Placeholders, Inline Math

For scientific paper/textbook PDFs, formula protection must rely on rule-based placeholders.

Do not trust models to preserve formulas by format.

Reason is simple: formulas are precise objects, not natural language. Mathematical formula translation has extremely high symbol precision requirements, unlike ordinary text translation. [Petersen et al., Neural Machine Translation for Mathematical Formulae, ACL 2023, https://aclanthology.org/2023.acl-long.645.pdf][[6]](https://aclanthology.org/2023.acl-long.645.pdf)

## 10.1 Protected Objects

Recommend protecting:

```
display math
inline math
LaTeX commands
formula numbers
citation numbers [1], (3.2), Eq. (5)
variable names
units
chemical formulas
DOI / URL / email
placeholders
figure/table references
footnote markers
```

Example:

```
The oscillator strength $f$ is defined by Eq. (3).
```

First becomes:

```
The oscillator strength ⟦MATH_001⟧ is defined by ⟦REF_001⟧.
```

After translation:

```
Cường độ dao động tử ⟦MATH_001⟧ được định nghĩa bởi ⟦REF_001⟧.
```

Then restore:

```
Cường độ dao động tử $f$ được định nghĩa bởi Eq. (3).
```

If you want "Eq. (3)" localized to "式 (3)", do not protect `Eq. (3)` as whole; instead split into:

```
Eq. ⟦REFNUM_001⟧
```

Let model translate Eq.; protect the number.

## 10.2 Placeholder Token Design

Tokens must satisfy:

```
Model unlikely to rewrite
Regex easily identifiable
No conflict with body text
Preserves order
Supports multiset check
```

Recommend:

```
⟦MATH_000001⟧
⟦PH_000002⟧
⟦REF_000003⟧
⟦CHEM_000004⟧
```

Validator checks:

```
Input placeholder multiset == output placeholder multiset
Whether order variation allowed
Unknown placeholders present
Duplicates present
Losses present
```

Formulas should not be repaired by LLM.

Use rule repair when possible; re-translate the TU when rule repair is not possible.

# 11. Which Issues Go Before Main Translation, After Translation, Into Diagnostics

## 11.1 Must Resolve Before Main Translation

| Issue | Reason |
| --- | --- |
| OCR block cleaning | Dirty input amplifies LLM errors |
| Header/footer/page number identification | Otherwise pollutes context |
| Formula / placeholder protection | Hard constraint |
| TU segmentation | Determines concurrency granularity and failure boundary |
| Continuation candidate detection | Structural problem must be done first |
| Glossary conflict resolution | Otherwise translation drift front-to-back |
| Memory snapshot | Concurrent consistency depends on it |
| Batch bucketing | Avoid long items slowing short items |
| Export policy | Define what is exportable first |

## 11.2 Post-Translation Repair

| Issue | Repair Method |
| --- | --- |
| Empty translation | Re-translate, not patch |
| English residue | LLM repair |
| Explanation leakage | Rule stripping + LLM repair |
| Term miss | LLM repair |
| Minor placeholder misalignment | Rules priority |
| Duplicate output | Rule dedup or LLM repair |
| Length anomaly | Re-translate or LLM repair |
| Style drift | LLM repair |

## 11.3 Diagnostics Only

| Issue | Reason |
| --- | --- |
| Soft glossary miss | Should not block long documents |
| Minor English abbreviation residue | Common in scientific text |
| Low-confidence continuation | Record for manual review |
| Minor length expansion | Hand to rendering or manual review |
| Minor style fluctuation | Hard to fully eliminate in large documents |
| Suspected term conflict | Can resolve in next glossary update round |

## 11.4 Where Rule-Based Hard Fixes Should Not Be Used

| Scenario | Why |
| --- | --- |
| Complex semantic retranslation | Rules do not understand semantics |
| Large-scale continuation rearrangement | Easily breaks layout |
| Grammar adjustments caused by terms | Requires LLM |
| Long sentence English residue | Rule replacement easily creates broken sentences |
| Table semantic normalization | Requires context |
| Cohesion after paragraph merging | Requires LLM |

Rules suit protection, detection, rollback, local recovery.

LLM suits semantic translation, term integration, broken sentence repair.

# 12. Recommended Metrics for 500+ Pages

Monitor three categories: throughput, quality, structural risk.

## 12.1 Performance Metrics

```
per_item_latency_p50 / p90 / p95 / p99
per_batch_latency_p50 / p95 / p99
queue_wait_time
tokens_per_second
items_per_minute
pages_per_hour
main_queue_remaining
retry_queue_size
tail_queue_size
tail_queue_oldest_age
timeout_count
429_count
5xx_count
hedged_request_count
cancelled_request_count
```

Focus on p95/p99, not just averages. Tail latency is inherently a distribution problem; a few stragglers can drag down overall completion time. [Tail Latency Study, https://accelazh.github.io/storage/Tail-Latency-Study, accessed 2026-05-27][[7]](https://accelazh.github.io/storage/Tail-Latency-Study)

## 12.2 Translation Quality Metrics

```
empty_translation_count
schema_error_count
explanation_leak_count
source_copy_ratio
english_residual_ratio
length_ratio_outlier_count
duplicate_output_count
truncation_count
retry_success_rate
repair_success_rate
second_validator_fail_rate
fallback_source_count
```

## 12.3 Structure Protection Metrics

```
placeholder_mismatch_count
formula_mismatch_count
unknown_placeholder_count
placeholder_order_error_count
inline_math_restore_fail_count
citation_marker_error_count
table_cell_count_mismatch
list_marker_damage_count
```

## 12.4 Terminology Consistency Metrics

```
hard_glossary_hit_rate
preferred_glossary_hit_rate
glossary_conflict_count
term_translation_variants_per_doc
term_drift_by_chapter
TM_reuse_rate
TM_conflict_rate
memory_update_rejected_count
```

## 12.5 Continuation Risk Metrics

```
continuation_candidate_count
high_confidence_merge_count
medium_confidence_context_only_count
cross_page_merge_count
cross_column_merge_count
continuation_repair_count
context_bleed_suspected_count
paragraph_split_error_count
```

## 12.6 Document-Level Export Metrics

```
P0_count
P1_count
P2_count
P0_page_count
P1_page_count
failed_TU_ratio
fallback_TU_ratio
review_required_page_count
export_blocked_reason
```

Recommend defining health thresholds:

```
green:
  P0 ratio < 0.1%
  fallback ratio < 0.2%
  hard glossary hit rate > 99%
  placeholder mismatch = 0 after repair

yellow:
  P0 ratio < 0.5%
  fallback ratio < 1%
  P1 ratio < 3%

red:
  P0 ratio >= 0.5%
  fallback ratio >= 1%
  placeholder mismatch unresolved > 0
  formula restore fail > 0
```

# 13. Recommended Final Strategy

If I were to define an engineering plan for you, I would do this:

## 13.1 Before Main Translation

```
1. Build layout graph
2. Clean header/footer/page numbers
3. Protect formulas, placeholders, citations, chemical formulas, units
4. Segment TUs; do not segment directly by block or page
5. Continuation generates only candidates and confidence
6. Glossary resolves conflicts first, then layers
7. TM uses snapshot
8. Batch buckets by token and complexity
```

## 13.2 During Translation

```
1. Structured output
2. Every output must carry tu_id
3. Prohibit free-text output
4. Small batches, many workers
5. Main queue does not do heavy retries
6. 429 / 5xx / timeout handled in separate queues
```

## 13.3 After Translation

```
1. Deterministic validator runs first
2. Only P0/P1 trigger repair
3. Repair must pass second validator
4. Failed repair → fallback_source or failed
5. Few bad TUs do not block entire book
```

## 13.4 Glossary / Memory

```
1. User glossary highest priority
2. Each TU injects only matched terms
3. Document-level puts only small number of global rules
4. TM concurrent read-only snapshot
5. Merge memory every chapter or every 20 pages
6. Only validator-passed translations enter memory
```

## 13.5 Export

```
1. P0 unresolved: mark TU as failed or fallback_source
2. Document export decision based on thresholds, not single-point failures
3. Manifest records all degradations
4. Diagnostics for manual review
```

Summary in one sentence:

> The core of large PDF translation systems is not getting every item right on first pass, but ensuring every item can be isolated, validated, repaired, degraded, and traced.
>

> Page is the rendering unit, block is the layout unit, TU is the translation unit.
>

> Continuation, formulas, placeholders, glossary conflicts must be controlled before translation; English residue, explanation leakage, term misses go to post-translation repair; soft glossary and low-confidence structural risks enter diagnostics.
>

</content>