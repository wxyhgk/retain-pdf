# Continuation 子包说明

这个子包专门放段落连续性相关逻辑，也就是判断哪些 OCR 块应该连成同一个翻译单元。

## 分工

- `rules.py`
  文本起止特征、bbox 几何关系、join/break 评分。
- `state.py`
  先消费 provider hint，再把规则结果写回 payload，维护 continuation group 和 candidate 标记。
- `pairs.py`
  导出候选 pair，以及审批通过后的 join 回写。
- `review.py`
  把候选 pair 送给模型审阅。

## 当前策略

当前 continuation 采用 provider-first，但不是 provider-only：

- 如果 payload 已带 `ocr_continuation_*` 字段，且属于同页 `intra_page` provider hint，`state.py` 会优先直接建组
- 如果属于跨页 `cross_page` provider hint，当前只在“相邻两页 + reading_order 唯一 + layout_zone 命中页尾/页首阅读边界 + 文本长度足够”时受控消费
- 这些 item 标记为 `provider_joined`，后续规则不再重复消费
- 没有可用 provider hint 的部分，仍继续走本地规则拼接
- 不满足受控条件的 `cross_page` provider hint 会继续保留在 payload 里，但不会直接驱动拼接
- 规则扫描不得因中间缺页（payload 里 page_idx 不连续）整段中止；`pair_join_score` 仍只允许相邻 `page_idx` 直接 join
- 双栏 L→R 优先信 `layout_zone`，窄栏缝（&lt;8pt）也允许 bbox 判定
- 后一段若像章节号标题（如 `2.2.1 Title`），硬 break，避免把残句拼进新小节
- 跨页只接正文：前一块要是上一页正文的最后一块、后一块要是下一页正文的第一块。头尾只在能接续的正文块里算（`state._body_boundary_roles`），
  页首是图注、图片时下面第一段正文照样算页首；分区排序不全时照旧用 `layout_boundary_role`
- 规则说该连、但跨页头尾不对的一对，不管是在主循环还是链条延伸时碰到，都标成候选交给模型复核，不悄悄断开
- 复核通过的一对连成组时，两块原来所在的组整组并进来（`pairs.apply_candidate_pair_joins` 按阅读顺序排成一串），不覆盖
- 模型判过的对（连 / 不连）写进译文目录的 `continuation-review-memo.json`（`workflow/phases/continuation_memo.py`），
  重试时 runner 跟 `domain-context.json` 一起拷进新任务，判过的对直接用、只把新出现的对交给模型。每对记下两块原文的摘要，
  原文变了（OCR 重做过）就重新判；模型这一批回复解析不了时不记结论，下次照旧复核
- 续跑（重试、断点接着翻）每次都从头重新分组，和上一轮分得不一样时（上一轮解析不了的那批这次判了「连」、规则的输入变了），
  已经译好的块不和没译的块拼成一组：`core/orchestration/units.py` 的 `keep_translated_blocks_out_of_mixed_groups`
  在 `finalize_payload_orchestration_metadata` 第一步把这种组里有译文的块挪出去（`continuation_decision=kept_translated`），
  没译的块照旧成组。否则整组进待办，断点守卫报 `completed items regressed to pending`、整本失败，而且「连」已经记进 memo，
  每次重试都在同一处失败（2026-11-26 桌面版 1000 多页的书）。整组都有自己译文、或者整组都没译的组不动，新任务不受影响
  - 上一轮整组一起译完的单元不拆（成员身上记着同一段整组译文、而且这些块全在这一组里）：留在一起另成一组，只把没译的块挪出去。
    以前也一块块挪出去，成员级译文是空的那块（上一轮切分时整段放进了别的成员）挪出来后渲染退回整组译文，同一段排两遍（审查第 8 条）。
  - 拆不回原来单元的块挪出来时，单元译文换成它自己那一段；它自己那一段是空的时照旧算译完（内容在别的成员那一段里，
    改成待办会让守卫报 regressed）。
  - 不翻的成员（`should_translate=False`）不让一段凑够两块；写回时只按要翻的成员切分（`core/payload/parts/apply.py`
    的 `apply_group_translated_entry`），以前分给不翻成员的那一段被扔掉，译文少一截（审查第 7 条）

这样做的目的很明确：

- 已经会同页拼接的新 OCR 模型，不需要再被本地规则二次猜测
- 还不会拼接的模型，继续复用现有规则
- 后续如果出现能稳定提供跨页连续组的新模型，也只需要扩展 hint 消费策略，不需要把 provider 私有结构灌进翻译主线

## 对外接口

```python
from translate.services.continuation import annotate_continuation_context
from translate.services.continuation import candidate_continuation_pairs
```
