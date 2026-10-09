//! 多设备同步的数据库一侧(文件与同步文件夹在 retain-data::sync)。
//!
//! # 实体
//!
//! 同步的单位是「实体」:一组按同一个键取出的行。键和表的对应见 [`entity_spec`]:
//! 一本书(documents + 标题状态)、一次上传、一个合集、一条合集成员、一条收藏、
//! 一个任务(jobs + 产物登记 + 流水线记录 + 事件)。实体的第一张表是根表,其余是挂在它下面的
//! 子表。
//!
//! # 改动从哪来
//!
//! v17 迁移给这些表装了触发器:任何进程的增删改都会把「哪个实体变了」记进
//! `sync_dirty`。应用别的设备的改动时事务里放着 `sync_apply_guard`,触发器不记。
//!
//! # 写入
//!
//! [`Db::sync_apply_entity`] 在一个事务里写完一个实体:根表按主键覆盖(不能先删,
//! 删根行会级联删掉本机挂在它下面、却不属于这个实体的行,比如一本书的收藏),子表先删后
//! 插。外键检查推迟到提交:同一实体内的先后顺序无所谓;提交时仍有缺失的父行(比如
//! 收藏指向的任务还没同步过来),整个实体回滚,由调用方放进等待区以后重试。
//! 列取两边都有的:旧版本发来的行缺新列就用默认值,新版本多出的列忽略。

use std::collections::BTreeMap;

use anyhow::{bail, Result};
use rusqlite::types::Value as SqlValue;
use rusqlite::{params, Connection, OptionalExtension, Transaction, TransactionBehavior};
use serde::{Deserialize, Serialize};
use serde_json::{Map, Number, Value};

use crate::db::Db;

/// 一个实体的全部行:表名 -> 行(列名 -> 值)。
pub type SyncRows = BTreeMap<String, Vec<Map<String, Value>>>;

/// 同步的实体种类。
pub const SYNC_KINDS: &[&str] = &[
    "upload",
    "document",
    "collection",
    "collection_member",
    "favorite",
    "job",
];

/// (表, 按哪几列取行)。第一项是根表。
pub fn entity_spec(kind: &str) -> Option<&'static [(&'static str, &'static [&'static str])]> {
    const UPLOAD: &[(&str, &[&str])] = &[("uploads", &["upload_id"])];
    const DOCUMENT: &[(&str, &[&str])] = &[
        ("documents", &["document_id"]),
        ("document_title_state", &["document_id"]),
    ];
    const COLLECTION: &[(&str, &[&str])] = &[("collections", &["collection_id"])];
    const MEMBER: &[(&str, &[&str])] =
        &[("collection_documents", &["collection_id", "document_id"])];
    const FAVORITE: &[(&str, &[&str])] = &[("favorites", &["favorite_id"])];
    const JOB: &[(&str, &[&str])] = &[
        ("jobs", &["job_id"]),
        ("artifacts", &["job_id"]),
        ("job_artifact_entries", &["job_id"]),
        ("pipeline_attempts", &["job_id"]),
        ("pipeline_stages", &["job_id"]),
        ("pipeline_units", &["job_id"]),
        ("pipeline_dispatches", &["job_id"]),
        // 任务进度、阶段快照都从事件算出来。
        ("events", &["job_id"]),
    ];
    Some(match kind {
        "upload" => UPLOAD,
        "document" => DOCUMENT,
        "collection" => COLLECTION,
        "collection_member" => MEMBER,
        "favorite" => FAVORITE,
        "job" => JOB,
        _ => return None,
    })
}

/// 复合键的各部分用 `|` 连接(与 v17 触发器一致)。
pub fn split_entity_key<'a>(kind: &str, key: &'a str) -> Result<Vec<&'a str>> {
    let spec = entity_spec(kind).ok_or_else(|| anyhow::anyhow!("unknown sync kind: {kind}"))?;
    let parts: Vec<&str> = if spec[0].1.len() == 1 {
        vec![key]
    } else {
        key.split('|').collect()
    };
    if parts.len() != spec[0].1.len() || parts.iter().any(|part| part.is_empty()) {
        bail!("invalid {kind} key: {key}");
    }
    Ok(parts)
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SyncDirty {
    pub kind: String,
    pub key: String,
    pub changed_at: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SyncFileRef {
    pub path: String,
    pub sha256: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SyncEntityState {
    pub clock: String,
    pub deleted: bool,
    pub digest: String,
    /// 上次导出或应用后的内容(JSON)。
    pub base_json: String,
    /// 每个字段的时钟(JSON 对象)。
    pub clocks_json: String,
    pub files: Vec<SyncFileRef>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SyncPending {
    pub kind: String,
    pub key: String,
    pub clock: String,
    pub record_json: String,
    pub reason: String,
    pub attempts: i64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SyncApplyOutcome {
    Applied,
    /// 提交时还有指向不存在父行的外键(父实体还没同步过来)。已回滚。
    MissingParent(String),
}

/// 本机记录的实体版本更新:导出或应用之后调用。
pub struct SyncEntityUpdate<'a> {
    pub kind: &'a str,
    pub key: &'a str,
    pub clock: &'a str,
    pub deleted: bool,
    pub digest: &'a str,
    pub base_json: &'a str,
    pub clocks_json: &'a str,
    pub files: &'a [SyncFileRef],
}

fn json_from_sql(value: SqlValue) -> Value {
    match value {
        SqlValue::Null => Value::Null,
        SqlValue::Integer(v) => Value::from(v),
        SqlValue::Real(v) => Number::from_f64(v).map(Value::Number).unwrap_or(Value::Null),
        SqlValue::Text(v) => Value::String(v),
        SqlValue::Blob(bytes) => {
            let hex: String = bytes.iter().map(|b| format!("{b:02x}")).collect();
            let mut map = Map::new();
            map.insert("$blob".into(), Value::String(hex));
            Value::Object(map)
        }
    }
}

fn sql_from_json(value: &Value) -> Result<SqlValue> {
    Ok(match value {
        Value::Null => SqlValue::Null,
        Value::Bool(v) => SqlValue::Integer(i64::from(*v)),
        Value::Number(n) => match n.as_i64() {
            Some(v) => SqlValue::Integer(v),
            None => SqlValue::Real(n.as_f64().unwrap_or(0.0)),
        },
        Value::String(v) => SqlValue::Text(v.clone()),
        Value::Object(map) => match map.get("$blob").and_then(Value::as_str) {
            Some(hex) if hex.len() % 2 == 0 => {
                let bytes = (0..hex.len())
                    .step_by(2)
                    .map(|i| u8::from_str_radix(&hex[i..i + 2], 16))
                    .collect::<std::result::Result<Vec<u8>, _>>()?;
                SqlValue::Blob(bytes)
            }
            _ => bail!("unsupported object value in sync row"),
        },
        Value::Array(_) => bail!("unsupported array value in sync row"),
    })
}

struct TableInfo {
    columns: Vec<String>,
    primary_key: Vec<String>,
}

fn table_info(conn: &Connection, table: &str) -> Result<TableInfo> {
    let mut stmt = conn.prepare(&format!("PRAGMA table_info(\"{table}\")"))?;
    let mut columns = Vec::new();
    let mut pk: Vec<(i64, String)> = Vec::new();
    let rows = stmt.query_map([], |row| {
        Ok((row.get::<_, String>(1)?, row.get::<_, i64>(5)?))
    })?;
    for row in rows {
        let (name, pk_index) = row?;
        if pk_index > 0 {
            pk.push((pk_index, name.clone()));
        }
        columns.push(name);
    }
    if columns.is_empty() {
        bail!("sync table missing: {table}");
    }
    pk.sort();
    Ok(TableInfo {
        columns,
        primary_key: pk.into_iter().map(|(_, name)| name).collect(),
    })
}

fn where_clause(columns: &[&str]) -> String {
    columns
        .iter()
        .map(|column| format!("\"{column}\" = ?"))
        .collect::<Vec<_>>()
        .join(" AND ")
}

fn read_rows(
    conn: &Connection,
    table: &str,
    key_columns: &[&str],
    key: &[&str],
) -> Result<Vec<Map<String, Value>>> {
    let info = table_info(conn, table)?;
    let order = if info.primary_key.is_empty() {
        "rowid".to_string()
    } else {
        info.primary_key
            .iter()
            .map(|c| format!("\"{c}\""))
            .collect::<Vec<_>>()
            .join(", ")
    };
    let sql = format!(
        "SELECT * FROM \"{table}\" WHERE {} ORDER BY {order}",
        where_clause(key_columns)
    );
    let mut stmt = conn.prepare(&sql)?;
    let names: Vec<String> = stmt.column_names().iter().map(|s| s.to_string()).collect();
    let mut rows = stmt.query(rusqlite::params_from_iter(key.iter()))?;
    let mut out = Vec::new();
    while let Some(row) = rows.next()? {
        let mut map = Map::new();
        for (index, name) in names.iter().enumerate() {
            map.insert(name.clone(), json_from_sql(row.get::<_, SqlValue>(index)?));
        }
        out.push(map);
    }
    Ok(out)
}

fn insert_row(
    tx: &Transaction<'_>,
    table: &str,
    info: &TableInfo,
    row: &Map<String, Value>,
    upsert: bool,
) -> Result<()> {
    let columns: Vec<&String> = info
        .columns
        .iter()
        .filter(|column| row.contains_key(column.as_str()))
        .collect();
    if columns.is_empty() {
        bail!("sync row for {table} has no known columns");
    }
    let names = columns
        .iter()
        .map(|c| format!("\"{c}\""))
        .collect::<Vec<_>>()
        .join(", ");
    let marks = vec!["?"; columns.len()].join(", ");
    let mut sql = format!("INSERT INTO \"{table}\" ({names}) VALUES ({marks})");
    if upsert && !info.primary_key.is_empty() {
        let updates: Vec<String> = columns
            .iter()
            .filter(|c| !info.primary_key.contains(c))
            .map(|c| format!("\"{c}\" = excluded.\"{c}\""))
            .collect();
        let conflict = info
            .primary_key
            .iter()
            .map(|c| format!("\"{c}\""))
            .collect::<Vec<_>>()
            .join(", ");
        if updates.is_empty() {
            sql.push_str(&format!(" ON CONFLICT({conflict}) DO NOTHING"));
        } else {
            sql.push_str(&format!(
                " ON CONFLICT({conflict}) DO UPDATE SET {}",
                updates.join(", ")
            ));
        }
    }
    let values = columns
        .iter()
        .map(|c| sql_from_json(&row[c.as_str()]))
        .collect::<Result<Vec<_>>>()?;
    tx.execute(&sql, rusqlite::params_from_iter(values.iter()))?;
    Ok(())
}

fn is_foreign_key_error(error: &rusqlite::Error) -> bool {
    matches!(
        error,
        rusqlite::Error::SqliteFailure(e, _)
            if e.extended_code == rusqlite::ffi::SQLITE_CONSTRAINT_FOREIGNKEY
    )
}

fn files_of(conn: &Connection, kind: &str, key: &str) -> Result<Vec<SyncFileRef>> {
    let mut stmt = conn.prepare(
        "SELECT path, sha256 FROM sync_entity_files WHERE kind = ?1 AND entity_key = ?2 ORDER BY path",
    )?;
    let rows = stmt.query_map(params![kind, key], |row| {
        Ok(SyncFileRef {
            path: row.get(0)?,
            sha256: row.get(1)?,
        })
    })?;
    Ok(rows.collect::<std::result::Result<Vec<_>, _>>()?)
}

fn record_entity(tx: &Transaction<'_>, update: &SyncEntityUpdate<'_>) -> Result<()> {
    tx.execute(
        "INSERT INTO sync_entities(kind, entity_key, clock, deleted, digest, base_json, clocks_json)
         VALUES(?1, ?2, ?3, ?4, ?5, ?6, ?7)
         ON CONFLICT(kind, entity_key) DO UPDATE SET
             clock = excluded.clock, deleted = excluded.deleted, digest = excluded.digest,
             base_json = excluded.base_json, clocks_json = excluded.clocks_json",
        params![
            update.kind,
            update.key,
            update.clock,
            i64::from(update.deleted),
            update.digest,
            update.base_json,
            update.clocks_json
        ],
    )?;
    tx.execute(
        "DELETE FROM sync_entity_files WHERE kind = ?1 AND entity_key = ?2",
        params![update.kind, update.key],
    )?;
    for file in update.files {
        tx.execute(
            "INSERT OR REPLACE INTO sync_entity_files(kind, entity_key, path, sha256) VALUES(?1, ?2, ?3, ?4)",
            params![update.kind, update.key, file.path, file.sha256],
        )?;
    }
    Ok(())
}

impl Db {
    pub fn sync_state_get(&self, key: &str) -> Result<Option<String>> {
        let conn = self.connect()?;
        Ok(conn
            .query_row(
                "SELECT value FROM sync_state WHERE key = ?1",
                params![key],
                |row| row.get(0),
            )
            .optional()?)
    }

    pub fn sync_state_set(&self, key: &str, value: &str) -> Result<()> {
        let conn = self.connect()?;
        conn.execute(
            "INSERT INTO sync_state(key, value) VALUES(?1, ?2)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            params![key, value],
        )?;
        Ok(())
    }

    /// 把本机现有的全部实体标成待同步(第一次开启同步、或要求全量重发时)。
    pub fn sync_seed_all(&self) -> Result<usize> {
        let conn = self.connect()?;
        let now = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";
        let mut total = 0;
        for (kind, select) in [
            ("upload", "SELECT upload_id AS k FROM uploads"),
            ("document", "SELECT document_id AS k FROM documents"),
            ("collection", "SELECT collection_id AS k FROM collections"),
            (
                "collection_member",
                "SELECT collection_id || '|' || document_id AS k FROM collection_documents",
            ),
            ("favorite", "SELECT favorite_id AS k FROM favorites"),
            ("job", "SELECT job_id AS k FROM jobs"),
        ] {
            total += conn.execute(
                &format!(
                    "INSERT OR IGNORE INTO sync_dirty(kind, entity_key, changed_at)
                     SELECT '{kind}', k, {now} FROM ({select})"
                ),
                [],
            )?;
        }
        Ok(total)
    }

    /// 待导出的实体,按改动先后。
    pub fn sync_dirty(&self, limit: usize) -> Result<Vec<SyncDirty>> {
        let conn = self.connect()?;
        let mut stmt = conn.prepare(
            "SELECT kind, entity_key, changed_at FROM sync_dirty ORDER BY changed_at, kind, entity_key LIMIT ?1",
        )?;
        let rows = stmt.query_map(params![limit as i64], |row| {
            Ok(SyncDirty {
                kind: row.get(0)?,
                key: row.get(1)?,
                changed_at: row.get(2)?,
            })
        })?;
        Ok(rows.collect::<std::result::Result<Vec<_>, _>>()?)
    }

    /// 处理完一条待导出:只在这期间没有再变过时清掉(否则留着下次再导)。
    pub fn sync_clear_dirty(&self, dirty: &SyncDirty) -> Result<()> {
        let conn = self.connect()?;
        conn.execute(
            "DELETE FROM sync_dirty WHERE kind = ?1 AND entity_key = ?2 AND changed_at = ?3",
            params![dirty.kind, dirty.key, dirty.changed_at],
        )?;
        Ok(())
    }

    /// 读出一个实体的全部行;根行不存在(已删除)时为 None。一个事务内读完,各表一致。
    pub fn sync_read_entity(&self, kind: &str, key: &str) -> Result<Option<SyncRows>> {
        let spec = entity_spec(kind).ok_or_else(|| anyhow::anyhow!("unknown sync kind: {kind}"))?;
        let parts = split_entity_key(kind, key)?;
        let mut conn = self.connect()?;
        let tx = conn.transaction()?;
        let mut out = SyncRows::new();
        for (index, (table, columns)) in spec.iter().enumerate() {
            let rows = read_rows(&tx, table, columns, &parts[..columns.len()])?;
            if index == 0 && rows.is_empty() {
                return Ok(None);
            }
            out.insert((*table).to_string(), rows);
        }
        Ok(Some(out))
    }

    pub fn sync_entity_state(&self, kind: &str, key: &str) -> Result<Option<SyncEntityState>> {
        let conn = self.connect()?;
        let state = conn
            .query_row(
                "SELECT clock, deleted, digest, base_json, clocks_json FROM sync_entities WHERE kind = ?1 AND entity_key = ?2",
                params![kind, key],
                |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, i64>(1)? != 0,
                        row.get::<_, String>(2)?,
                        row.get::<_, String>(3)?,
                        row.get::<_, String>(4)?,
                    ))
                },
            )
            .optional()?;
        let Some((clock, deleted, digest, base_json, clocks_json)) = state else {
            return Ok(None);
        };
        Ok(Some(SyncEntityState {
            clock,
            deleted,
            digest,
            base_json,
            clocks_json,
            files: files_of(&conn, kind, key)?,
        }))
    }

    /// 本机还没导出的改动发生的时刻(没有则为 None)。
    pub fn sync_dirty_since(&self, kind: &str, key: &str) -> Result<Option<String>> {
        let conn = self.connect()?;
        Ok(conn
            .query_row(
                "SELECT changed_at FROM sync_dirty WHERE kind = ?1 AND entity_key = ?2",
                params![kind, key],
                |row| row.get(0),
            )
            .optional()?)
    }

    /// 记下本机导出的版本(不动业务表)。
    pub fn sync_record_entity(&self, update: &SyncEntityUpdate<'_>) -> Result<()> {
        let mut conn = self.connect()?;
        let tx = conn.transaction()?;
        record_entity(&tx, update)?;
        tx.commit()?;
        Ok(())
    }

    /// 写入别的设备发来的一个实体(rows 为 None 表示删除),并记下版本。见模块说明。
    pub fn sync_apply_entity(
        &self,
        update: &SyncEntityUpdate<'_>,
        rows: Option<&SyncRows>,
    ) -> Result<SyncApplyOutcome> {
        let spec = entity_spec(update.kind)
            .ok_or_else(|| anyhow::anyhow!("unknown sync kind: {}", update.kind))?;
        let parts = split_entity_key(update.kind, update.key)?;
        let mut conn = self.connect()?;
        let tx = Transaction::new(&mut conn, TransactionBehavior::Immediate)?;
        tx.execute_batch("PRAGMA defer_foreign_keys = ON;")?;
        tx.execute("INSERT OR IGNORE INTO sync_apply_guard(singleton) VALUES(1)", [])?;
        let (root, root_columns) = spec[0];
        match rows {
            None => {
                if update.kind == "job" {
                    // favorites → jobs 是 RESTRICT:先删本机挂在这个任务上的收藏
                    // (发出删除的那台设备上它们也已经随任务删掉)。
                    tx.execute("DELETE FROM favorites WHERE job_id = ?1", params![parts[0]])?;
                }
                for (table, columns) in spec.iter().skip(1).rev() {
                    tx.execute(
                        &format!("DELETE FROM \"{table}\" WHERE {}", where_clause(columns)),
                        rusqlite::params_from_iter(parts[..columns.len()].iter()),
                    )?;
                }
                tx.execute(
                    &format!("DELETE FROM \"{root}\" WHERE {}", where_clause(root_columns)),
                    rusqlite::params_from_iter(parts.iter()),
                )?;
            }
            Some(rows) => {
                let root_rows = rows.get(root).map(Vec::as_slice).unwrap_or(&[]);
                if root_rows.len() != 1 {
                    bail!("{} {}: expected one {root} row", update.kind, update.key);
                }
                let info = table_info(&tx, root)?;
                insert_row(&tx, root, &info, &root_rows[0], true)?;
                for (table, columns) in spec.iter().skip(1) {
                    tx.execute(
                        &format!("DELETE FROM \"{table}\" WHERE {}", where_clause(columns)),
                        rusqlite::params_from_iter(parts[..columns.len()].iter()),
                    )?;
                }
                for (table, _) in spec.iter().skip(1) {
                    let info = table_info(&tx, table)?;
                    for row in rows.get(*table).map(Vec::as_slice).unwrap_or(&[]) {
                        insert_row(&tx, table, &info, row, false)?;
                    }
                }
            }
        }
        tx.execute("DELETE FROM sync_apply_guard", [])?;
        record_entity(&tx, update)?;
        match tx.commit() {
            Ok(()) => Ok(SyncApplyOutcome::Applied),
            Err(error) if is_foreign_key_error(&error) => {
                // 提交失败时事务仍开着;这条连接随即丢弃,SQLite 回滚。
                Ok(SyncApplyOutcome::MissingParent(error.to_string()))
            }
            Err(error) => Err(error.into()),
        }
    }

    /// 除了给定实体,还有没有别的实体管理着这个文件(删除或替换文件前判断)。
    pub fn sync_file_shared(&self, path: &str, kind: &str, key: &str) -> Result<bool> {
        let conn = self.connect()?;
        let count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM sync_entity_files WHERE path = ?1 AND NOT (kind = ?2 AND entity_key = ?3)",
            params![path, kind, key],
            |row| row.get(0),
        )?;
        Ok(count > 0)
    }

    pub fn sync_cursor(&self, device_id: &str) -> Result<u64> {
        let conn = self.connect()?;
        let segment: Option<i64> = conn
            .query_row(
                "SELECT segment FROM sync_cursors WHERE device_id = ?1",
                params![device_id],
                |row| row.get(0),
            )
            .optional()?;
        Ok(segment.unwrap_or(0).max(0) as u64)
    }

    pub fn sync_set_cursor(&self, device_id: &str, segment: u64) -> Result<()> {
        let conn = self.connect()?;
        conn.execute(
            "INSERT INTO sync_cursors(device_id, segment) VALUES(?1, ?2)
             ON CONFLICT(device_id) DO UPDATE SET segment = excluded.segment",
            params![device_id, segment as i64],
        )?;
        Ok(())
    }

    /// 放进等待区;同一实体只留时钟更新的那条。
    pub fn sync_park(&self, kind: &str, key: &str, clock: &str, record_json: &str, reason: &str) -> Result<()> {
        let conn = self.connect()?;
        conn.execute(
            "INSERT INTO sync_pending(kind, entity_key, clock, record_json, reason, attempts)
             VALUES(?1, ?2, ?3, ?4, ?5, 1)
             ON CONFLICT(kind, entity_key) DO UPDATE SET
                 clock = excluded.clock, record_json = excluded.record_json,
                 reason = excluded.reason, attempts = sync_pending.attempts + 1
             WHERE excluded.clock >= sync_pending.clock",
            params![kind, key, clock, record_json, reason],
        )?;
        Ok(())
    }

    pub fn sync_pending(&self) -> Result<Vec<SyncPending>> {
        let conn = self.connect()?;
        let mut stmt = conn.prepare(
            "SELECT kind, entity_key, clock, record_json, reason, attempts FROM sync_pending ORDER BY clock",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(SyncPending {
                kind: row.get(0)?,
                key: row.get(1)?,
                clock: row.get(2)?,
                record_json: row.get(3)?,
                reason: row.get(4)?,
                attempts: row.get(5)?,
            })
        })?;
        Ok(rows.collect::<std::result::Result<Vec<_>, _>>()?)
    }

    pub fn sync_unpark(&self, kind: &str, key: &str, clock: &str) -> Result<()> {
        let conn = self.connect()?;
        conn.execute(
            "DELETE FROM sync_pending WHERE kind = ?1 AND entity_key = ?2 AND clock <= ?3",
            params![kind, key, clock],
        )?;
        Ok(())
    }

    /// 文件哈希缓存:大小与修改时间都没变就沿用上次算的哈希。
    pub fn sync_cached_hash(&self, path: &str, size: u64, mtime_ns: i64) -> Result<Option<String>> {
        let conn = self.connect()?;
        Ok(conn
            .query_row(
                "SELECT sha256 FROM sync_file_cache WHERE path = ?1 AND size = ?2 AND mtime_ns = ?3",
                params![path, size as i64, mtime_ns],
                |row| row.get(0),
            )
            .optional()?)
    }

    pub fn sync_cache_hash(&self, path: &str, size: u64, mtime_ns: i64, sha256: &str) -> Result<()> {
        let conn = self.connect()?;
        conn.execute(
            "INSERT INTO sync_file_cache(path, size, mtime_ns, sha256) VALUES(?1, ?2, ?3, ?4)
             ON CONFLICT(path) DO UPDATE SET size = excluded.size, mtime_ns = excluded.mtime_ns, sha256 = excluded.sha256",
            params![path, size as i64, mtime_ns, sha256],
        )?;
        Ok(())
    }
}
