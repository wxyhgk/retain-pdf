# 翻译阶段

全书级翻译的各个阶段，由 `workflow/stages.py` 汇总给 `book_flow`、`streaming_flow` 用：

- `continuation.py`
  初始连续段整理，以及 provider 辅助的跨栏/跨页连续段复核。
- `continuation_memo.py`
  连续段复核结论落盘，重试时接着用。
- `policy.py`
  页面策略和块分类阶段。
- `batch_translation.py`
  批量翻译阶段适配层。调 `scheduling/`、`batch_runner.py`，自己不管队列细节。
- `repair.py`
  乱码重建、agent 修复和最终未翻译收口。
- `events.py`
  阶段事件和进度文案。

不要把 provider HTTP client、渲染预热或页面文件发现逻辑放到这里。
