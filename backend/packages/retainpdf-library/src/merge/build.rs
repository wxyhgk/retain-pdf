//! 合并译文：同一本书的多个范围任务合成一个整本长度、「长得和普通任务一样」的目录。
//!
//! 计划由 `plan::merge_plan` 算，各任务的产物路径由 `sources` 读出。产物分两半，各交给一个 Python 子命令：
//!
//! - `merge-translated-artifacts`：译文 JSON + manifest、OCR 规范化文档、图片，页号改写成
//!   文档页号。阅读器选区、Word 导出、AI 问答、全文搜索读的是这些。
//! - `merge-translated-pdf`：以源 PDF 为底本「移植」译文页。看 PDF 的出口读这个。
//!
//! 这里只管缓存键、调子进程、原子发布。
//!
//! # 缓存：按内容指纹命名的不可变目录
//!
//! 产物是 `data/documents/<doc>/merged/<指纹前 16 位>/`，**目录存在即完整且新鲜**：先在
//! 同级的临时目录里生成，两半都成功后才整体 rename 过去。
//!
//! 不能沿用 `cached_output_is_fresh` 的 mtime 比较：删掉一个较新的任务后，剩下所有输入
//! 都比产物旧，它会继续返回包含已删任务的旧合并结果；改了拼接代码也不会失效。指纹里
//! 放的是「这次合并由什么决定」—— 合并器版本、源 PDF、每页取自哪个任务的哪一页、每个
//! 被引用任务的输出 PDF / 译文 manifest / 译文断点 / OCR 文档的大小和修改时间、OCR 页号表。
//! 任何一项变了就是一个新目录。断点是为手改译文加的（2026-11-26，S34）：手改只换页文件和断点。
//!
//! 目录名不可变还有一个好处：用户正在下载旧的合并结果时，新的合并不会把它从脚下替换掉
//! （断点续传不会拼出半新半旧的 PDF）。旧目录在新目录发布后按**最后一次被读**的时间清理
//! （`prune_stale`）：每次按虚拟 id 读合并目录都会更新目录里的 `.last-used` 标记。
//!
//! # 同一份合并只生成一次
//!
//! 同一本书同时打开两次（前端一次、AI 服务一次），以前各自在临时目录里生成一遍、后发布的
//! 丢掉自己的结果；几本书同时打开时子进程数也没有上限。现在按合并目录（指纹）单飞：同一个
//! 指纹同时只有一个在生成，后到的等它做完直接用；全进程同时最多 [`MAX_CONCURRENT_BUILDS`]
//! 个在生成，多的排队。不用文件出口的 `DownloadGeneration`：它是异步的、结果类型是要回给
//! 客户端的文件，而且 2 个名额和文件下载共用（一次合并最多两步各 120 秒，会把下载堵住）；
//! 合集工作区在阻塞线程里同步调这里，也要去重。

use std::collections::{BTreeMap, HashSet};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::{Condvar, Mutex, OnceLock};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use sha2::{Digest, Sha256};

use retainpdf_api_base::error::AppError;
use retainpdf_api_base::job_loading::{mark_merged_used, merged_last_used, MergedTranslation};
use retainpdf_core::storage_paths::{TRANSLATION_CHECKPOINT_FILE_NAME, TRANSLATION_MANIFEST_FILE_NAME};
use retainpdf_files::{document_artifacts_dir, DerivedArtifactDeps};

use super::plan::PageSource;
use super::sources::BuildInputs;

/// 拼接器的行为一变就加一。它进了指纹，旧缓存自动作废 —— Word 导出就吃过「改了代码、
/// 缓存不认」的亏（`word.rs` 的 `RENDERER_VERSION`）。
const MERGE_VERSION: u32 = 3;

/// 50 页 4 个来源交错实测 0.5 秒；留足余量给大书和慢盘。
const BUILD_TIMEOUT: Duration = Duration::from_secs(120);

fn file_stamp(path: &Path) -> Result<String, AppError> {
    let meta = std::fs::metadata(path)?;
    let modified = meta
        .modified()
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|elapsed| elapsed.as_nanos())
        .unwrap_or(0);
    Ok(format!("{}|{}|{}", path.display(), meta.len(), modified))
}

/// 每个任务去哪读产物，按 job_id 索引。
pub(crate) type JobInputs = BTreeMap<String, BuildInputs>;

/// 计划里引用到的任务 → 它的产物路径。计划引用了不存在的任务就是调用方的 bug。
fn referenced_jobs<'a>(
    plan: &[PageSource],
    jobs: &'a JobInputs,
) -> Result<BTreeMap<&'a str, &'a BuildInputs>, AppError> {
    let mut referenced = BTreeMap::new();
    for source in plan {
        if let PageSource::Job { job_id, .. } = source {
            let (id, inputs) = jobs.get_key_value(job_id).ok_or_else(|| {
                AppError::internal(format!("merge plan references unknown job {job_id}"))
            })?;
            referenced.insert(id.as_str(), inputs);
        }
    }
    Ok(referenced)
}

pub(crate) fn merge_fingerprint(
    source_pdf: &Path,
    plan: &[PageSource],
    jobs: &JobInputs,
) -> Result<String, AppError> {
    let mut hasher = Sha256::new();
    hasher.update(format!("v{MERGE_VERSION}\n"));
    hasher.update(format!("source {}\n", file_stamp(source_pdf)?));
    for source in plan {
        match source {
            PageSource::Original => hasher.update("page original\n"),
            PageSource::Job { job_id, local_index } => {
                hasher.update(format!("page {job_id}#{local_index}\n"))
            }
        }
    }
    for (job_id, inputs) in referenced_jobs(plan, jobs)? {
        hasher.update(format!("job {job_id} {}\n", file_stamp(&inputs.output_pdf)?));
        hasher.update(format!("  ocr {:?}\n", inputs.ocr_page_numbers));
        let manifest = inputs
            .translations_dir
            .as_ref()
            .map(|dir| dir.join(TRANSLATION_MANIFEST_FILE_NAME));
        // 手改译文（`translation-revise`）只改页文件和断点、不动 manifest 和 PDF（S34）。断点每次提交都
        // 原子换掉（generation 加一），只取它的文件戳（不读页文件、不解析几 MB 的断点 JSON）就知道译文变没变。
        let checkpoint = inputs
            .translations_dir
            .as_ref()
            .map(|dir| dir.join(TRANSLATION_CHECKPOINT_FILE_NAME));
        for (label, path) in [
            ("manifest", manifest.as_deref()),
            ("checkpoint", checkpoint.as_deref()),
            ("document", inputs.normalized_document.as_deref()),
        ] {
            match path.filter(|path| path.is_file()) {
                Some(path) => hasher.update(format!("  {label} {}\n", file_stamp(path)?)),
                None => hasher.update(format!("  {label} none\n")),
            }
        }
    }
    Ok(hasher
        .finalize()
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect())
}

/// 交给 Python 的计划：`{"pages": [null | {"pdf": 绝对路径, "index": n}, …]}`。
fn plan_json(plan: &[PageSource], jobs: &JobInputs) -> Result<String, AppError> {
    let referenced = referenced_jobs(plan, jobs)?;
    let pages: Vec<serde_json::Value> = plan
        .iter()
        .map(|source| match source {
            PageSource::Original => serde_json::Value::Null,
            PageSource::Job { job_id, local_index } => serde_json::json!({
                "pdf": referenced[job_id.as_str()].output_pdf,
                "index": local_index,
            }),
        })
        .collect();
    Ok(serde_json::json!({ "pages": pages }).to_string())
}

/// 交给 `merge-translated-artifacts` 的计划。
fn artifacts_plan_json(
    source_pdf: &Path,
    plan: &[PageSource],
    jobs: &JobInputs,
) -> Result<String, AppError> {
    let referenced = referenced_jobs(plan, jobs)?;
    let mut job_specs = serde_json::Map::new();
    for (job_id, inputs) in &referenced {
        let translations_dir = inputs.translations_dir.as_ref().ok_or_else(|| {
            AppError::internal(format!("job {job_id} has no translations dir to merge"))
        })?;
        job_specs.insert(
            job_id.to_string(),
            serde_json::json!({
                "translations_dir": translations_dir,
                "normalized_document": inputs.normalized_document,
                "markdown_images_dir": inputs.markdown_images_dir,
                "ocr_page_numbers": inputs.ocr_page_numbers,
            }),
        );
    }
    let pages: Vec<serde_json::Value> = plan
        .iter()
        .map(|source| match source {
            PageSource::Original => serde_json::Value::Null,
            PageSource::Job { job_id, .. } => serde_json::json!({ "job": job_id }),
        })
        .collect();
    Ok(serde_json::json!({
        "document_page_count": plan.len(),
        "source_pdf": source_pdf,
        "jobs": job_specs,
        "pages": pages,
    })
    .to_string())
}

pub(crate) fn merged_root(
    data_root: &Path,
    document_id: &str,
    fingerprint: &str,
) -> Result<PathBuf, AppError> {
    let dir = document_artifacts_dir(data_root, document_id)?.join("merged");
    std::fs::create_dir_all(&dir)?;
    Ok(dir.join(&fingerprint[..16]))
}

/// 生成失败时整个临时目录一起删掉。
struct BuildingDir(PathBuf);

impl Drop for BuildingDir {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}

fn run_step(
    anchor: &Path,
    label: &str,
    deps: DerivedArtifactDeps<'_>,
    subcommand: &str,
    args: &[&std::ffi::OsStr],
) -> Result<(), AppError> {
    let mut command = std::process::Command::new(deps.pipeline_command);
    command.arg(subcommand).args(args);
    let (status, diagnostics) =
        retainpdf_files::run_supervised(anchor, label, BUILD_TIMEOUT, command)?;
    if !status.success() {
        return Err(diagnostics.error(format!("failed to build {label}")));
    }
    Ok(())
}

/// 全进程同时最多几个合并在生成。一次合并跑两个 Python 子进程。
const MAX_CONCURRENT_BUILDS: usize = 2;

/// 正在生成的合并目录（按目录路径，也就是按书和指纹）。
struct InFlightBuilds {
    building: Mutex<HashSet<PathBuf>>,
    finished: Condvar,
}

fn in_flight_builds() -> &'static InFlightBuilds {
    static BUILDS: OnceLock<InFlightBuilds> = OnceLock::new();
    BUILDS.get_or_init(|| InFlightBuilds { building: Mutex::new(HashSet::new()), finished: Condvar::new() })
}

/// 占着「这个合并目录我在生成」，放手（包括出错、panic）时叫醒等着的。
struct BuildClaim(PathBuf);

impl BuildClaim {
    /// 等到这个目录没人在生成、而且总数没满，再占上。
    fn acquire(root: &Path) -> Self {
        let builds = in_flight_builds();
        let mut building = builds.building.lock().unwrap_or_else(|e| e.into_inner());
        while building.contains(root) || building.len() >= MAX_CONCURRENT_BUILDS {
            building = builds.finished.wait(building).unwrap_or_else(|e| e.into_inner());
        }
        building.insert(root.to_path_buf());
        Self(root.to_path_buf())
    }
}

impl Drop for BuildClaim {
    fn drop(&mut self) {
        let builds = in_flight_builds();
        builds.building.lock().unwrap_or_else(|e| e.into_inner()).remove(&self.0);
        builds.finished.notify_all();
    }
}

/// 拿到（必要时生成）这本书当前的合并译文目录。
pub(crate) fn ensure_merged_translation(
    deps: DerivedArtifactDeps<'_>,
    data_root: &Path,
    document_id: &str,
    source_pdf: &Path,
    plan: &[PageSource],
    jobs: &JobInputs,
) -> Result<MergedTranslation, AppError> {
    let fingerprint = merge_fingerprint(source_pdf, plan, jobs)?;
    let root = merged_root(data_root, document_id, &fingerprint)?;
    if root.is_dir() {
        mark_merged_used(&root, SystemTime::now());
        return Ok(MergedTranslation { root });
    }
    let _claim = BuildClaim::acquire(&root);
    // 等的这段时间里，同一个指纹的另一次请求可能已经生成好了。
    if root.is_dir() {
        mark_merged_used(&root, SystemTime::now());
        return Ok(MergedTranslation { root });
    }
    let parent = root.parent().expect("merged root has a parent");
    let building = BuildingDir(parent.join(format!(
        ".building-{}-{:016x}",
        &fingerprint[..16],
        fastrand::u64(..)
    )));
    std::fs::create_dir(&building.0)?;
    let staged = MergedTranslation { root: building.0.clone() };
    let pdf_plan = building.0.with_extension("pdf-plan.json");
    let artifacts_plan = building.0.with_extension("artifacts-plan.json");
    let result = (|| {
        std::fs::File::create(&artifacts_plan)?
            .write_all(artifacts_plan_json(source_pdf, plan, jobs)?.as_bytes())?;
        run_step(
            &building.0,
            "merged-artifacts",
            deps,
            "merge-translated-artifacts",
            &[
                "--plan".as_ref(),
                artifacts_plan.as_os_str(),
                "--output-dir".as_ref(),
                building.0.as_os_str(),
            ],
        )?;
        std::fs::File::create(&pdf_plan)?.write_all(plan_json(plan, jobs)?.as_bytes())?;
        std::fs::create_dir_all(staged.output_pdf().parent().expect("rendered dir"))?;
        run_step(
            &building.0,
            "merged-pdf",
            deps,
            "merge-translated-pdf",
            &[
                "--source-pdf".as_ref(),
                source_pdf.as_os_str(),
                "--plan".as_ref(),
                pdf_plan.as_os_str(),
                "--output-pdf".as_ref(),
                staged.output_pdf().as_os_str(),
            ],
        )?;
        if !staged.output_pdf().is_file() || !staged.translations_dir().is_dir() {
            return Err(AppError::internal("merged translation is incomplete"));
        }
        Ok::<(), AppError>(())
    })();
    let _ = std::fs::remove_file(&pdf_plan);
    let _ = std::fs::remove_file(&artifacts_plan);
    result?;
    match std::fs::rename(&building.0, &root) {
        Ok(()) => {}
        // 并发的另一次请求先发布了同一个指纹：内容相同，用它的，丢掉自己的。
        Err(_) if root.is_dir() => {}
        Err(error) => return Err(error.into()),
    }
    let now = SystemTime::now();
    mark_merged_used(&root, now);
    prune_stale(parent, &root, now);
    Ok(MergedTranslation { root })
}

/// 旧的合并目录多久没人读就删。不在新目录一发布就删：可能有人正拿着旧的虚拟 id 开着阅读器、
/// 或者正在下载旧的合并 PDF（虚拟 id 带指纹，读的就是那个目录）。年龄从最后一次被读算起
/// （`.last-used` 标记，见 `job_loading::merged_last_used`），不是从生成时算起。
/// 删掉以后旧 id 的读请求是 404 + `merged_reading_expired`，客户端重新问阅读入口。
const STALE_MERGED_AFTER: Duration = Duration::from_secs(24 * 60 * 60);
/// `.building-*` 是生成中的临时目录；进程崩溃会把它留下。生成最多跑两步子进程，各自
/// 有 `BUILD_TIMEOUT`，一小时还在的一定是残骸。
const STALE_BUILDING_AFTER: Duration = Duration::from_secs(60 * 60);

/// 删掉 `merged/` 下除 `keep`（阅读入口现在指向的那个）之外、足够久没人读的合并目录和残留的
/// 临时目录。尽力而为：清理失败不影响这次合并。
fn prune_stale(merged_dir: &Path, keep: &Path, now: SystemTime) {
    let Ok(entries) = std::fs::read_dir(merged_dir) else { return };
    for entry in entries.flatten() {
        let path = entry.path();
        if path == keep || !path.is_dir() {
            continue;
        }
        let name = entry.file_name().to_string_lossy().into_owned();
        let (max_age, last_touched) = if name.starts_with(".building-") {
            (STALE_BUILDING_AFTER, entry.metadata().and_then(|meta| meta.modified()).ok())
        } else if name.len() == 16 && name.bytes().all(|b| b.is_ascii_hexdigit()) {
            (STALE_MERGED_AFTER, merged_last_used(&path))
        } else {
            // 不认识的东西不碰。
            continue;
        };
        let age = last_touched.and_then(|modified| now.duration_since(modified).ok());
        if age.is_some_and(|age| age > max_age) {
            let _ = std::fs::remove_dir_all(&path);
        }
    }
}

#[cfg(test)]
#[path = "build_tests.rs"]
mod tests;
