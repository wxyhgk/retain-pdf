# 翻译调度

这个目录负责 translation units 选定之后的执行机制：

- 队列分配
- worker pool 生命周期
- 结果队列 drain
- tail retry pass
- flush 节奏
- 调度指标

它不应该决定某个 block 是否翻译，不应该构造 prompt，也不应该实现 provider HTTP 调用。

后续需要迁移的当前源文件：

- `workflow/batch_runner.py`
- `workflow/workers.py`
- `workflow/batching/pending_units.py` 里和调度相关的部分
