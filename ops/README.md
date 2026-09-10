# 运维与交付

- `development/`：本地环境准备与进程启动。`python3 ops/development/dev_stack.py --help` 查看入口；运行数据路径和环境变量保持兼容。
- `release/`：源码归档与离仓验证。归档只包含提交的 HEAD，不包含凭据或本地运行数据。
- `deployment/`：Docker、Nginx 和 Typst 部署资产。本轮仅迁移路径，不改变镜像内安装布局。

在仓库根运行 `python3 ops/release/build_source_archive.py` 生成带校验和的源码包，默认输出在 `backend/dist/`。包内保留根 Cargo 工作区、`backend/`、`database/`、共享协议、字体、部署与发布工具及测试样本的相对路径。

`python3 ops/release/check_standalone.py --compile-rust` 从已提交源码构造临时工作区，验证布局、字体、协议、Python 安装及 Rust 编译。此命令需要可用的依赖源，但不会调用模型服务。

工具测试：`python3 -m pytest ops/development/tests ops/release/tests`。单个服务专用开发工具继续跟随所属服务。
