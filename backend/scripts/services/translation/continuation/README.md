# Continuation 子包说明

这个子包专门放段落连续性相关逻辑，也就是判断哪些 OCR 块应该连成同一个翻译单元。

## 分工

- `rules.py`
  文本起止特征、bbox 几何关系、join/break 评分。
- `state.py`
  把规则结果写回 payload，维护 continuation group 和 candidate 标记。
- `pairs.py`
  导出候选 pair，以及审批通过后的 join 回写。
- `review.py`
  把候选 pair 送给模型审阅。

## 对外接口

```python
from services.translation.continuation import annotate_continuation_context
from services.translation.continuation import candidate_continuation_pairs
```
