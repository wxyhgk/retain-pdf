# MinerU 集成说明

这一层只负责 MinerU 接入，不负责翻译策略，也不负责 PDF 渲染。

## 作用边界

- 向 MinerU 提交任务
- 查询任务状态
- 下载并解包 MinerU 结果
- 组织 `output/<job-id>/originPDF`、`jsonPDF`、`transPDF`
- 提供翻译阶段所需的 `layout.json`

这里不做的事情：

- 不做 OCR 后处理
- 不做翻译
- 不做 PDF 渲染
- 不决定 `fast/sci/precise` 的翻译策略

## 推荐入口

- `scripts/run_mineru_case.py`
  推荐的一条命令入口，适合日常使用。输入 PDF 后，会按“解析 -> 解包 -> 翻译 -> 渲染”的顺序串起来。
- `mineru_pipeline.py`
  `run_mineru_case.py` 背后的稳定实现。
- `mineru_job.py`
  只做解析和解包，适合先拿 MinerU 结果再手动接翻译。
- `mineru_api.py`
  最底层 API 调用封装，只在需要直接调 MinerU 接口时使用。
- `mineru_api_example.py`
  最小示例，适合调通接口和查看返回结构。
- `migrate_legacy_output.py`
  把旧输出目录迁移到新的 job 目录结构。

## 目录结构

- `output/<job-id>/originPDF`
- `output/<job-id>/jsonPDF`
- `output/<job-id>/transPDF`

## 默认约定

- 翻译阶段默认使用 `jsonPDF/unpacked/layout.json`
- `content_list_v2.json` 目前仅用于实验和适配，不是主路径

## 与主流程的关系

典型链路是：

1. `mineru_job.py` 或 `mineru_pipeline.py` 向 MinerU 提交 PDF
2. 轮询直到任务完成
3. 下载并解包结果
4. 把原始 PDF 复制到 `originPDF`
5. 把解析结果放到 `jsonPDF/unpacked`
6. 后续由 `pipeline` 调 `translation` 和 `rendering` 完成剩余流程

也就是说，这一层的职责是“把 PDF 变成主链路可消费的 OCR 输入”，而不是承担后续业务。
