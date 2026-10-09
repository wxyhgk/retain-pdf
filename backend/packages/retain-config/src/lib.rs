//! 用户配置:`~/.retainpdf/`(或 `RETAINPDF_HOME` 指的目录),命令行与桌面版共用。
//!
//! ```text
//! ~/.retainpdf/
//!   config.toml        设置:翻译用哪个服务商、各服务商的模型 / 地址 / 并发、OCR、AI 助手、后端
//!   credentials.toml   接口密钥与 OCR token(权限 0600,明文——这是既定设计)
//!   run/backend.json   正在运行的后端在哪(地址、本机访问密钥、数据目录),后端启动时写
//! ```
//!
//! 两个文件都可以手改;程序改值时用 toml_edit,文件里的注释和顺序保留。
//!
//! 哪些项可以配、怎么校验、存在哪个文件,都在 [`keys`] 的配置项表里,`config get/set`、
//! 带注释的默认文件、`config show` 都由它驱动。生效的值由 [`settings`] 合并:
//! 环境变量 > 文件 > 内置默认(命令行参数由调用方再盖一层)。

pub mod home;
pub mod keys;
pub mod providers;
pub mod settings;

pub use home::{BackendRuntime, ConfigHome};
pub use keys::{describe_key, known_keys, KeyInfo, KeyKind, Store};
pub use settings::{Settings, Source};
