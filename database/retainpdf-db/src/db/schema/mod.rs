//! 数据库结构：编号迁移的执行器，以及任务系统老表后来加的列（`LEGACY_COLUMNS`）。
//!
//! 开库时按顺序：`base.sql`（最早几张表的幂等建表）→ `ensure_legacy_columns`（很老的库补 `jobs.document_id`）→
//! 编号迁移（`migrations/`，一个迁移一个 `.sql` 文件）→ 补 `idx_uploads_content_hash`（见 `db.rs` 的 `apply_schema`）。
//! 新表、新列都从编号迁移走。**现在每张表的完整样子看 `database/retainpdf-db/schema.sql`**（`describe.rs` 生成的快照，
//! 测试守着；老库升上来和新建的库一样也有测试）。

use anyhow::{Context, Result};
use rusqlite::{Connection, Transaction, TransactionBehavior};

#[cfg(test)]
mod describe;
mod migrations;

#[cfg(test)]
pub(crate) use describe::describe_schema;

use migrations::MIGRATIONS;

/// 迁移阶梯当前版本数——测试用它做幂等断言，加迁移时无需再手改测试；备份据此判断
/// 结构要不要升级、一份备份是不是来自更新的版本。
pub(crate) fn versioned_migration_count() -> i64 {
    MIGRATIONS.len() as i64
}

pub(super) fn run_versioned_migrations(conn: &Connection) -> Result<()> {
    let initial_version: i64 = conn.query_row("PRAGMA user_version", [], |row| row.get(0))?;
    for migration in MIGRATIONS {
        let version = migration.version;
        if version <= initial_version {
            continue;
        }
        // API and jobsd can start together. Re-read the version while holding
        // the write reservation, so only one process executes additive ALTERs.
        let tx = Transaction::new_unchecked(conn, TransactionBehavior::Immediate)?;
        let current: i64 = tx.query_row("PRAGMA user_version", [], |row| row.get(0))?;
        if version <= current {
            continue;
        }
        tx.execute_batch(migration.sql)
            .with_context(|| format!("schema migration v{version} ({}) failed", migration.name))?;
        tx.pragma_update(None, "user_version", version)?;
        tx.commit()?;
    }
    Ok(())
}

/// 编号迁移以前就有的老表后来加的列：(表, 列, 定义)。只许往后加。
///
/// 不能收进编号迁移：早的几个迁移（v01 起）就要用到其中的列（`jobs.document_id` 等），而编号迁移是从库现在的版本往后跑的，
/// 一个更早的库得先有这些列、才跑得了 v01。所以它们在迁移阶梯之前补，每次起来都看一眼（几条 `PRAGMA table_info`）。
const LEGACY_COLUMNS: &[(&str, &str, &str)] = &[
    ("jobs", "document_id", "TEXT"),
    // 运行代次：每次建/重新发射一次运行加一，CAS 写按它认"是不是同一次运行"。
    ("jobs", "run_generation", "INTEGER NOT NULL DEFAULT 0"),
    // worker 进程身份（`<pid>@<启动时间指纹>`）：杀进程前核对 pid 没被别的进程复用。
    // 只由 `record_worker_identity` 写；任务行的 upsert 不碰它。
    ("jobs", "worker_identity", "TEXT"),
    ("jobs", "runtime_json", "TEXT"),
    ("jobs", "failure_json", "TEXT"),
    ("events", "stage_detail", "TEXT"),
    ("events", "provider", "TEXT"),
    ("events", "provider_stage", "TEXT"),
    ("events", "event_type", "TEXT"),
    ("events", "progress_current", "INTEGER"),
    ("events", "progress_total", "INTEGER"),
    ("events", "retry_count", "INTEGER"),
    ("events", "elapsed_ms", "INTEGER"),
    ("glossaries", "description", "TEXT NOT NULL DEFAULT ''"),
    ("glossaries", "source_lang", "TEXT NOT NULL DEFAULT ''"),
    ("glossaries", "target_lang", "TEXT NOT NULL DEFAULT ''"),
    ("glossaries", "enabled", "INTEGER NOT NULL DEFAULT 1"),
    ("uploads", "content_hash", "TEXT NOT NULL DEFAULT ''"),
];

/// 补上 `LEGACY_COLUMNS` 里缺的列。
///
/// 先不加锁看一遍，都在就直接回去（平常每次起来都是这样）。缺了才拿写锁、在锁里再看一遍再加：rust_api 和 jobsd
/// 会同时起来，以前两边都看到缺列、都去 `ALTER`，后到的那个报 "duplicate column" 起不来。和编号迁移一样用
/// IMMEDIATE 事务，加列要么全加上要么一个不加。
pub(super) fn ensure_legacy_columns(conn: &Connection) -> Result<()> {
    if missing_legacy_columns(conn)?.is_empty() {
        return Ok(());
    }
    let tx = Transaction::new_unchecked(conn, TransactionBehavior::Immediate)?;
    for (table, column, column_def) in missing_legacy_columns(&tx)? {
        tx.execute(&format!("ALTER TABLE {table} ADD COLUMN {column} {column_def}"), [])
            .with_context(|| format!("failed to add column {table}.{column}"))?;
    }
    tx.commit()?;
    Ok(())
}

fn missing_legacy_columns(conn: &Connection) -> Result<Vec<(&'static str, &'static str, &'static str)>> {
    let mut missing = Vec::new();
    let mut table_columns: Vec<(&str, Vec<String>)> = Vec::new();
    for &(table, column, column_def) in LEGACY_COLUMNS {
        if !table_columns.iter().any(|(name, _)| *name == table) {
            table_columns.push((table, table_column_names(conn, table)?));
        }
        let (_, columns) = table_columns.iter().find(|(name, _)| *name == table).expect("just added");
        if !columns.iter().any(|existing| existing == column) {
            missing.push((table, column, column_def));
        }
    }
    Ok(missing)
}

fn table_column_names(conn: &Connection, table: &str) -> Result<Vec<String>> {
    let mut stmt = conn.prepare(&format!("PRAGMA table_info({table})"))?;
    let rows = stmt.query_map([], |row| row.get::<_, String>(1))?;
    Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
}

pub(super) fn ensure_no_legacy_artifacts_json(conn: &Connection) -> Result<()> {
    let mut stmt = conn.prepare("PRAGMA table_info(jobs)")?;
    let rows = stmt.query_map([], |row| row.get::<_, String>(1))?;
    let mut has_legacy_column = false;
    for row in rows {
        if row? == "artifacts_json" {
            has_legacy_column = true;
            break;
        }
    }
    if !has_legacy_column {
        return Ok(());
    }
    let legacy_count: i64 = conn.query_row(
        r#"
        SELECT COUNT(*)
        FROM jobs
        WHERE artifacts_json IS NOT NULL AND TRIM(artifacts_json) <> ''
        "#,
        [],
        |row| row.get(0),
    )?;
    if legacy_count > 0 {
        anyhow::bail!(
            "legacy jobs.artifacts_json storage is no longer supported; found {legacy_count} legacy rows, clear the DB or rerun those jobs"
        );
    }
    Ok(())
}
