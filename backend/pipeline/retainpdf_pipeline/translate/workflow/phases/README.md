# 翻译阶段

这个目录用于承接全书级翻译阶段实现。

计划拆分：

- `continuation.py`
  初始连续段整理，以及 provider 辅助的跨栏/跨页连续段复核。
- `policy.py`
  页面策略和块分类阶段。
- `batch_translation.py`
  批量翻译阶段适配层。它应该调用 scheduling 代码，而不是自己管理队列细节。
- `repair.py`
  乱码重建、agent 修复和最终未翻译收口。
- `events.py`
  如果事件格式继续增长，稳定的阶段事件 helper 放这里。

不要把 provider HTTP client、render prewarm 或页面文件发现逻辑放到这里。
