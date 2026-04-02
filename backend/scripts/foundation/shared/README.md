# Shared 说明

`scripts/foundation/shared` 放的是整套脚本都会依赖的基础能力。

这一层不做 OCR、翻译或渲染业务逻辑，主要负责把“共用的东西”集中起来，避免路径、环境变量和默认参数在多个脚本里重复定义。

## 主要文件

- `config.py`
  兼容入口。现在内部已经拆到 `scripts/foundation/config/`，只用于兼容旧代码。
- `input_resolver.py`
  负责把输入目录解析成明确的 `source_json/source_pdf`。
- `job_dirs.py`
  负责解析和校验标准 job 目录契约：`source/ocr/translated/rendered/artifacts/logs`。
- `local_env.py`
  负责从显式参数、环境变量或 `scripts/.env/` 中读取密钥。
- `prompt_loader.py`
  负责从 `scripts/foundation/prompts/` 加载可编辑提示词模板。
- `job_cleanup.py`
  负责输出目录清理相关逻辑。

## 在总流程中的位置

`foundation/shared` 是所有层的支撑层：

- CLI 层用它解析输入和创建任务目录
- OCR provider 实现层用它读取 token、环境配置和输出路径
- 翻译层用它加载提示词和默认配置
- 渲染层用它读取字体、压缩和版式参数

## 一个重要约定

当前 `config.py` 里有一部分是“进程级可变调参”，例如：

- `BODY_FONT_SIZE_FACTOR`
- `BODY_LEADING_FACTOR`
- `INNER_BBOX_SHRINK_X/Y`

这些参数可以通过 `apply_layout_tuning(...)` 在运行时改写。

这对 CLI 很方便，但也意味着：

- 同一个进程里连续跑多个任务时，要注意参数是否互相影响
- 如果后续继续去耦合，这一层是值得继续下刀的重点

## 使用建议

- 新代码优先直接看 `scripts/foundation/config/` 下按职责拆分后的配置。
- 上层脚本不要自己拼 `output/<job-id>/...` 路径，优先走 `job_dirs.py`
- Python worker 只消费 Rust 传入的显式目录参数，不再自己决定输出根目录
- 密钥读取不要散落在业务代码里，优先走 `local_env.py`
- 提示词不要硬编码在业务模块里，优先走 `prompt_loader.py`
