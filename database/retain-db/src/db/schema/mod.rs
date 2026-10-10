//! 数据库结构：编号迁移的执行器，以及任务系统老表的幂等加列（ensure_*_column）。
//!
//! 迁移本身在 `migrations/` 下，一个迁移一个 `.sql` 文件，见那里的说明。现有 ensure_schema 的
//! 幂等 DDL 与 ensure_*_column 增量加列继续负责任务系统的表；平台新表从编号迁移走。

use anyhow::{Context, Result};
use rusqlite::{Connection, Transaction, TransactionBehavior};

mod migrations;

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

pub(super) fn ensure_uploads_column(
    conn: &Connection,
    column: &str,
    column_def: &str,
) -> Result<()> {
    ensure_table_column(conn, "uploads", column, column_def)
}

pub(super) fn ensure_jobs_column(conn: &Connection, column: &str, column_def: &str) -> Result<()> {
    ensure_table_column(conn, "jobs", column, column_def)
}

pub(super) fn ensure_events_column(
    conn: &Connection,
    column: &str,
    column_def: &str,
) -> Result<()> {
    ensure_table_column(conn, "events", column, column_def)
}

pub(super) fn ensure_glossaries_column(
    conn: &Connection,
    column: &str,
    column_def: &str,
) -> Result<()> {
    ensure_table_column(conn, "glossaries", column, column_def)
}

fn ensure_table_column(
    conn: &Connection,
    table: &str,
    column: &str,
    column_def: &str,
) -> Result<()> {
    let mut stmt = conn.prepare(&format!("PRAGMA table_info({table})"))?;
    let rows = stmt.query_map([], |row| row.get::<_, String>(1))?;
    let mut has_column = false;
    for row in rows {
        if row? == column {
            has_column = true;
            break;
        }
    }
    if !has_column {
        conn.execute(
            &format!("ALTER TABLE {table} ADD COLUMN {column} {column_def}"),
            [],
        )?;
    }
    Ok(())
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
