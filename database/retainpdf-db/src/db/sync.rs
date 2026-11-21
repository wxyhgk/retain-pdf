//! 多设备同步的数据库一侧(文件与同步文件夹在 retainpdf-data::sync)。
//!
//! # 实体
//!
//! 同步的单位是「实体」:一组按同一个键取出的行。键和表的对应见 [`entity_spec`]:
//! 一本书(条目 library_items + 书目、作者、文件、书名建议、标签、关联;v36 以前是 documents + 标题状态与标题建议)、
//! 一个标签、一次上传、一个合集、一条合集成员、一条收藏、
//! 一个任务(jobs + 产物登记 + 流水线记录 + 事件)、一张术语表、一张收藏截图、一段 AI 对话
//! (含消息)、一次 AI 计算(含产出的图)、一次 AI 改文档的操作(含尝试、事件、产出的版本)。
//! 实体的第一张表是根表,其余是挂在它下面的子表。v36 以前的书由 [`upgrade_legacy_sync_record`] 改写成现在的样子
//! (同步文件夹里别的设备发来的、本机记着的上次同步的内容都要改写)。
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
    "job",
    "glossary",
    "tag",
];

/// 以前同步过、后来删掉的种类（2026-11-20 v31 删了 RetainPDF 自己的 AI 留下的表和收藏）。旧版本的设备还可能发来，
/// 收到就当过时的改动忽略，不当成「新版本才有的种类」存着等升级（等不到）。
pub const RETIRED_SYNC_KINDS: &[&str] = &["favorite", "asset", "conversation", "calculation", "operation"];

/// 每种实体的登记版本。新增种类、或给已有种类加了表时调高:已经开过同步的设备下一轮把
/// 这一种的现有内容全部重新登记一遍(没变的内容不会重发)。
pub const SYNC_SEED_VERSIONS: &[(&str, u32)] = &[
    ("upload", 1),
    // 3:v36 书换成条目 + 明细表;4:v37 加了条目的标签、关联。
    ("document", 4),
    ("collection", 1),
    // 2:v37 成员换成条目(collection_items)。
    ("collection_member", 2),
    ("job", 2),
    ("glossary", 1),
    ("tag", 1),
];

/// 只在本机有意义、不同步的列。以前是 AI 对话接着哪个本机会话进程往下聊（表 2026-11-20 删了），现在没有；
/// 机制留着，以后有这种列加在这里。
pub fn local_only_columns(table: &str) -> &'static [&'static str] {
    match table {
        // 这本书选了哪份译文:译文版本不同步,选择也只在本机(v36 以前是一张不同步的表)。
        "item_files" => &["chosen_version_id"],
        _ => &[],
    }
}

/// 写入别的设备发来的实体时,按主键覆盖、不先删的子表(其余子表先删后插)。
/// 文件下面挂着本机才有的译文版本(外键级联):先删文件行会把它们连带删掉。
const UPSERT_CHILD_TABLES: &[&str] = &["item_files"];

/// (表, 按哪几列取行)。第一项是根表。
pub fn entity_spec(kind: &str) -> Option<&'static [(&'static str, &'static [&'static str])]> {
    const UPLOAD: &[(&str, &[&str])] = &[("uploads", &["upload_id"])];
    // 一个文献条目:书目、作者、文件(PDF)、书名建议。键是条目编号(上传自动建的书 = PDF 的内容指纹)。
    const DOCUMENT: &[(&str, &[&str])] = &[
        ("library_items", &["item_id"]),
        ("item_references", &["item_id"]),
        ("item_creators", &["item_id"]),
        ("item_files", &["item_id"]),
        ("item_title_suggestions", &["item_id"]),
        // v37:条目的标签、条目之间的关联(挂在主语条目上)。
        ("item_tags", &["item_id"]),
        ("item_relations", &["subject_item_id"]),
    ];
    const COLLECTION: &[(&str, &[&str])] = &[("collections", &["collection_id"])];
    // v37 起成员是任何条目(以前是书的文件,`collection_documents`)。
    const MEMBER: &[(&str, &[&str])] = &[("collection_items", &["collection_id", "item_id"])];
    const TAG: &[(&str, &[&str])] = &[("tags", &["tag_id"])];
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
        // v33 起任务的阶段历史单独一张表（以前在 jobs.runtime_json 里）。
        ("job_stage_history", &["job_id"]),
    ];
    const GLOSSARY: &[(&str, &[&str])] = &[("glossaries", &["glossary_id"])];
    Some(match kind {
        "upload" => UPLOAD,
        "document" => DOCUMENT,
        "collection" => COLLECTION,
        "collection_member" => MEMBER,
        "job" => JOB,
        "glossary" => GLOSSARY,
        "tag" => TAG,
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

/// 旧版本设备发来的整个实体按现在的表结构改写（行内的列见 [`upgrade_legacy_row`]）：
/// - v33：任务行的 `runtime_json` 拆成 `jobs` 上的几列（进入当前阶段、最后出错和重试的时间、重试次数）和
///   `job_stage_history` 的行；其余字段读的时候算，丢掉。
fn upgrade_legacy_entity<'a>(kind: &str, rows: &'a SyncRows) -> std::borrow::Cow<'a, SyncRows> {
    if kind == "collection_member" {
        return match upgrade_legacy_member(rows, &BTreeMap::new()) {
            Some((upgraded, _)) => std::borrow::Cow::Owned(upgraded),
            None => std::borrow::Cow::Borrowed(rows),
        };
    }
    if kind == "document" {
        return match upgrade_legacy_document(rows) {
            Some(upgraded) => std::borrow::Cow::Owned(upgraded),
            None => std::borrow::Cow::Borrowed(rows),
        };
    }
    let legacy_runtime = kind == "job"
        && rows.get("jobs").and_then(|r| r.first()).is_some_and(|row| row.contains_key("runtime_json"));
    if !legacy_runtime {
        return std::borrow::Cow::Borrowed(rows);
    }
    let mut upgraded = rows.clone();
    let Some(job) = upgraded.get_mut("jobs").and_then(|r| r.first_mut()) else {
        return std::borrow::Cow::Owned(upgraded);
    };
    let runtime: Value = job
        .remove("runtime_json")
        .and_then(|value| value.as_str().and_then(|text| serde_json::from_str(text).ok()))
        .unwrap_or(Value::Null);
    let job_id = job.get("job_id").cloned().unwrap_or(Value::Null);
    let field = |name: &str| runtime.get(name).cloned().unwrap_or(Value::Null);
    job.insert("stage_entered_at".into(), field("stage_started_at"));
    job.insert("last_error_at".into(), field("last_error_at"));
    job.insert("retry_count".into(), runtime.get("retry_count").cloned().unwrap_or(Value::from(0)));
    job.insert("last_retry_at".into(), field("last_retry_at"));
    if !upgraded.contains_key("job_stage_history") {
        let history = runtime
            .get("stage_history")
            .and_then(Value::as_array)
            .map(|entries| {
                entries
                    .iter()
                    .enumerate()
                    .filter_map(|(seq, entry)| {
                        let mut row = Map::new();
                        row.insert("job_id".into(), job_id.clone());
                        row.insert("seq".into(), Value::from(seq as i64));
                        for key in [
                            "stage", "detail", "enter_at", "exit_at", "duration_ms", "terminal_status",
                            "progress_current", "progress_total",
                        ] {
                            row.insert(key.into(), entry.get(key).cloned().unwrap_or(Value::Null));
                        }
                        row.get("stage").is_some_and(Value::is_string).then_some(row)
                    })
                    .collect()
            })
            .unwrap_or_default();
        upgraded.insert("job_stage_history".into(), history);
    }
    std::borrow::Cow::Owned(upgraded)
}

/// v36 以前的书(`documents` 一行 + `document_title_state` + `document_metadata_suggestions`)拆成条目、书目、作者、文件、
/// 书名建议,和迁移 `v36_library_items.sql` 同一套对应。不是旧结构返回 None。
fn upgrade_legacy_document(rows: &SyncRows) -> Option<SyncRows> {
    let document = rows.get("documents")?.first()?;
    let id = document.get("document_id")?.clone();
    let pick = |row: &Map<String, Value>, pairs: &[(&str, &str)]| {
        let mut out = Map::new();
        for (from, to) in pairs {
            if let Some(value) = row.get(*from) {
                out.insert((*to).to_string(), value.clone());
            }
        }
        out
    };
    let mut item = pick(document, &[("added_at", "created_at"), ("updated_at", "updated_at"), ("owner_user_id", "owner_user_id")]);
    item.insert("item_id".into(), id.clone());
    item.insert("item_type".into(), Value::from("reference"));

    let mut reference = pick(document, &[("title", "title"), ("year", "year"), ("doi", "doi")]);
    reference.insert("item_id".into(), id.clone());
    if let Some(state) = rows.get("document_title_state").and_then(|r| r.first()) {
        reference.extend(pick(state, &[("source", "title_source"), ("suggestion_id", "title_suggestion_id")]));
        let locked = state.get("locked").is_some_and(|v| v.as_i64().is_some_and(|n| n != 0) || v.as_bool() == Some(true));
        reference.insert("title_locked".into(), Value::from(i64::from(locked)));
    }

    let authors: Vec<Value> = document
        .get("authors_json")
        .and_then(Value::as_str)
        .and_then(|text| serde_json::from_str::<Value>(text).ok())
        .and_then(|value| value.as_array().cloned())
        .unwrap_or_default();
    let creators = authors
        .iter()
        .enumerate()
        .map(|(position, author)| {
            let literal = author.as_str().map(str::to_string).unwrap_or_else(|| author.to_string());
            let mut row = Map::new();
            row.insert("item_id".into(), id.clone());
            row.insert("position".into(), Value::from(position as i64));
            row.insert("role".into(), Value::from("author"));
            row.insert("literal".into(), Value::from(literal));
            row
        })
        .collect();

    let mut file = pick(
        document,
        &[
            ("document_id", "file_id"),
            ("source_filename", "source_filename"),
            ("page_count", "page_count"),
            ("bytes", "bytes"),
            ("active_job_id", "active_job_id"),
            ("reading_status", "reading_status"),
            ("added_at", "added_at"),
            ("last_opened_at", "last_opened_at"),
            ("updated_at", "updated_at"),
        ],
    );
    file.insert("item_id".into(), id.clone());

    let suggestions = rows
        .get("document_metadata_suggestions")
        .map(|list| {
            list.iter()
                .map(|row| {
                    let mut row = row.clone();
                    row.remove("document_id");
                    row.insert("item_id".into(), id.clone());
                    row
                })
                .collect()
        })
        .unwrap_or_default();

    let mut out = SyncRows::new();
    out.insert("library_items".into(), vec![item]);
    out.insert("item_references".into(), vec![reference]);
    out.insert("item_creators".into(), creators);
    out.insert("item_files".into(), vec![file]);
    out.insert("item_title_suggestions".into(), suggestions);
    Some(out)
}

/// v36 以前的书每个字段的同步时钟换成现在的字段:新的一个字段由旧的哪几个合成,取其中最新的时钟
/// (旧的一个都没有就不写,合并时按整条记录的时钟算)。
const LEGACY_DOCUMENT_CLOCKS: &[(&str, &[&str])] = &[
    ("library_items.item_id", &["documents.document_id"]),
    ("library_items.created_at", &["documents.added_at"]),
    ("library_items.updated_at", &["documents.updated_at"]),
    ("library_items.owner_user_id", &["documents.owner_user_id"]),
    ("item_references", &["documents.title", "documents.year", "documents.doi", "document_title_state"]),
    ("item_creators", &["documents.authors_json"]),
    (
        "item_files",
        &[
            "documents.source_filename",
            "documents.page_count",
            "documents.bytes",
            "documents.active_job_id",
            "documents.reading_status",
            "documents.added_at",
            "documents.last_opened_at",
        ],
    ),
    ("item_title_suggestions", &["document_metadata_suggestions"]),
];

/// 一条同步记录(内容 + 每个字段的时钟)按现在的表结构改写;本来就是现在的样子返回 None。
/// 同步引擎收到别的设备的记录时、开库时改写本机记着的上次同步内容时都用它,
/// 这样逐字段合并比的是同一套字段。
pub fn upgrade_legacy_sync_record(
    kind: &str,
    rows: &SyncRows,
    clocks: &BTreeMap<String, String>,
) -> Option<(SyncRows, BTreeMap<String, String>)> {
    if kind == "collection_member" {
        return upgrade_legacy_member(rows, clocks);
    }
    if kind != "document" {
        return None;
    }
    let upgraded = upgrade_legacy_document(rows)?;
    let mut new_clocks = BTreeMap::new();
    for (field, sources) in LEGACY_DOCUMENT_CLOCKS {
        if let Some(clock) = sources.iter().filter_map(|source| clocks.get(*source)).max() {
            new_clocks.insert((*field).to_string(), clock.clone());
        }
    }
    for (field, clock) in clocks {
        if !field.starts_with("documents.") && !field.starts_with("document_") {
            new_clocks.insert(field.clone(), clock.clone());
        }
    }
    Some((upgraded, new_clocks))
}

/// v37 以前的文件夹成员(`collection_documents`,成员是书的文件)换成 `collection_items`(成员是条目):
/// 自动建的条目编号就是文件的内容指纹,值不变,只换表名和列名;字段时钟跟着换名。
fn upgrade_legacy_member(
    rows: &SyncRows,
    clocks: &BTreeMap<String, String>,
) -> Option<(SyncRows, BTreeMap<String, String>)> {
    let old = rows.get("collection_documents")?;
    let members = old
        .iter()
        .map(|row| {
            row.iter()
                .map(|(column, value)| {
                    let column = if column == "document_id" { "item_id" } else { column.as_str() };
                    (column.to_string(), value.clone())
                })
                .collect::<Map<String, Value>>()
        })
        .collect();
    let mut upgraded = SyncRows::new();
    upgraded.insert("collection_items".into(), members);
    let new_clocks = clocks
        .iter()
        .map(|(field, clock)| {
            let field = match field.strip_prefix("collection_documents.") {
                Some("document_id") => "collection_items.item_id".to_string(),
                Some(column) => format!("collection_items.{column}"),
                None => field.clone(),
            };
            (field, clock.clone())
        })
        .collect();
    Some((upgraded, new_clocks))
}

/// 旧版本设备发来的行（同步文件夹里老的包也是）按现在的表结构改写。只认得的几处，按迁移版本往下加：
/// - v32：`jobs.status_json`（`"succeeded"`）→ `jobs.status`（`succeeded`），`jobs.workflow` 去掉引号。
fn upgrade_legacy_row<'a>(table: &str, row: &'a Map<String, Value>) -> std::borrow::Cow<'a, Map<String, Value>> {
    if table != "jobs" {
        return std::borrow::Cow::Borrowed(row);
    }
    let quoted = |value: Option<&Value>| value.and_then(Value::as_str).is_some_and(|text| text.starts_with('"'));
    if !row.contains_key("status_json") && !quoted(row.get("workflow")) {
        return std::borrow::Cow::Borrowed(row);
    }
    let unquote = |value: &Value| match value.as_str() {
        Some(text) => Value::String(text.trim_matches('"').to_string()),
        None => value.clone(),
    };
    let mut upgraded = row.clone();
    if let Some(status) = upgraded.remove("status_json") {
        upgraded.entry("status".to_string()).or_insert_with(|| unquote(&status));
    }
    if let Some(workflow) = upgraded.get("workflow").map(unquote) {
        upgraded.insert("workflow".to_string(), workflow);
    }
    std::borrow::Cow::Owned(upgraded)
}

fn insert_row(
    tx: &Transaction<'_>,
    table: &str,
    info: &TableInfo,
    row: &Map<String, Value>,
    upsert: bool,
) -> Result<()> {
    let row = upgrade_legacy_row(table, row);
    let row = row.as_ref();
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

/// 按主键覆盖的子表:删掉本机这个实体下、对方已经没有的行(按主键比)。
fn remove_rows_not_in(
    tx: &Transaction<'_>,
    table: &str,
    info: &TableInfo,
    key_columns: &[&str],
    key: &[&str],
    incoming: &[Map<String, Value>],
) -> Result<()> {
    if info.primary_key.is_empty() {
        bail!("{table} has no primary key to upsert by");
    }
    let primary_key = |row: &Map<String, Value>| -> Vec<Value> {
        info.primary_key.iter().map(|c| row.get(c.as_str()).cloned().unwrap_or(Value::Null)).collect()
    };
    let wanted: Vec<Vec<Value>> = incoming.iter().map(|row| primary_key(row)).collect();
    for row in read_rows(tx, table, key_columns, key)? {
        let pk = primary_key(&row);
        if wanted.contains(&pk) {
            continue;
        }
        let values = pk.iter().map(sql_from_json).collect::<Result<Vec<_>>>()?;
        let columns: Vec<&str> = info.primary_key.iter().map(String::as_str).collect();
        tx.execute(
            &format!("DELETE FROM \"{table}\" WHERE {}", where_clause(&columns)),
            rusqlite::params_from_iter(values.iter()),
        )?;
    }
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
    /// 本机记着的上次同步内容（`sync_entities.base_json`）和字段时钟还是 v36 以前的书、v37 以前的文件夹成员的，按 [`upgrade_legacy_sync_record`]
    /// 改写。改完以后再跑什么都不动。返回改了几条。
    pub(crate) fn upgrade_legacy_sync_states(&self) -> Result<usize> {
        let mut conn = self.connect()?;
        let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
        let legacy: Vec<(String, String, String, String)> = {
            let mut stmt = tx.prepare(
                "SELECT kind, entity_key, base_json, clocks_json FROM sync_entities
                 WHERE (kind = 'document' AND base_json LIKE '%\"documents\"%')
                    OR (kind = 'collection_member' AND base_json LIKE '%\"collection_documents\"%')",
            )?;
            let rows = stmt.query_map([], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)))?;
            rows.collect::<rusqlite::Result<_>>()?
        };
        let mut upgraded = 0;
        for (kind, key, base_json, clocks_json) in legacy {
            let Ok(base) = serde_json::from_str::<SyncRows>(&base_json) else { continue };
            let clocks: BTreeMap<String, String> = serde_json::from_str(&clocks_json).unwrap_or_default();
            let Some((rows, clocks)) = upgrade_legacy_sync_record(&kind, &base, &clocks) else { continue };
            tx.execute(
                "UPDATE sync_entities SET base_json = ?1, clocks_json = ?2 WHERE kind = ?3 AND entity_key = ?4",
                params![serde_json::to_string(&rows)?, serde_json::to_string(&clocks)?, kind, key],
            )?;
            upgraded += 1;
        }
        tx.commit()?;
        Ok(upgraded)
    }

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

    /// 一次写好几项,在一个事务里:要么都写进去,要么都没写。
    pub fn sync_state_set_many(&self, entries: &[(&str, &str)]) -> Result<()> {
        let mut conn = self.connect()?;
        let tx = conn.transaction_with_behavior(rusqlite::TransactionBehavior::Immediate)?;
        for (key, value) in entries {
            tx.execute(
                "INSERT INTO sync_state(key, value) VALUES(?1, ?2)
                 ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                params![key, value],
            )?;
        }
        tx.commit()?;
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
        let rows = rows.map(|rows| upgrade_legacy_entity(update.kind, rows));
        let rows = rows.as_deref();
        let mut conn = self.connect()?;
        let tx = Transaction::new(&mut conn, TransactionBehavior::Immediate)?;
        tx.execute_batch("PRAGMA defer_foreign_keys = ON;")?;
        tx.execute("INSERT OR IGNORE INTO sync_apply_guard(singleton) VALUES(1)", [])?;
        let (root, root_columns) = spec[0];
        match rows {
            None => {
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
                    if UPSERT_CHILD_TABLES.contains(table) {
                        continue;
                    }
                    tx.execute(
                        &format!("DELETE FROM \"{table}\" WHERE {}", where_clause(columns)),
                        rusqlite::params_from_iter(parts[..columns.len()].iter()),
                    )?;
                }
                for (table, columns) in spec.iter().skip(1) {
                    let info = table_info(&tx, table)?;
                    let incoming = rows.get(*table).map(Vec::as_slice).unwrap_or(&[]);
                    let upsert = UPSERT_CHILD_TABLES.contains(table);
                    if upsert {
                        remove_rows_not_in(&tx, table, &info, columns, &parts[..columns.len()], incoming)?;
                    }
                    for row in incoming {
                        insert_row(&tx, table, &info, row, upsert)?;
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

#[cfg(test)]
mod legacy_row_tests {
    use serde_json::{json, Map, Value};

    use super::upgrade_legacy_row;

    fn row(value: Value) -> Map<String, Value> {
        value.as_object().unwrap().clone()
    }

    /// 旧版本设备发来的任务（v33 以前）：runtime_json 拆成几列和阶段历史的行。
    #[test]
    fn legacy_job_runtime_is_split_into_columns_and_history_rows() {
        let runtime = json!({"stage_started_at": "t1", "retry_count": 2, "last_retry_at": "t0", "last_error_at": null,
            "stage_history": [{"stage": "queued", "enter_at": "t0", "exit_at": "t1", "duration_ms": 5},
                              {"stage": "translating", "enter_at": "t1"}]});
        let mut rows = super::SyncRows::new();
        rows.insert("jobs".into(), vec![row(json!({"job_id": "j", "status_json": "\"running\"", "runtime_json": runtime.to_string()}))]);
        let upgraded = super::upgrade_legacy_entity("job", &rows);
        let job = &upgraded["jobs"][0];
        assert!(!job.contains_key("runtime_json"));
        assert_eq!(job["stage_entered_at"], json!("t1"));
        assert_eq!(job["retry_count"], json!(2));
        let history = &upgraded["job_stage_history"];
        assert_eq!(history.len(), 2);
        assert_eq!(history[1]["seq"], json!(1));
        assert_eq!(history[1]["stage"], json!("translating"));
        assert_eq!(history[1]["exit_at"], Value::Null);

        let mut current = super::SyncRows::new();
        current.insert("jobs".into(), vec![row(json!({"job_id": "j", "status": "running"}))]);
        assert!(matches!(super::upgrade_legacy_entity("job", &current), std::borrow::Cow::Borrowed(_)));
    }

    fn legacy_book() -> super::SyncRows {
        let mut rows = super::SyncRows::new();
        rows.insert(
            "documents".into(),
            vec![row(json!({"document_id": "d", "title": "T", "authors_json": "[\"A\", \"B\"]", "year": 1999,
                "doi": "10.1/x", "source_filename": "t.pdf", "page_count": 3, "bytes": 9, "active_job_id": "j",
                "reading_status": "reading", "added_at": "t0", "last_opened_at": null, "updated_at": "t1",
                "active_version_id": null, "owner_user_id": "local"}))],
        );
        rows.insert(
            "document_title_state".into(),
            vec![row(json!({"document_id": "d", "source": "user", "locked": 1, "suggestion_id": null, "updated_at": "t1"}))],
        );
        rows.insert(
            "document_metadata_suggestions".into(),
            vec![row(json!({"suggestion_id": "s", "document_id": "d", "selected_title": "T"}))],
        );
        rows
    }

    /// v36 以前的书拆成条目、书目、作者、文件、书名建议；字段时钟按「新字段由哪几个旧字段合成、取最新」换过来。
    #[test]
    fn a_legacy_book_record_is_split_into_library_item_rows_and_clocks() {
        let clocks: std::collections::BTreeMap<String, String> = [
            ("documents.title", "c3"),
            ("documents.doi", "c1"),
            ("document_title_state", "c2"),
            ("documents.reading_status", "c4"),
            ("documents.authors_json", "c1"),
            ("$files", "c5"),
        ]
        .into_iter()
        .map(|(k, v)| (k.to_string(), v.to_string()))
        .collect();
        let (rows, clocks) = super::upgrade_legacy_sync_record("document", &legacy_book(), &clocks).unwrap();
        assert_eq!(
            Value::Object(rows["library_items"][0].clone()),
            json!({"item_id": "d", "item_type": "reference", "created_at": "t0", "updated_at": "t1", "owner_user_id": "local"})
        );
        let reference = &rows["item_references"][0];
        assert_eq!((&reference["title"], &reference["title_source"], &reference["title_locked"]), (&json!("T"), &json!("user"), &json!(1)));
        assert_eq!((&reference["year"], &reference["doi"]), (&json!(1999), &json!("10.1/x")));
        let names: Vec<&Value> = rows["item_creators"].iter().map(|c| &c["literal"]).collect();
        assert_eq!(names, vec![&json!("A"), &json!("B")]);
        let file = &rows["item_files"][0];
        assert_eq!((&file["file_id"], &file["item_id"], &file["reading_status"]), (&json!("d"), &json!("d"), &json!("reading")));
        assert!(!file.contains_key("title") && !file.contains_key("owner_user_id"));
        assert_eq!(rows["item_title_suggestions"][0]["item_id"], json!("d"));
        assert!(!rows["item_title_suggestions"][0].contains_key("document_id"));
        assert!(!rows.contains_key("documents"));

        assert_eq!(clocks["item_references"], "c3", "书名、DOI、书名状态里最新的");
        assert_eq!(clocks["item_files"], "c4");
        assert_eq!(clocks["item_creators"], "c1");
        assert_eq!(clocks["$files"], "c5");
        assert!(clocks.keys().all(|k| !k.starts_with("documents.") && !k.starts_with("document_")), "{clocks:?}");

        assert!(super::upgrade_legacy_sync_record("document", &rows, &clocks).is_none(), "已经是现在的样子就不再改");
        assert!(super::upgrade_legacy_sync_record("job", &legacy_book(), &clocks).is_none());
    }

    /// v37 以前的文件夹成员（成员是书的文件）换成条目：只换表名、列名，字段时钟跟着换名。
    #[test]
    fn a_legacy_collection_member_becomes_a_collection_item() {
        let mut rows = super::SyncRows::new();
        rows.insert(
            "collection_documents".into(),
            vec![row(json!({"collection_id": "c", "document_id": "d", "added_at": "t"}))],
        );
        let clocks: std::collections::BTreeMap<String, String> =
            [("collection_documents.document_id", "c1"), ("collection_documents.added_at", "c2")]
                .into_iter()
                .map(|(k, v)| (k.to_string(), v.to_string()))
                .collect();
        let (upgraded, clocks) = super::upgrade_legacy_sync_record("collection_member", &rows, &clocks).unwrap();
        assert_eq!(
            Value::Object(upgraded["collection_items"][0].clone()),
            json!({"collection_id": "c", "item_id": "d", "added_at": "t"})
        );
        assert!(!upgraded.contains_key("collection_documents"));
        assert_eq!(clocks["collection_items.item_id"], "c1");
        assert_eq!(clocks["collection_items.added_at"], "c2");
        assert!(super::upgrade_legacy_sync_record("collection_member", &upgraded, &clocks).is_none());
    }

    /// 本机记着的上次同步的书（`sync_entities`）开库时改写一次，以后再开什么都不动。
    #[test]
    fn stored_sync_states_of_legacy_books_are_rewritten_once_on_init() {
        let root = std::env::temp_dir().join(format!("retain-sync-legacy-{:016x}", fastrand::u64(..)));
        let db = crate::db::Db::new(root.join("jobs.db"), root.clone());
        db.init().unwrap();
        db.connect()
            .unwrap()
            .execute(
                "INSERT INTO sync_entities(kind, entity_key, clock, deleted, digest, base_json, clocks_json)
                 VALUES('document', 'd', 'c9', 0, 'x', ?1, '{\"documents.title\":\"c3\"}')",
                [serde_json::to_string(&legacy_book()).unwrap()],
            )
            .unwrap();
        db.init().unwrap();
        let (base, clocks): (String, String) = db
            .connect()
            .unwrap()
            .query_row("SELECT base_json, clocks_json FROM sync_entities WHERE entity_key = 'd'", [], |r| Ok((r.get(0)?, r.get(1)?)))
            .unwrap();
        let base: super::SyncRows = serde_json::from_str(&base).unwrap();
        assert!(base.contains_key("library_items") && !base.contains_key("documents"));
        assert_eq!(clocks, r#"{"item_references":"c3"}"#);
        assert_eq!(db.upgrade_legacy_sync_states().unwrap(), 0);
        std::fs::remove_dir_all(root).ok();
    }

    /// 旧版本设备发来的任务行（v32 以前的列）改写成现在的样子；新的行、别的表原样不动。
    #[test]
    fn legacy_job_rows_are_rewritten_to_plain_text_columns() {
        let old = row(json!({"job_id": "j", "workflow": "\"book\"", "status_json": "\"failed\""}));
        let upgraded = upgrade_legacy_row("jobs", &old);
        assert_eq!(
            Value::Object(upgraded.into_owned()),
            json!({"job_id": "j", "workflow": "book", "status": "failed"})
        );

        let current = row(json!({"job_id": "j", "workflow": "ocr", "status": "running"}));
        assert!(matches!(upgrade_legacy_row("jobs", &current), std::borrow::Cow::Borrowed(_)));
        let other = row(json!({"status_json": "\"x\""}));
        assert!(matches!(upgrade_legacy_row("documents", &other), std::borrow::Cow::Borrowed(_)));
    }
}
