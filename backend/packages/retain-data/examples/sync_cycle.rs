//! 调试用:对一个数据目录跑一轮同步,打印结果。
//!
//!     cargo run -p retain-data --example sync_cycle -- <数据目录> <同步文件夹> [设备名]

use std::path::PathBuf;

use retain_data::db::Db;
use retain_data::sync::SyncEngine;

fn main() -> anyhow::Result<()> {
    let mut args = std::env::args().skip(1);
    let usage = "usage: sync_cycle <data-root> <sync-folder> [device-name]";
    let data_root = PathBuf::from(args.next().ok_or_else(|| anyhow::anyhow!(usage))?);
    let folder = PathBuf::from(args.next().ok_or_else(|| anyhow::anyhow!(usage))?);
    let name = args.next().unwrap_or_else(|| "debug".into());
    let db = Db::new(data_root.join("db").join("jobs.db"), data_root.clone());
    db.init()?;
    let engine = SyncEngine::new(db, &data_root, &folder, &name)?;
    let started = std::time::Instant::now();
    let report = engine.run_cycle()?;
    println!("{}", serde_json::json!({ "report": report, "seconds": started.elapsed().as_secs_f64() }));
    Ok(())
}
