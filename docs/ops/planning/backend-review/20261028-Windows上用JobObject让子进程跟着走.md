# Windows 上用 Job Object 让子进程跟着走（2026-10-28）

服务端工程审查 L8 的后一半（前一半见 [派生产物的生成进程用进程包来杀](./20261024-派生产物的生成进程用进程包来杀.md)）：
`retainpdf-proc` 的 `configure_child_process` 在 Windows 上是空函数，杀进程树只靠 `taskkill /T`。API 正常退出时会去杀，
但被强杀（任务管理器结束进程、桌面壳崩溃、断电以外的各种意外）时没人调它，管线、渲染、AI 服务这些孙进程会留下来，继续占 CPU、
往任务目录里写。用户 2026-10-28 让做。

## 做法

- `retainpdf-proc` 新函数 `kill_descendants_on_exit()`：
  - Windows：`CreateJobObjectW` 建一个 job，设 `JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE`，`AssignProcessToJobObject` 把本进程放进去。
    之后起的子进程默认都在这个 job 里（孙进程也是）；句柄故意不关，进程不管怎么没的，系统都会关掉句柄，job 里剩下的进程随之被杀。
    只建一次（`OnceLock`），再调返回第一次的结果。本进程已经在别的 job 里也行（Windows 8 起 job 可以嵌套）。
  - Unix：什么都不做。子进程自成进程组由组杀收掉，被监督的子进程自己看着监督者（`wait_for_supervisor_exit`）。
- `rust_api` 的 `main`（初始化日志之后）和 `retain-jobsd` 的 `run` 开头各调一次；失败只记 `warn`，照常启动。
- 依赖：`windows-sys 0.60`（锁文件里本来就有这个版本，只多开了 `JobObjects`、`Threading`、`Security`、`Foundation` 四个特性），
  只在 Windows 上编进来。

## 为什么"全部跟着走"是对的

查过后端所有起进程的地方：管线 worker、渲染准备、对照 PDF、Word、页预览、PDF 修复、AI 服务、jobsd、模型执行器、字体和主机名这些
命令行小工具。没有替用户打开的应用（用默认程序打开文件、打开文件夹是桌面壳 Electron 做的，不在这个 job 里），所以本进程没了，
它起的全部进程都该停。jobsd 由 rust_api 拉起时本来就看着 rust_api、rust_api 没了就退出，和这个一致。

## 没做

- 正常退出时的收尾不变：rust_api 退出前照旧终止身份对得上的 worker（`stop_owned_workers_after_shutdown`），下次启动照旧续跑。
  job 只是兜底意外退出。
- 用 job 代替 `taskkill /T` 杀单个任务的进程树：取消一个任务只该杀那一棵树，job 是整个进程一个，粒度不对，照旧 `taskkill`。
- 桌面壳（Electron）自己不建 job：它起 rust_api，rust_api 自己负责下面的。

## 验证

- macOS 上 `retainpdf-proc` 测试 14 个全过（Unix 上新函数什么都不做）。
- `cargo check -p retainpdf-proc --tests --target x86_64-pc-windows-msvc`：0 个错误；7 个警告都是原有的（`main` 上同样检查是 8 个），
  不是这次加的代码。`retain-jobsd`、`rust_api` 整体在 macOS 上做不了 Windows 检查（SQLite、ring 的 C 依赖要 Windows 工具链）；
  推到 `main` 后 CI 的 Desktop Rust Cache Warmup 会在 Windows 上编整个工作区。
- 新测试 `windows_job_tests::children_started_afterwards_are_in_the_job_and_calling_twice_is_fine`（只在 Windows 上编译运行）：
  调两次都成功，之后起的子进程在 job 里。CI 不在 Windows 上跑测试，这个测试要在 Windows 机器上手动跑；"被强杀时孙进程跟着没"
  本身没有自动测试（要杀掉测试进程自己）。
