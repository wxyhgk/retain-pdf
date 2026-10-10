//! 通用取数：任务目录里已有的数据按登记表取，不再一个需求开一个接口。
//!
//! 登记表就是契约 `contracts/job-data.v1.schema.json` 的 `datasets`（后端编译时读入的是
//! `backend/contracts/` 里逐字节一致的那份）：每个数据集写明文件在哪、记录在哪、有哪些字段、
//! 哪些能筛选。前端要读新数据就在那里加一条，这里不用改。
//!
//! 只做等值筛选（逗号为「或」）、按字段计数、排序、分页；不开放查询语言，也不能读登记表
//! 以外的文件。每条记录统一补上 `item_id`（三位，译文条目）、`reader_item_id`（四位，阅读页）、
//! `page`（1 起），跨数据集就能对上、在阅读页上跳过去。

use std::collections::{BTreeMap, HashMap};
use std::fs;
use std::path::{Component, Path, PathBuf};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::SystemTime;

use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};

use crate::error::AppError;

pub(crate) mod api;

const REGISTRY_JSON: &str = include_str!("../../../../contracts/job-data.v1.schema.json");
pub const DEFAULT_LIMIT: usize = 200;
pub const MAX_LIMIT: usize = 1000;
const IDENTITY_FIELDS: [&str; 3] = ["item_id", "reader_item_id", "page"];
const RESERVED_PARAMS: [&str; 5] = ["fields", "group_by", "sort", "offset", "limit"];

// ---------------------------------------------------------------- 登记表

#[derive(Debug, Deserialize)]
struct RegistryFile {
    datasets: BTreeMap<String, DatasetSpec>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct DatasetSpec {
    pub description: String,
    pub source: SourceSpec,
    #[serde(default)]
    pub identity: IdentitySpec,
    pub fields: BTreeMap<String, FieldSpec>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SourceSpec {
    /// json_rows / jsonl / page_rows / object
    pub kind: String,
    /// artifacts / translated / logs
    pub root: String,
    #[serde(default)]
    pub file: Option<String>,
    #[serde(default)]
    pub glob: Option<String>,
    /// json_rows：记录数组在文件里的 JSON Pointer。
    #[serde(default)]
    pub rows: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct IdentitySpec {
    #[serde(default)]
    pub item_id: Option<String>,
    #[serde(default)]
    pub page: Option<String>,
    /// 0 起的页序号（加 1 成页码）。
    #[serde(default)]
    pub page_index: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct FieldSpec {
    /// 记录里的路径（点分）；`$` 是整条记录；不写就是字段名本身。
    #[serde(default)]
    pub path: Option<String>,
    #[serde(rename = "type")]
    pub kind: String,
    #[serde(default)]
    pub filter: bool,
    pub description: String,
}

impl FieldSpec {
    fn path<'a>(&'a self, name: &'a str) -> &'a str {
        self.path.as_deref().unwrap_or(name)
    }
}

pub fn registry() -> &'static BTreeMap<String, DatasetSpec> {
    static REGISTRY: OnceLock<BTreeMap<String, DatasetSpec>> = OnceLock::new();
    REGISTRY.get_or_init(|| {
        let file: RegistryFile =
            serde_json::from_str(REGISTRY_JSON).expect("contracts/job-data.v1.schema.json datasets must parse");
        file.datasets
    })
}

fn is_rows(spec: &DatasetSpec) -> bool {
    spec.source.kind != "object"
}

/// 登记表自检（契约测试也跑这一个）：来源种类、根目录、路径都必须在白名单里。
pub fn validate_registry() -> Result<(), String> {
    for (name, spec) in registry() {
        let source = &spec.source;
        if !["json_rows", "jsonl", "page_rows", "object"].contains(&source.kind.as_str()) {
            return Err(format!("{name}: unknown source kind {}", source.kind));
        }
        if !["artifacts", "translated", "logs"].contains(&source.root.as_str()) {
            return Err(format!("{name}: unknown root {}", source.root));
        }
        match source.kind.as_str() {
            "page_rows" => {
                let glob = source.glob.as_deref().ok_or(format!("{name}: page_rows needs glob"))?;
                if glob.matches('*').count() != 1 || glob.contains('/') {
                    return Err(format!("{name}: glob must be a single `prefix*suffix` file pattern"));
                }
            }
            _ => {
                let file = source.file.as_deref().ok_or(format!("{name}: needs file"))?;
                if !safe_relative(file) {
                    return Err(format!("{name}: file must be a plain relative path"));
                }
            }
        }
        if source.kind == "json_rows" && !source.rows.as_deref().is_some_and(|rows| rows.starts_with('/')) {
            return Err(format!("{name}: json_rows needs a JSON Pointer in rows"));
        }
        for (field, field_spec) in &spec.fields {
            if IDENTITY_FIELDS.contains(&field.as_str()) {
                return Err(format!("{name}: field {field} clashes with a shared identity field"));
            }
            if !["string", "integer", "number", "boolean", "object", "array", "any"].contains(&field_spec.kind.as_str()) {
                return Err(format!("{name}.{field}: unknown type {}", field_spec.kind));
            }
            if field_spec.filter && !["string", "integer", "number", "boolean"].contains(&field_spec.kind.as_str()) {
                return Err(format!("{name}.{field}: only scalar fields can be filters"));
            }
        }
    }
    Ok(())
}

fn safe_relative(path: &str) -> bool {
    let path = Path::new(path);
    !path.as_os_str().is_empty() && path.components().all(|component| matches!(component, Component::Normal(_)))
}

// ---------------------------------------------------------------- 读文件（带缓存）

/// 任务的几个根目录。
#[derive(Debug, Clone)]
pub struct JobDataRoots {
    pub artifacts: PathBuf,
    pub translated: PathBuf,
    pub logs: PathBuf,
}

impl JobDataRoots {
    fn root(&self, name: &str) -> &Path {
        match name {
            "translated" => &self.translated,
            "logs" => &self.logs,
            _ => &self.artifacts,
        }
    }
}

/// 解析过的文件按「路径 + 大小 + 修改时间」缓存，文件没变就不重新解析；总量超过上限时清掉最早的。
const CACHE_BUDGET_BYTES: u64 = 64 * 1024 * 1024;

struct CacheEntry {
    len: u64,
    modified: Option<SystemTime>,
    value: Arc<Value>,
    used: u64,
}

static CACHE: Mutex<Option<(HashMap<PathBuf, CacheEntry>, u64)>> = Mutex::new(None);

fn parse_file(path: &Path, jsonl: bool) -> Option<Value> {
    let raw = fs::read_to_string(path).ok()?;
    if jsonl {
        Some(Value::Array(
            raw.lines()
                .filter(|line| !line.trim().is_empty())
                .filter_map(|line| serde_json::from_str(line).ok())
                .collect(),
        ))
    } else {
        serde_json::from_str(&raw).ok()
    }
}

fn load(path: &Path, jsonl: bool) -> Option<Arc<Value>> {
    let meta = fs::metadata(path).ok().filter(|meta| meta.is_file())?;
    let (len, modified) = (meta.len(), meta.modified().ok());
    let mut guard = CACHE.lock().ok()?;
    let (entries, clock) = guard.get_or_insert_with(|| (HashMap::new(), 0));
    *clock += 1;
    if let Some(entry) = entries.get_mut(path) {
        if entry.len == len && entry.modified == modified {
            entry.used = *clock;
            return Some(entry.value.clone());
        }
    }
    drop(guard);
    let value = Arc::new(parse_file(path, jsonl)?);
    let mut guard = CACHE.lock().ok()?;
    let (entries, clock) = guard.get_or_insert_with(|| (HashMap::new(), 0));
    entries.insert(path.to_path_buf(), CacheEntry { len, modified, value: value.clone(), used: *clock });
    while entries.values().map(|entry| entry.len).sum::<u64>() > CACHE_BUDGET_BYTES && entries.len() > 1 {
        let oldest = entries.iter().min_by_key(|(_, entry)| entry.used).map(|(path, _)| path.clone());
        if let Some(oldest) = oldest {
            entries.remove(&oldest);
        }
    }
    Some(value)
}

fn glob_matches(name: &str, glob: &str) -> bool {
    let (prefix, suffix) = glob.split_once('*').unwrap_or((glob, ""));
    name.len() >= prefix.len() + suffix.len() && name.starts_with(prefix) && name.ends_with(suffix)
}

/// 取出数据集的原始记录；文件不在时返回 None（available=false）。
fn load_rows(spec: &DatasetSpec, roots: &JobDataRoots) -> Option<Vec<Value>> {
    let root = roots.root(&spec.source.root);
    match spec.source.kind.as_str() {
        "page_rows" => {
            let glob = spec.source.glob.as_deref().unwrap_or("*");
            let mut paths: Vec<PathBuf> = fs::read_dir(root)
                .ok()?
                .filter_map(Result::ok)
                .map(|entry| entry.path())
                .filter(|path| path.file_name().and_then(|name| name.to_str()).is_some_and(|name| glob_matches(name, glob)))
                .collect();
            if paths.is_empty() {
                return None;
            }
            paths.sort();
            Some(
                paths
                    .iter()
                    .filter_map(|path| load(path, false))
                    .flat_map(|value| value.as_array().cloned().unwrap_or_default())
                    .collect(),
            )
        }
        "jsonl" => load(&root.join(spec.source.file.as_deref()?), true)
            .map(|value| value.as_array().cloned().unwrap_or_default()),
        "json_rows" => {
            let value = load(&root.join(spec.source.file.as_deref()?), false)?;
            Some(
                value
                    .pointer(spec.source.rows.as_deref().unwrap_or(""))
                    .and_then(Value::as_array)
                    .cloned()
                    .unwrap_or_default(),
            )
        }
        _ => {
            let value = load(&root.join(spec.source.file.as_deref()?), false)?;
            value.is_object().then(|| vec![(*value).clone()])
        }
    }
}

// ---------------------------------------------------------------- 字段

fn at_path<'a>(row: &'a Value, path: &str) -> Option<&'a Value> {
    if path == "$" {
        return Some(row);
    }
    path.split('.').try_fold(row, |value, key| value.get(key))
}

/// 阅读页的块编号：`p001-b2` / `p001-b002` → `p001-b0002`（与 reader_regions 同一规则）。
pub fn reader_item_id(value: &str) -> String {
    match value.split_once("-b") {
        Some((page, block)) => match block.parse::<u32>() {
            Ok(number) => format!("{page}-b{number:04}"),
            Err(_) => value.to_string(),
        },
        None => value.to_string(),
    }
}

fn page_of_item(item_id: &str) -> Option<u64> {
    item_id.strip_prefix('p')?.split('-').next()?.parse().ok()
}

/// 公共字段：item_id、reader_item_id、page。
fn identity(spec: &DatasetSpec, row: &Value) -> Map<String, Value> {
    let mut out = Map::new();
    let item_id = spec
        .identity
        .item_id
        .as_deref()
        .and_then(|path| at_path(row, path))
        .and_then(Value::as_str)
        .filter(|value| !value.is_empty())
        .map(str::to_string);
    let page = spec
        .identity
        .page
        .as_deref()
        .and_then(|path| at_path(row, path))
        .and_then(Value::as_u64)
        .or_else(|| {
            spec.identity
                .page_index
                .as_deref()
                .and_then(|path| at_path(row, path))
                .and_then(Value::as_u64)
                .map(|index| index + 1)
        })
        .or_else(|| item_id.as_deref().and_then(page_of_item));
    if let Some(item_id) = item_id {
        out.insert("reader_item_id".into(), Value::String(reader_item_id(&item_id)));
        out.insert("item_id".into(), Value::String(item_id));
    }
    if let Some(page) = page {
        out.insert("page".into(), Value::from(page));
    }
    out
}

fn field_value(spec: &DatasetSpec, row: &Value, ident: &Map<String, Value>, name: &str) -> Value {
    if IDENTITY_FIELDS.contains(&name) {
        return ident.get(name).cloned().unwrap_or(Value::Null);
    }
    spec.fields
        .get(name)
        .and_then(|field| at_path(row, field.path(name)))
        .cloned()
        .unwrap_or(Value::Null)
}

fn field_kind<'a>(spec: &'a DatasetSpec, name: &str) -> Option<&'a str> {
    match name {
        "page" => Some("integer"),
        "item_id" | "reader_item_id" => Some("string"),
        _ => spec.fields.get(name).map(|field| field.kind.as_str()),
    }
}

fn filterable(spec: &DatasetSpec, name: &str) -> bool {
    IDENTITY_FIELDS.contains(&name) || spec.fields.get(name).is_some_and(|field| field.filter)
}

// ---------------------------------------------------------------- 查询

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct JobDataFieldInfo {
    pub name: String,
    #[serde(rename = "type")]
    pub kind: String,
    pub filter: bool,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct JobDataDatasetInfo {
    pub name: String,
    pub kind: &'static str,
    pub description: String,
    pub available: bool,
    pub fields: Vec<JobDataFieldInfo>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct JobDataCatalogView {
    pub job_id: String,
    pub datasets: Vec<JobDataDatasetInfo>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct JobDataGroup {
    pub value: Value,
    pub count: u64,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct JobDataView {
    pub job_id: String,
    pub dataset: String,
    pub kind: &'static str,
    pub available: bool,
    pub total: u64,
    pub offset: usize,
    pub limit: usize,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rows: Option<Vec<Map<String, Value>>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub groups: Option<Vec<JobDataGroup>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub object: Option<Map<String, Value>>,
}

fn source_available(spec: &DatasetSpec, roots: &JobDataRoots) -> bool {
    let root = roots.root(&spec.source.root);
    match spec.source.kind.as_str() {
        "page_rows" => {
            let glob = spec.source.glob.as_deref().unwrap_or("*");
            fs::read_dir(root).is_ok_and(|entries| {
                entries
                    .filter_map(Result::ok)
                    .any(|entry| entry.file_name().to_str().is_some_and(|name| glob_matches(name, glob)))
            })
        }
        _ => spec.source.file.as_deref().is_some_and(|file| root.join(file).is_file()),
    }
}

pub fn catalog(job_id: &str, roots: &JobDataRoots) -> JobDataCatalogView {
    JobDataCatalogView {
        job_id: job_id.to_string(),
        datasets: registry()
            .iter()
            .map(|(name, spec)| {
                let mut fields: Vec<JobDataFieldInfo> = Vec::new();
                if is_rows(spec) {
                    for (identity_name, description) in [
                        ("item_id", "译文条目编号（三位），改译文、看修订历史用"),
                        ("reader_item_id", "阅读页块编号（四位），跳转、取框用"),
                        ("page", "页码（1 起）"),
                    ] {
                        fields.push(JobDataFieldInfo {
                            name: identity_name.into(),
                            kind: field_kind(spec, identity_name).unwrap_or("string").into(),
                            filter: true,
                            description: description.into(),
                        });
                    }
                }
                fields.extend(spec.fields.iter().map(|(field, field_spec)| JobDataFieldInfo {
                    name: field.clone(),
                    kind: field_spec.kind.clone(),
                    filter: field_spec.filter,
                    description: field_spec.description.clone(),
                }));
                JobDataDatasetInfo {
                    name: name.clone(),
                    kind: if is_rows(spec) { "rows" } else { "object" },
                    description: spec.description.clone(),
                    available: source_available(spec, roots),
                    fields,
                }
            })
            .collect(),
    }
}

fn bad(message: String) -> AppError {
    AppError::bad_request(message)
}

/// 一个筛选值是否命中。
fn matches_value(kind: &str, name: &str, actual: &Value, wanted: &str) -> bool {
    match kind {
        "integer" | "number" => match (actual.as_f64(), wanted.parse::<f64>()) {
            (Some(actual), Ok(wanted)) => (actual - wanted).abs() < 1e-9,
            _ => false,
        },
        "boolean" => actual.as_bool() == Some(wanted == "true"),
        _ => match actual.as_str() {
            // 块编号三位、四位两种写法都认。
            Some(actual) if name == "item_id" || name == "reader_item_id" => {
                reader_item_id(actual) == reader_item_id(wanted)
            }
            Some(actual) => actual == wanted,
            None => false,
        },
    }
}

fn compare(a: &Value, b: &Value) -> std::cmp::Ordering {
    use std::cmp::Ordering;
    match (a, b) {
        (Value::Null, Value::Null) => Ordering::Equal,
        (Value::Null, _) => Ordering::Greater,
        (_, Value::Null) => Ordering::Less,
        (Value::Number(a), Value::Number(b)) => a.as_f64().partial_cmp(&b.as_f64()).unwrap_or(Ordering::Equal),
        (Value::String(a), Value::String(b)) => a.cmp(b),
        (Value::Bool(a), Value::Bool(b)) => a.cmp(b),
        (a, b) => a.to_string().cmp(&b.to_string()),
    }
}

/// `params` 是请求的查询参数（键 → 值）；保留字之外的都是等值筛选。
pub fn query(
    job_id: &str,
    dataset: &str,
    roots: &JobDataRoots,
    params: &HashMap<String, String>,
) -> Result<JobDataView, AppError> {
    let spec = registry()
        .get(dataset)
        .ok_or_else(|| AppError::not_found(format!("unknown dataset: {dataset}")))?;
    let kind = if is_rows(spec) { "rows" } else { "object" };

    let known = |name: &str| (is_rows(spec) && IDENTITY_FIELDS.contains(&name)) || spec.fields.contains_key(name);
    let fields: Vec<String> = match params.get("fields").map(|value| value.trim()).filter(|value| !value.is_empty()) {
        Some(raw) => {
            let fields: Vec<String> = raw.split(',').map(|field| field.trim().to_string()).filter(|f| !f.is_empty()).collect();
            if let Some(unknown) = fields.iter().find(|field| !known(field)) {
                return Err(bad(format!("{dataset} has no field `{unknown}`")));
            }
            fields
        }
        None => spec.fields.keys().cloned().collect(),
    };
    let offset = match params.get("offset") {
        Some(raw) => raw.parse::<usize>().map_err(|_| bad("offset must be a non-negative integer".into()))?,
        None => 0,
    };
    let limit = match params.get("limit") {
        Some(raw) => raw.parse::<usize>().map_err(|_| bad("limit must be an integer".into()))?,
        None => DEFAULT_LIMIT,
    };
    if limit == 0 || limit > MAX_LIMIT {
        return Err(bad(format!("limit must be 1..={MAX_LIMIT}")));
    }
    let mut filters: Vec<(String, Vec<String>)> = Vec::new();
    for (name, raw) in params {
        if RESERVED_PARAMS.contains(&name.as_str()) {
            continue;
        }
        if !known(name) {
            return Err(bad(format!("{dataset} has no field `{name}`")));
        }
        if !filterable(spec, name) {
            return Err(bad(format!("{dataset}.{name} cannot be used as a filter")));
        }
        let kind = field_kind(spec, name).unwrap_or("string");
        let values: Vec<String> = raw.split(',').map(|value| value.trim().to_string()).collect();
        for value in &values {
            let ok = match kind {
                "integer" | "number" => value.parse::<f64>().is_ok(),
                "boolean" => value == "true" || value == "false",
                _ => true,
            };
            if !ok {
                return Err(bad(format!("{dataset}.{name} expects {kind}, got `{value}`")));
            }
        }
        filters.push((name.clone(), values));
    }
    let group_by = params.get("group_by").map(|value| value.trim().to_string()).filter(|value| !value.is_empty());
    if let Some(field) = group_by.as_deref() {
        if !filterable(spec, field) || !known(field) {
            return Err(bad(format!("{dataset}.{field} cannot be used for group_by")));
        }
    }
    let sort = params.get("sort").map(|value| value.trim().to_string()).filter(|value| !value.is_empty());
    if let Some(field) = sort.as_deref() {
        if !known(field.trim_start_matches('-')) {
            return Err(bad(format!("{dataset} has no field `{}`", field.trim_start_matches('-'))));
        }
    }

    let Some(raw_rows) = load_rows(spec, roots) else {
        return Ok(JobDataView {
            job_id: job_id.to_string(),
            dataset: dataset.to_string(),
            kind,
            available: false,
            total: 0,
            offset,
            limit,
            rows: is_rows(spec).then(Vec::new),
            groups: group_by.as_ref().map(|_| Vec::new()),
            object: None,
        });
    };

    if !is_rows(spec) {
        let row = raw_rows.first().cloned().unwrap_or(Value::Null);
        let ident = Map::new();
        let object = fields.iter().map(|name| (name.clone(), field_value(spec, &row, &ident, name))).collect();
        return Ok(JobDataView {
            job_id: job_id.to_string(),
            dataset: dataset.to_string(),
            kind,
            available: true,
            total: 1,
            offset: 0,
            limit,
            rows: None,
            groups: None,
            object: Some(object),
        });
    }

    let mut selected: Vec<(Value, Map<String, Value>)> = raw_rows
        .into_iter()
        .map(|row| {
            let ident = identity(spec, &row);
            (row, ident)
        })
        .filter(|(row, ident)| {
            filters.iter().all(|(name, wanted)| {
                let kind = field_kind(spec, name).unwrap_or("string");
                let actual = field_value(spec, row, ident, name);
                wanted.iter().any(|value| matches_value(kind, name, &actual, value))
            })
        })
        .collect();
    let total = selected.len() as u64;

    if let Some(field) = group_by {
        let mut counts: Vec<(Value, u64)> = Vec::new();
        let mut index: HashMap<String, usize> = HashMap::new();
        for (row, ident) in &selected {
            let value = field_value(spec, row, ident, &field);
            let key = value.to_string();
            match index.get(&key) {
                Some(&position) => counts[position].1 += 1,
                None => {
                    index.insert(key, counts.len());
                    counts.push((value, 1));
                }
            }
        }
        counts.sort_by(|a, b| b.1.cmp(&a.1).then_with(|| compare(&a.0, &b.0)));
        let groups = counts
            .into_iter()
            .skip(offset)
            .take(limit)
            .map(|(value, count)| JobDataGroup { value, count })
            .collect();
        return Ok(JobDataView {
            job_id: job_id.to_string(),
            dataset: dataset.to_string(),
            kind,
            available: true,
            total,
            offset,
            limit,
            rows: None,
            groups: Some(groups),
            object: None,
        });
    }

    if let Some(field) = sort {
        let descending = field.starts_with('-');
        let name = field.trim_start_matches('-').to_string();
        selected.sort_by(|(a_row, a_ident), (b_row, b_ident)| {
            let ordering = compare(&field_value(spec, a_row, a_ident, &name), &field_value(spec, b_row, b_ident, &name));
            if descending { ordering.reverse() } else { ordering }
        });
    }

    let rows = selected
        .into_iter()
        .skip(offset)
        .take(limit)
        .map(|(row, ident)| {
            let mut out = ident.clone();
            for name in &fields {
                if !IDENTITY_FIELDS.contains(&name.as_str()) {
                    out.insert(name.clone(), field_value(spec, &row, &ident, name));
                }
            }
            out
        })
        .collect();
    Ok(JobDataView {
        job_id: job_id.to_string(),
        dataset: dataset.to_string(),
        kind,
        available: true,
        total,
        offset,
        limit,
        rows: Some(rows),
        groups: None,
        object: None,
    })
}

#[cfg(test)]
mod tests;
