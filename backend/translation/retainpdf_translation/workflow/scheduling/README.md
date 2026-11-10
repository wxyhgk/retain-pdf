# 翻译调度

这个目录负责 translation units 选定之后的执行机制：

- 队列分配
- worker pool 生命周期
- 结果队列 drain
- tail retry pass
- flush 节奏
- 调度指标

它不应该决定某个 block 是否翻译，不应该构造 prompt，也不应该实现 provider HTTP 调用。

## 文件

- `allocation.py`：按批次快慢分 worker、自适应并发的起点和下限、前缀缓存预热开关。
- `pool_specs.py`：把各队列的批次拼成 worker pool 规格。
- `tail_retry.py`：尾部重试（含提前 drain）。
- `page_order.py`、`optimization.py`：按页序排批次、按页切批。
- `failures.py`：批次抛未处理异常时生成失败结果。
- `metrics.py`、`stats.py`：调度指标和一次批量翻译的统计。

真正起 worker、drain 结果队列的循环在上一层的 `workflow/batch_runner.py`（顺序和并行两种），它调这里的函数；
哪些 unit 要送去翻译由 `workflow/batching/pending_units.py` 决定。
