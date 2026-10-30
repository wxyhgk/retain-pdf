//! 测试用：刚写出的假脚本（假渲染器、假修订进程）先空跑一次。
//!
//! macOS 第一次执行刚写出的脚本要先过安全扫描，整个包并行跑测试时排队能超过两三秒：脚本还没装上 trap
//! 就收到 SIGTERM、假渲染器在 `wait_started` 的期限里还没起来，测试因此时红时绿（2026-10-30 查到）。
//! 先空跑一次，扫描放在计时之前做完。脚本开头要认 `skip_env`：设了就立刻退出（不记调用、不做事）。

use std::path::Path;

pub(crate) fn warm_up_fresh_script(script: &Path, skip_env: &str) {
    std::process::Command::new(script)
        .env(skip_env, "1")
        .status()
        .expect("warm up fresh test script");
}
