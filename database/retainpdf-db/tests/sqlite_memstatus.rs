//! SQLite 的内存统计在本进程里是关的（`configure_sqlite_process`）。单独一个测试程序：SQLite 的初始化是进程级的，
//! 和别的测试放在一起，谁先开连接说不准。

use retainpdf_db::db::Db;

#[test]
fn sqlite_memory_statistics_are_off_after_the_first_connection() {
    let root = std::env::temp_dir().join(format!("retainpdf-db-memstatus-{}", std::process::id()));
    let db = Db::new(root.join("jobs.db"), root.join("data"));
    db.init().expect("init db");
    let (mut current, mut highwater) = (0i64, 0i64);
    // SAFETY: 只读全局统计，两个出参都是有效的栈变量。
    let rc = unsafe {
        rusqlite::ffi::sqlite3_status64(rusqlite::ffi::SQLITE_STATUS_MEMORY_USED, &mut current, &mut highwater, 0)
    };
    assert_eq!(rc, rusqlite::ffi::SQLITE_OK);
    // 看历史最高：init 收尾时连接都关了，"当前用量"开着统计也可能回到 0
    assert_eq!((current, highwater), (0, 0), "SQLite still tracks memory: every allocation takes the global mutex");
    let _ = std::fs::remove_dir_all(root);
}
