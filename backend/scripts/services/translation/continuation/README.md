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

这样做的目的很明确：

- 已经会同页拼接的新 OCR 模型，不需要再被本地规则二次猜测
- 还不会拼接的模型，继续复用现有规则
- 后续如果出现能稳定提供跨页连续组的新模型，也只需要扩展 hint 消费策略，不需要把 provider 私有结构灌进翻译主线

## 对外接口

```python
from services.translation.continuation import annotate_continuation_context
from services.translation.continuation import candidate_continuation_pairs
```
