"""RetainPDF worker 的底座：流水线和翻译都要用、但不属于其中任何一个的东西。

- contracts    worker stdout 标签与 summary / 事件文件名（pipeline-stdout.v1）
- events       阶段事件 writer（logs/pipeline_events.jsonl）
- upstream_wait 服务商限流等待报进阶段进度（upstream_wait）
- io           JSON 落盘（流式写、原子写）
- paths        仓库根、输出根与其下的缓存目录
- output_layout 任务目录里各子目录的名字
- local_env    本地 .env 目录里的密钥
- credentials  stage spec 里 credential_ref 的解析

只依赖标准库。这里的模块不 import retainpdf_pipeline，也不 import 翻译。
"""
