//! 多设备同步的数据库一侧(文件与同步文件夹在 retain-data::sync)。
//!
//! # 实体
//!
//! 同步的单位是「实体」:一组按同一个键取出的行。键和表的对应见 [`entity_spec`]:
//! 一本书(documents + 标题状态与标题建议)、一次上传、一个合集、一条合集成员、一条收藏、
//! 一个任务(jobs + 产物登记 + 流水线记录 + 事件)、一张术语表、一张收藏截图、一段 AI 对话
//! (含消息)、一次 AI 计算(含产出的图)、一次 AI 改文档的操作(含尝试、事件、产出的版本)。
//! 实体的第一张表是根表,其余是挂在它下面的子表。
//!
//! 只在本机有意义的列不同步(见 [`local_only_columns`]):发出去前去掉,写入时这些列保留
//! 本机的值(新行用默认值)。
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

use std::collections::{BTreeMap, BTreeSet};

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
    "glossary",
    "asset",
    "conversation",
    "calculation",
    "operation",
];

/// 每种实体的登记版本。新增种类、或给已有种类加了表时调高:已经开过同步的设备下一轮把
/// 这一种的现有内容全部重新登记一遍(没变的内容不会重发)。
pub const SYNC_SEED_VERSIONS: &[(&str, u32)] = &[
    ("upload", 1),
    ("document", 2),
    ("collection", 1),
    ("collection_member", 1),
    ("favorite", 1),
    ("job", 1),
    ("glossary", 1),
    ("asset", 1),
    ("conversation", 1),
    ("calculation", 1),
    ("operation", 1),
];

/// 只在本机有意义、不同步的列:AI 对话接着哪个本机会话进程往下聊(别的设备上没有这个
/// 会话,从对话记录重建)。
pub fn local_only_columns(table: &str) -> &'static [&'static str] {
    match table {
        "ai_conversations" => &[
            "agent_runtime_id",
            "agent_session_cursor",
            "agent_session_revision",
            "agent_session_updated_at",
        ],
        _ => &[],
    }
}

/// (表, 按哪几列取行)。第一项是根表。
pub fn entity_spec(kind: &str) -> Option<&'static [(&'static str, &'static [&'static str])]> {
    const UPLOAD: &[(&str, &[&str])] = &[("uploads", &["upload_id"])];
    const DOCUMENT: &[(&str, &[&str])] = &[
        ("documents", &["document_id"]),
        ("document_title_state", &["document_id"]),
        ("document_metadata_suggestions", &["document_id"]),
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
    const GLOSSARY: &[(&str, &[&str])] = &[("glossaries", &["glossary_id"])];
    const ASSET: &[(&str, &[&str])] = &[("assets", &["asset_id"])];
    const CONVERSATION: &[(&str, &[&str])] = &[
        ("ai_conversations", &["conversation_id"]),
        ("ai_messages", &["conversation_id"]),
    ];
    const CALCULATION: &[(&str, &[&str])] = &[
        ("agent_calculation_runs", &["calculation_id"]),
        ("agent_calculation_artifacts", &["calculation_id"]),
    ];
    const OPERATION: &[(&str, &[&str])] = &[
        ("document_operations", &["operation_id"]),
        ("document_operation_attempts", &["operation_id"]),
        ("document_operation_events", &["operation_id"]),
        ("document_versions", &["operation_id"]),
    ];
    Some(match kind {
        "upload" => UPLOAD,
        "document" => DOCUMENT,
        "collection" => COLLECTION,
        "collection_member" => MEMBER,
        "favorite" => FAVORITE,
        "job" => JOB,
        "glossary" => GLOSSARY,
        "asset" => ASSET,
        "conversation" => CONVERSATION,
        "calculation" => CALCULATION,
        "operation" => OPERATION,
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

/// 一份文件内容在同步文件夹里的一个位置(某台设备某一段的包里)。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SyncBlobLocation {
    pub device: String,
    pub segment: u64,
    pub offset: u64,
    pub length: u64,
    /// 所在的包已被它的设备停用(将要删除或已删)。
    pub retired: bool,
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
    let local_only = local_only_columns(table);
    while let Some(row) = rows.next()? {
        let mut map = Map::new();
        for (index, name) in names.iter().enumerate() {
            if local_only.contains(&name.as_str()) {
                continue;
            }
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
    let local_only = local_only_columns(table);
    let columns: Vec<&String> = info
        .columns
        .iter()
        .filter(|column| row.contains_key(column.as_str()) && !local_only.contains(&column.as_str()))
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

/// 数据库刚从备份恢复(见 `backup.rs`):`previous` 是恢复前的 sync_state。
///
/// 恢复前的同步设置和记账整体放回(备份里那份可能是旧设置、旧文件夹)。恢复出来的书库
/// 是旧的:它不能当成本机新改动发出去(会盖掉别的设备上更新的内容),所以同步记账全部
/// 忘掉、待发清空。开过同步的话换一个新设备号、标成已登记,下一轮从头读同步文件夹里
/// 每台设备的改动——本机原来的设备号也当别的设备读,备份之后已经同步出去的改动都收回来。
pub(crate) fn sync_after_restore(conn: &Connection, previous: &[(String, String)]) -> Result<()> {
    conn.execute_batch(
        "DELETE FROM sync_state;
         DELETE FROM sync_entities;
         DELETE FROM sync_entity_files;
         DELETE FROM sync_cursors;
         DELETE FROM sync_pending;
         DELETE FROM sync_blobs;
         DELETE FROM sync_own_records;
         DELETE FROM sync_retired_packs;
         DELETE FROM sync_dirty;
         DELETE FROM sync_apply_guard;",
    )?;
    for (key, value) in previous {
        conn.execute("INSERT INTO sync_state(key, value) VALUES(?1, ?2)", params![key, value])?;
    }
    let joined = previous.iter().any(|(key, _)| key == "device_id");
    if joined {
        let seeded: BTreeMap<&str, u32> = SYNC_SEED_VERSIONS.iter().copied().collect();
        for (key, value) in [
            ("device_id", format!("{:016x}", fastrand::u64(..))),
            ("segment", "0".to_string()),
            ("seeded", serde_json::to_string(&seeded)?),
        ] {
            conn.execute(
                "INSERT INTO sync_state(key, value) VALUES(?1, ?2)
                 ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                params![key, value],
            )?;
        }
        conn.execute("DELETE FROM sync_state WHERE key IN ('device_written', 'fingerprint')", [])?;
    } else {
        // 还没开过同步:以后开启时照常把书库全部登记。
        conn.execute("DELETE FROM sync_state WHERE key = 'seeded'", [])?;
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

    /// 换了同步文件夹:忘掉同步记账(各实体的版本、文件、读取进度、等待区),
    /// 下一轮把本机书库全部重新发一遍。书库本身不动。
    pub fn sync_forget_folder(&self) -> Result<()> {
        let conn = self.connect()?;
        conn.execute_batch(
            "DELETE FROM sync_entities;
             DELETE FROM sync_entity_files;
             DELETE FROM sync_cursors;
             DELETE FROM sync_pending;
             DELETE FROM sync_blobs;
             DELETE FROM sync_own_records;
             DELETE FROM sync_retired_packs;
             DELETE FROM sync_state WHERE key IN ('segment', 'seeded', 'device_written', 'maintained_at', 'states_read_at')
                 OR key LIKE 'base:%';",
        )?;
        Ok(())
    }

    /// 一份文件内容在同步文件夹里的位置:没停用的包在前,同类里新的包在前。
    pub fn sync_blob_locations(&self, sha256: &str) -> Result<Vec<SyncBlobLocation>> {
        let conn = self.connect()?;
        let mut stmt = conn.prepare(
            "SELECT b.device, b.segment, b.offset, b.length,
                    EXISTS(SELECT 1 FROM sync_retired_packs r WHERE r.device = b.device AND r.segment = b.segment) AS retired
             FROM sync_blobs b WHERE b.sha256 = ?1
             ORDER BY retired, b.segment DESC, b.device",
        )?;
        let rows = stmt.query_map(params![sha256], |row| {
            Ok(SyncBlobLocation {
                device: row.get(0)?,
                segment: row.get::<_, i64>(1)? as u64,
                offset: row.get::<_, i64>(2)? as u64,
                length: row.get::<_, i64>(3)? as u64,
                retired: row.get::<_, i64>(4)? != 0,
            })
        })?;
        Ok(rows.collect::<std::result::Result<Vec<_>, _>>()?)
    }

    /// 这份内容在没停用的包里有没有(导出时有就不用再传)。
    pub fn sync_blob_available(&self, sha256: &str) -> Result<bool> {
        Ok(self.sync_blob_locations(sha256)?.iter().any(|l| !l.retired))
    }

    /// 记下一个包里有哪些文件。
    pub fn sync_record_blobs(&self, device: &str, segment: u64, index: &[(String, u64, u64)]) -> Result<()> {
        let mut conn = self.connect()?;
        let tx = conn.transaction()?;
        for (sha256, offset, length) in index {
            tx.execute(
                "INSERT OR IGNORE INTO sync_blobs(sha256, device, segment, offset, length) VALUES(?1, ?2, ?3, ?4, ?5)",
                params![sha256, device, segment as i64, *offset as i64, *length as i64],
            )?;
        }
        tx.commit()?;
        Ok(())
    }

    /// 一个包已经不在了:忘掉它里面的全部位置。
    pub fn sync_forget_pack(&self, device: &str, segment: u64) -> Result<()> {
        let conn = self.connect()?;
        conn.execute(
            "DELETE FROM sync_blobs WHERE device = ?1 AND segment = ?2",
            params![device, segment as i64],
        )?;
        Ok(())
    }

    /// 一台设备的各个包里有什么:段号 -> [(sha256, 偏移, 长度)]。
    pub fn sync_device_packs(&self, device: &str) -> Result<BTreeMap<u64, Vec<(String, u64, u64)>>> {
        let conn = self.connect()?;
        let mut stmt = conn.prepare(
            "SELECT segment, sha256, offset, length FROM sync_blobs WHERE device = ?1 ORDER BY segment, offset",
        )?;
        let rows = stmt.query_map(params![device], |row| {
            Ok((
                row.get::<_, i64>(0)? as u64,
                row.get::<_, String>(1)?,
                row.get::<_, i64>(2)? as u64,
                row.get::<_, i64>(3)? as u64,
            ))
        })?;
        let mut out: BTreeMap<u64, Vec<(String, u64, u64)>> = BTreeMap::new();
        for row in rows {
            let (segment, sha, offset, length) = row?;
            out.entry(segment).or_default().push((sha, offset, length));
        }
        Ok(out)
    }

    /// 换掉一台设备停用的包的清单:(段号, 从什么时候起)。
    pub fn sync_set_retired_packs(&self, device: &str, packs: &[(u64, String)]) -> Result<()> {
        let mut conn = self.connect()?;
        let tx = conn.transaction()?;
        tx.execute("DELETE FROM sync_retired_packs WHERE device = ?1", params![device])?;
        for (segment, since) in packs {
            tx.execute(
                "INSERT OR REPLACE INTO sync_retired_packs(device, segment, since) VALUES(?1, ?2, ?3)",
                params![device, *segment as i64, since],
            )?;
        }
        tx.commit()?;
        Ok(())
    }

    pub fn sync_retired_packs(&self, device: &str) -> Result<Vec<(u64, String)>> {
        let conn = self.connect()?;
        let mut stmt = conn.prepare(
            "SELECT segment, since FROM sync_retired_packs WHERE device = ?1 ORDER BY segment",
        )?;
        let rows = stmt.query_map(params![device], |row| Ok((row.get::<_, i64>(0)? as u64, row.get(1)?)))?;
        Ok(rows.collect::<std::result::Result<Vec<_>, _>>()?)
    }

    /// 本机现在要用到的全部文件内容:各实体当前的文件,加上等待区里的改动要的文件。
    pub fn sync_needed_blobs(&self) -> Result<BTreeSet<String>> {
        let conn = self.connect()?;
        let mut out = BTreeSet::new();
        let mut stmt = conn.prepare("SELECT DISTINCT sha256 FROM sync_entity_files")?;
        for sha in stmt.query_map([], |row| row.get::<_, String>(0))? {
            out.insert(sha?);
        }
        let mut stmt = conn.prepare("SELECT record_json FROM sync_pending")?;
        for json in stmt.query_map([], |row| row.get::<_, String>(0))? {
            let value: Value = serde_json::from_str(&json?).unwrap_or(Value::Null);
            for file in value.get("files").and_then(Value::as_array).into_iter().flatten() {
                if let Some(sha) = file.get("sha256").and_then(Value::as_str) {
                    out.insert(sha.to_string());
                }
            }
        }
        Ok(out)
    }

    /// 本机哪些文件是这份内容(实体当前的文件清单里记的,相对数据目录)。
    pub fn sync_paths_with_sha(&self, sha256: &str) -> Result<Vec<String>> {
        let conn = self.connect()?;
        let mut stmt = conn.prepare("SELECT DISTINCT path FROM sync_entity_files WHERE sha256 = ?1")?;
        let rows = stmt.query_map(params![sha256], |row| row.get(0))?;
        Ok(rows.collect::<std::result::Result<Vec<_>, _>>()?)
    }

    /// 本机发出的这些实体的最后一条改动记录在 `segment` 段。
    pub fn sync_note_own_records(&self, entities: &[(String, String)], segment: u64) -> Result<()> {
        let mut conn = self.connect()?;
        let tx = conn.transaction()?;
        for (kind, key) in entities {
            tx.execute(
                "INSERT INTO sync_own_records(kind, entity_key, segment) VALUES(?1, ?2, ?3)
                 ON CONFLICT(kind, entity_key) DO UPDATE SET segment = excluded.segment",
                params![kind, key, segment as i64],
            )?;
        }
        tx.commit()?;
        Ok(())
    }

    /// 本机发出的每个实体的最后一条改动记录所在的段:(种类, 键, 段号)。
    pub fn sync_own_records(&self) -> Result<Vec<(String, String, u64)>> {
        let conn = self.connect()?;
        let mut stmt = conn.prepare("SELECT kind, entity_key, segment FROM sync_own_records ORDER BY segment")?;
        let rows = stmt.query_map([], |row| Ok((row.get(0)?, row.get(1)?, row.get::<_, i64>(2)? as u64)))?;
        Ok(rows.collect::<std::result::Result<Vec<_>, _>>()?)
    }

    pub fn sync_clear_own_records(&self) -> Result<()> {
        let conn = self.connect()?;
        conn.execute("DELETE FROM sync_own_records", [])?;
        Ok(())
    }

    /// 等待区里的前几条(给人看:还在等什么)。
    pub fn sync_pending_summary(&self, limit: usize) -> Result<(usize, Vec<SyncPending>)> {
        let conn = self.connect()?;
        let total: i64 = conn.query_row("SELECT COUNT(*) FROM sync_pending", [], |row| row.get(0))?;
        let mut stmt = conn.prepare(
            "SELECT kind, entity_key, clock, '', reason, attempts FROM sync_pending ORDER BY clock LIMIT ?1",
        )?;
        let rows = stmt.query_map(params![limit as i64], |row| {
            Ok(SyncPending {
                kind: row.get(0)?,
                key: row.get(1)?,
                clock: row.get(2)?,
                record_json: row.get(3)?,
                reason: row.get(4)?,
                attempts: row.get(5)?,
            })
        })?;
        Ok((total as usize, rows.collect::<std::result::Result<Vec<_>, _>>()?))
    }

    /// 本机还有多少改动没发出去。
    pub fn sync_dirty_count(&self) -> Result<usize> {
        let conn = self.connect()?;
        let count: i64 = conn.query_row("SELECT COUNT(*) FROM sync_dirty", [], |row| row.get(0))?;
        Ok(count as usize)
    }

    /// 把本机现有的这几种实体标成待同步(第一次开启同步、或某一种要重新登记时)。
    pub fn sync_seed(&self, kinds: &[&str]) -> Result<usize> {
        let conn = self.connect()?;
        let now = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";
        let mut total = 0;
        for kind in kinds {
            let spec = entity_spec(kind).ok_or_else(|| anyhow::anyhow!("unknown sync kind: {kind}"))?;
            let (root, columns) = spec[0];
            let key = columns
                .iter()
                .map(|c| format!("\"{c}\""))
                .collect::<Vec<_>>()
                .join(" || '|' || ");
            total += conn.execute(
                &format!(
                    "INSERT OR IGNORE INTO sync_dirty(kind, entity_key, changed_at)
                     SELECT '{kind}', {key}, {now} FROM \"{root}\""
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
