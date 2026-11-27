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
    let mut migrated = false;
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
        if !already_applied(&tx, version)? {
            tx.execute_batch(migration.sql)
                .with_context(|| format!("schema migration v{version} ({}) failed", migration.name))?;
        }
        tx.pragma_update(None, "user_version", version)?;
        tx.commit()?;
        migrated = true;
    }
    // 迁移删表、重建表腾出来的页，提交以后才收得回来：库是增量收缩模式时当场还给磁盘（v35 进度流瘦身腾出约 200MB）。
    // 不是这个模式时什么都不做。
    if migrated {
        super::maintenance::incremental_vacuum(conn)?;
    }
    Ok(())
}

/// 测试用：把一个新库建到第 `version` 个迁移为止（老库的样子），好往里写老结构的数据，再用 `Db::init` 升上来。
/// 比「把版本号拨回去重跑」干净：不用手动撤掉后面迁移做的改动。`conn` 要是直接开的连接（`Db` 的连接一开就升到最新）。
#[cfg(test)]
pub(crate) fn create_at_version(conn: &Connection, version: i64) -> Result<()> {
    conn.execute_batch(include_str!("base.sql"))?;
    ensure_legacy_columns(conn)?;
    for migration in MIGRATIONS.iter().filter(|migration| migration.version <= version) {
        let tx = Transaction::new_unchecked(conn, TransactionBehavior::Immediate)?;
        tx.execute_batch(migration.sql)
            .with_context(|| format!("schema migration v{} ({}) failed", migration.version, migration.name))?;
        tx.pragma_update(None, "user_version", migration.version)?;
        tx.commit()?;
    }
    Ok(())
}

/// 不能重跑的迁移（改列的取值、删列、加带外键的列）：库里已经是迁移后的样子，就只记版本、不再执行。
/// 正常升级碰不到（版本号只往上走）；是给把 `user_version` 倒回去重跑后面迁移的测试用的——它们的惯例是先手动撤掉
/// 后面迁移加的东西（见 `event_feed_tests`），可 SQLite 删不掉带外键的列，v32 的 `parent_job_id` 撤不掉。
/// 每项是（版本，查询；返回非 0 表示已经是迁移后的样子）。
const APPLIED_CHECKS: &[(i64, &str)] = &[
    (32, "SELECT COUNT(*) FROM pragma_table_info('jobs') WHERE name = 'status'"),
    (33, "SELECT COUNT(*) FROM pragma_table_info('jobs') WHERE name = 'stage_entered_at'"),
    (36, "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'library_items'"),
    // v43 加列（ADD COLUMN 不能重跑）：消息上已经有 edited_from 就当跑过了
    (43, "SELECT COUNT(*) FROM pragma_table_info('ask_conversation_messages') WHERE name = 'edited_from'"),
    (44, "SELECT COUNT(*) FROM pragma_table_info('ask_conversation_messages') WHERE name = 'session_id'"),
    (45, "SELECT COUNT(*) FROM sqlite_master WHERE type = 'trigger' AND name = 'ask_main_archive_before_document_delete'"),
];

/// 从这个版本起不再补 `LEGACY_COLUMNS`（v33 删了其中的 `jobs.runtime_json`）。
const LEGACY_COLUMNS_SETTLED_AT: i64 = 33;

fn already_applied(conn: &Connection, version: i64) -> Result<bool> {
    let Some((_, check)) = APPLIED_CHECKS.iter().find(|(v, _)| *v == version) else {
        return Ok(false);
    };
    Ok(conn.query_row(check, [], |row| row.get::<_, i64>(0))? > 0)
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
    // v33 起删掉了其中的 `jobs.runtime_json`：升到这个版本以后老列都早已补齐，不再看（否则会把删掉的列加回来）。
    let version: i64 = conn.query_row("PRAGMA user_version", [], |row| row.get(0))?;
    if version >= LEGACY_COLUMNS_SETTLED_AT {
        return Ok(());
    }
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
