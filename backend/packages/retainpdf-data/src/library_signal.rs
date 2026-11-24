//! 「书库内容变了」的进程内提醒：改译文、切换译文版本之后叫醒书库的后台对账（书库包 `library_refresh`），
//! 不用等满一个周期。只是提前叫醒，漏叫了也会在下一个周期对上（对账按数据库里的戳记比，见
//! `Db::document_change_stamps`），所以跨进程（jobsd）不用通知。
//!
//! 放在这一层：任务包（改译文）和书库包（切换版本、对账）都依赖它，任务包不能依赖书库包。

use std::sync::OnceLock;

use tokio::sync::Notify;

fn signal() -> &'static Notify {
    static SIGNAL: OnceLock<Notify> = OnceLock::new();
    SIGNAL.get_or_init(Notify::new)
}

/// 书库内容变了：叫醒后台对账（没在等也会记一次，下次等的时候立刻返回）。
pub fn notify_library_changed() {
    signal().notify_one();
}

/// 等到有人调 [`notify_library_changed`]。
pub async fn library_changed() {
    signal().notified().await;
}
