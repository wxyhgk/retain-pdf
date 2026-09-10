# RetainPDF 文档目录

用户安装、下载和 Docker 部署入口见仓库根目录 [README](../README.md)。
本目录是仓库唯一的文档根目录；不要再新建平行的 `doc/` 或模块外文档目录。

## 入口

- [仓库目录职责](./core/repository-layout.md)：六大职责、共享协议和依赖规则
- [主线开发文档](./core/README.md)：当前架构、联调、开发与运行约定
- [API Wiki](./api/README.md)：按接口能力组织的 API 导航
- [架构决策记录](./adr/README.md)：长期有效的关键技术决策
- [参考资料](./reference/README.md)：外部服务、设计交付与专题资料
- [运维与过程记录](./ops/README.md)：计划、报告、问题复盘与迁移记录

## 读法

新增文档应先选择上述类别，并从对应 README 建立入口。模块内部可以保留贴近
代码的实现说明，但跨模块或面向协作的文档统一从这里导航。
