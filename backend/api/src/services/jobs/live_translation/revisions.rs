//! 把已写回的译文修订登记进实时译文读模型(并在登记完成后清理旧快照)。
//!
//! Python(`translation-revise`)持锁原子改写页文件与 checkpoint,并在
//! `revisions.v1.jsonl` 里记下每次修订后的页哈希。这里以 checkpoint 为准对账:
//! checkpoint 里某页的 page_hash 出现在修订日志里(证明它来自修订,而不是一次没
//! 登记完的 worker 提交),就把它登记进数据库(`Db::publish_translation_revision`)。
//!
//! 对账是幂等、单调的,所以既是写回成功后的正常路径,也是自愈路径:写回成功但登记
//! 失败时,下一次修订(包括重发同一请求,得到 `changed=false`)或下一次打开实时译文
//! (读版面时)会补上。
//!
//! 只读文件、不持 Python 的 checkpoint 锁:读到的 checkpoint 与页文件、快照对不上
//! (另一次修订正在写)的页直接跳过,由那次修订自己的对账登记。

use std::collections::{BTreeSet, HashMap};
use std::fs;
use std::path::{Path, PathBuf};

use serde_json::Value;

use crate::db::{Db, RevisedPagePublication, RevisedPageStatus, RevisedTranslationPage};
use crate::error::AppError;
use crate::models::api::{TranslationRevisionLivePageView, TranslationRevisionLivePublicationView};

use super::{sha256_hex, CHECKPOINTS_DIR, TRANSLATION_STAGE};

const CHECKPOINT_FILE_NAME: &str = "translation-checkpoint.v1.json";
const REVISIONS_FILE_NAME: &str = "revisions.v1.jsonl";

/// 修订日志里与某一页有关的一条记录。
struct PageRevision {
    page_hash: String,
    generation: u64,
    item_id: String,
    revision_id: String,
}

struct CheckpointPage {
    page_index: u32,
    file_name: String,
    page_hash: String,
    unit_key: String,
    unit_order: u64,
}

struct CommittedCheckpoint {
    generation: u64,
    pages: Vec<CheckpointPage>,
}

/// 对账一次。没有修订日志(从没修订过)时返回 `None`,什么都不读。
pub(crate) fn publish_translation_revisions(
    db: &Db,
    job_id: &str,
    translations_dir: &Path,
) -> Result<Option<Vec<RevisedPagePublication>>, AppError> {
    let journal = translations_dir.join(REVISIONS_FILE_NAME);
    let Some(revisions) = read_revision_journal(&journal)? else {
        return Ok(None);
    };
    let Some(checkpoint) = read_committed_checkpoint(translations_dir)? else {
        return Ok(Some(Vec::new()));
    };
    let snapshot_dir = translations_dir
        .join(CHECKPOINTS_DIR)
        .join(format!("generation-{}", checkpoint.generation));
    let mut pages = Vec::new();
    let mut current = Vec::new();
    for page in &checkpoint.pages {
        let Some(records) = revisions.get(&page.file_name) else {
            continue;
        };
        if !records.iter().any(|record| record.page_hash == page.page_hash) {
            continue;
        }
        // 页文件和快照都得是这一版:读模型从快照取文本,渲染从页文件取。
        if !file_has_hash(&translations_dir.join(&page.file_name), &page.page_hash)
            || !file_has_hash(&snapshot_dir.join(&page.file_name), &page.page_hash)
        {
            continue;
        }
        // 动画提示用:数据库里登记的那一版之后的修订改过哪些块。
        let registered_unit =
            db.latest_pipeline_unit_for_page(job_id, TRANSLATION_STAGE, page.page_index)?;
        // 已登记的页不进写事务:读取时对账多数情况下什么都不用做,不该每次都拿写锁。
        if let Some(unit) = registered_unit
            .as_ref()
            .filter(|unit| unit.page_hash == page.page_hash)
        {
            current.push(RevisedPagePublication {
                page_index: page.page_index,
                page_hash: page.page_hash.clone(),
                status: RevisedPageStatus::Current,
                attempt: Some(unit.attempt),
                generation: Some(unit.generation),
            });
            continue;
        }
        let registered = registered_unit
            .and_then(|unit| unit.producer_generation)
            .unwrap_or(0);
        let mut changed_item_ids = BTreeSet::new();
        let mut revision_ids = Vec::new();
        for record in records
            .iter()
            .filter(|record| record.generation > registered && record.generation <= checkpoint.generation)
        {
            changed_item_ids.insert(record.item_id.clone());
            revision_ids.push(record.revision_id.clone());
        }
        pages.push(RevisedTranslationPage {
            page_index: page.page_index,
            page_hash: page.page_hash.clone(),
            producer_generation: checkpoint.generation,
            unit_key: page.unit_key.clone(),
            unit_order: page.unit_order,
            changed_item_ids: changed_item_ids.into_iter().collect(),
            revision_ids,
        });
    }
    let mut results = if pages.is_empty() {
        Vec::new()
    } else {
        db.publish_translation_revision(job_id, &pages)?
    };
    results.extend(current);
    results.sort_by_key(|page| page.page_index);
    Ok(Some(results))
}

/// 登记完成后清掉不再被引用的旧 generation 快照。
///
/// 只在「每一页数据库里生效的 page_hash 都等于 checkpoint 的 page_hash」时才清:
/// 此时读模型要的每一版都在当前 generation 的快照目录里(快照目录总是包含全部页)。
/// 只删编号**小于**当前 generation 的目录——更大的可能是另一次修订正在建的。
/// 任务有 running attempt 时不清(worker 正在管这些目录)。
pub(crate) fn prune_superseded_revision_snapshots(
    db: &Db,
    job_id: &str,
    translations_dir: &Path,
) -> Result<usize, AppError> {
    if db.has_running_pipeline_attempt(job_id)? {
        return Ok(0);
    }
    let Some(checkpoint) = read_committed_checkpoint(translations_dir)? else {
        return Ok(0);
    };
    let current_dir = translations_dir
        .join(CHECKPOINTS_DIR)
        .join(format!("generation-{}", checkpoint.generation));
    for page in &checkpoint.pages {
        let registered = db.latest_pipeline_unit_for_page(job_id, TRANSLATION_STAGE, page.page_index)?;
        let Some(unit) = registered else {
            continue;
        };
        if unit.page_hash != page.page_hash
            || !file_has_hash(&current_dir.join(&page.file_name), &page.page_hash)
        {
            return Ok(0);
        }
    }
    let mut removed = 0;
    for (generation, path) in snapshot_generations(&translations_dir.join(CHECKPOINTS_DIR)) {
        if generation < checkpoint.generation {
            fs::remove_dir_all(&path)?;
            removed += 1;
        }
    }
    Ok(removed)
}

/// 把逐页结果折成接口里的 `live_publication`。
pub(crate) fn live_publication_view(
    result: Result<Option<Vec<RevisedPagePublication>>, AppError>,
) -> TranslationRevisionLivePublicationView {
    let pages = match result {
        Ok(pages) => pages.unwrap_or_default(),
        Err(error) => {
            return TranslationRevisionLivePublicationView {
                status: "failed".to_string(),
                pages: Vec::new(),
                error: Some(error.to_string()),
            }
        }
    };
    let has = |status| pages.iter().any(|page| page.status == status);
    let status = if has(RevisedPageStatus::Published) {
        "published"
    } else if has(RevisedPageStatus::RunningAttempt) {
        "pending"
    } else if has(RevisedPageStatus::NoDurableAttempt) {
        "unavailable"
    } else {
        "current"
    };
    TranslationRevisionLivePublicationView {
        status: status.to_string(),
        pages: pages
            .into_iter()
            .map(|page| TranslationRevisionLivePageView {
                page_idx: page.page_index,
                page_hash: page.page_hash,
                status: page_status(page.status).to_string(),
                attempt: page.attempt,
                generation: page.generation,
            })
            .collect(),
        error: None,
    }
}

fn page_status(status: RevisedPageStatus) -> &'static str {
    match status {
        RevisedPageStatus::Published => "published",
        RevisedPageStatus::Current => "current",
        RevisedPageStatus::Superseded => "superseded",
        RevisedPageStatus::RunningAttempt => "running_attempt",
        RevisedPageStatus::NoDurableAttempt => "no_durable_attempt",
    }
}

fn read_revision_journal(path: &Path) -> Result<Option<HashMap<String, Vec<PageRevision>>>, AppError> {
    let text = match fs::read_to_string(path) {
        Ok(text) => text,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(error.into()),
    };
    let mut by_page: HashMap<String, Vec<PageRevision>> = HashMap::new();
    for line in text.lines().filter(|line| !line.trim().is_empty()) {
        // 半行(进程在追加时被杀)不影响其余记录;日志本身是先写临时文件再 rename,
        // 正常不会出现。
        let Ok(record) = serde_json::from_str::<Value>(line) else {
            continue;
        };
        let (Some(generation), Some(hashes)) = (
            record.get("generation").and_then(Value::as_u64),
            record.get("page_hashes").and_then(Value::as_object),
        ) else {
            continue;
        };
        let text_field = |key: &str| {
            record
                .get(key)
                .and_then(Value::as_str)
                .unwrap_or_default()
                .to_string()
        };
        for (file_name, hash) in hashes {
            let Some(hash) = hash.as_str() else {
                continue;
            };
            by_page.entry(file_name.clone()).or_default().push(PageRevision {
                page_hash: hash.to_string(),
                generation,
                item_id: text_field("item_id"),
                revision_id: text_field("revision_id"),
            });
        }
    }
    Ok(Some(by_page))
}

/// 已提交(complete/committed)的 checkpoint;没有或还在翻译中时返回 `None`。
fn read_committed_checkpoint(translations_dir: &Path) -> Result<Option<CommittedCheckpoint>, AppError> {
    let bytes = match fs::read(translations_dir.join(CHECKPOINT_FILE_NAME)) {
        Ok(bytes) => bytes,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(error.into()),
    };
    let checkpoint: Value = serde_json::from_slice(&bytes)
        .map_err(|err| AppError::internal(format!("parse translation checkpoint: {err}")))?;
    if checkpoint.get("status").and_then(Value::as_str) != Some("complete")
        || checkpoint.get("phase").and_then(Value::as_str) != Some("committed")
    {
        return Ok(None);
    }
    let Some(generation) = checkpoint.get("generation").and_then(Value::as_u64) else {
        return Ok(None);
    };
    let pages = checkpoint
        .get("pages")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(|page| {
            let page_index = u32::try_from(page.get("page_index")?.as_u64()?).ok()?;
            let file_name = page.get("path")?.as_str()?;
            let file_name = Path::new(file_name).file_name()?.to_str()?.to_string();
            if !file_name.starts_with("page-") || !file_name.ends_with(".json") {
                return None;
            }
            let page_hash = page.get("page_hash")?.as_str()?.to_string();
            if page_hash.len() != 64 {
                return None;
            }
            // 新建行时沿用 worker 的 unit 身份(`page:N` / 页序),与它日后的提交一致。
            let last = page.get("last_committed_unit");
            let unit_key = last
                .and_then(|unit| unit.get("unit_key"))
                .and_then(Value::as_str)
                .map(str::to_string)
                .unwrap_or_else(|| format!("page:{page_index}"));
            let unit_order = last
                .and_then(|unit| unit.get("unit_order"))
                .and_then(Value::as_u64)
                .unwrap_or(page_index as u64);
            Some(CheckpointPage {
                page_index,
                file_name,
                page_hash,
                unit_key,
                unit_order,
            })
        })
        .collect();
    Ok(Some(CommittedCheckpoint { generation, pages }))
}

fn file_has_hash(path: &Path, expected: &str) -> bool {
    fs::symlink_metadata(path).is_ok_and(|meta| meta.is_file())
        && fs::read(path).is_ok_and(|bytes| sha256_hex(&bytes) == expected)
}

fn snapshot_generations(root: &Path) -> Vec<(u64, PathBuf)> {
    fs::read_dir(root)
        .into_iter()
        .flatten()
        .filter_map(Result::ok)
        .filter_map(|entry| {
            let file_type = entry.file_type().ok()?;
            if !file_type.is_dir() || file_type.is_symlink() {
                return None;
            }
            let generation = entry
                .file_name()
                .to_str()?
                .strip_prefix("generation-")?
                .parse()
                .ok()?;
            Some((generation, entry.path()))
        })
        .collect()
}
