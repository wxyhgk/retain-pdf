//! 数据库备份与恢复。
//!
//! 备份放在 `<数据目录>/backups/db/`,一份一个文件:`<种类>-<UTC 时刻>-v<结构版本>.db.gz`。
//! 内容是 `VACUUM INTO` 出的完整数据库(一致的快照,不用停服务、不挡别的读写),再 gzip
//! 压缩;先写临时名再改名,半份文件不会被当成备份。种类:
//!
//! - `auto`:后台每天一份(调度在平台包 `retainpdf-platform` 的 `backup`);
//! - `manual`:用户点「立即备份」;
//! - `before-restore`:恢复前把当时的数据库先存一份,恢复错了还能退回;
//! - `before-upgrade`:数据库结构要升级(版本化迁移)之前自动存一份。
//!
//! 保留规则见 [`Db::prune_backups`]。
//!
//! # 恢复
//!
//! 分两步(2026-10-22 起):[`Db::check_backup`] 先解压、检查完整性和版本(比本机程序新的
//! 不恢复),不动正在用的库——调用方在这之后才存「恢复前」备份,坏备份不会挤掉真正的恢复前
//! 备份;[`Db::restore_checked`] 在解开的临时副本上做完换库后要做的事(补结构升级、重置同步
//! 记账并写回恢复前的同步设置、清 pid),换库前再查一次有没有在跑的任务,最后用 SQLite 的
//! 在线备份接口把副本整体写进正在用的数据库:一次写事务完成,别的连接和进程下一次读到的
//! 就是恢复后的内容,不用重启,也不会读到一半新一半旧。换库是最后一步,之前任何一步失败,
//! 正在用的库都不变。[`Db::restore_backup`] 是两步连着做。
//!
//! # 备份里没有的东西
//!
//! WebDAV 密码不进备份(`VACUUM INTO` 出的副本上先删掉再压缩):恢复时本来就保留恢复前的
//! 同步设置,备份里那份用不上,备份目录被拷走时也不会带出去。备份文件只给本机用户读写(0600)。
//!
//! 只恢复数据库,数据目录里的文件(原文、译文、成品)不动:备份之后新加的书文件还在,
//! 只是数据库里没有它;开着同步时会再从同步文件夹收回来。
//!
//! 备份时在排队/运行的任务,恢复出来还是 queued/running,却没有任何 driver(恢复前已确认
//! 当时没有在跑的任务)。恢复时清掉它们备份里的 pid(不属于当前任何进程,不能拿去杀),
//! 再由拥有任务运行时的进程按启动恢复的规则对账:进程内模式恢复后立即一次
//! (`recover_jobs_after_database_restore`),jobsd 模式由 jobsd 的运行期巡检接手。
//!
//! # 恢复中
//!
//! 恢复从检查备份、存恢复前备份到换库要几秒。这期间新建的任务、重跑、上传，落库以后会被换库整个盖掉
//! （上传的文件留在盘上没有记录，任务目录建了却没有行），所以恢复整段拿着 [`Db::begin_restore`] 的写锁，
//! 这些入口先拿 [`Db::hold_off_restore`]：恢复中拿不到就直接拒绝（接口回 409 `restore_in_progress`），
//! 已经在进行的那些做完恢复才开始，换库前那次复查照样挡得住它们建出来的任务（2026-10-28 起）。
//! 只管本进程的入口；jobsd 不建任务。
//!
//! 同步记账按「这台设备带着旧数据重新加入」处理(见 `sync_after_restore`):恢复前的同步
//! 设置保留;本机换一个新设备号,忘掉所有同步记账,不把恢复出来的旧内容当新改动发出去,
//! 再从头读同步文件夹里每台设备(包括本机原来的设备号)的改动——备份之后已经同步出去的
//! 改动都会收回来,旧内容不会盖掉别的设备上更新的内容。

use std::fs;
use std::io::{BufReader, BufWriter, Write};
use std::path::{Path, PathBuf};
use std::time::Duration;

use anyhow::{bail, Context, Result};
use chrono::{DateTime, Datelike, NaiveDateTime, Utc};
use flate2::read::GzDecoder;
use flate2::write::GzEncoder;
use rusqlite::backup::{Backup, StepResult};
use rusqlite::{Connection, OpenFlags};

use super::schema::versioned_migration_count;
use super::sync::sync_after_restore;
use super::Db;

pub const KIND_AUTO: &str = "auto";
pub const KIND_MANUAL: &str = "manual";
pub const KIND_BEFORE_RESTORE: &str = "before-restore";
pub const KIND_BEFORE_UPGRADE: &str = "before-upgrade";
const KINDS: &[&str] = &[KIND_AUTO, KIND_MANUAL, KIND_BEFORE_RESTORE, KIND_BEFORE_UPGRADE];

/// 自动备份:最近这么多份全留;
const KEEP_RECENT_AUTO: usize = 7;
/// 更早的每周留一份,留这么多周。
const KEEP_WEEKLY_AUTO: usize = 4;
const KEEP_MANUAL: usize = 10;
const KEEP_BEFORE_RESTORE: usize = 3;
const KEEP_BEFORE_UPGRADE: usize = 3;

const SUFFIX: &str = ".db.gz";
const STAMP: &str = "%Y%m%dT%H%M%S%3fZ";

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BackupInfo {
    /// 文件名去掉 `.db.gz`。
    pub id: String,
    pub kind: String,
    pub created_at: DateTime<Utc>,
    /// 备份时数据库的结构版本。
    pub schema_version: i64,
    /// 压缩后的大小。
    pub bytes: u64,
}

/// 不能恢复的原因(给用户看)。
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RestoreRefusal {
    NotFound,
    /// 文件坏了(解不开或数据库完整性检查不过)。
    Damaged(String),
    /// 来自更新版本的程序,本机认不全它的结构。
    Newer { backup: i64, supported: i64 },
    /// 换库前又查到有任务在跑等(给用户看的说明)。
    Blocked(Vec<String>),
}

impl std::fmt::Display for RestoreRefusal {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::NotFound => write!(f, "没有这份备份"),
            Self::Damaged(reason) => write!(f, "这份备份已损坏，不能恢复：{reason}"),
            Self::Newer { backup, supported } => write!(
                f,
                "这份备份来自更新版本的程序（数据库版本 {backup}，本机只认到 {supported}），请先升级再恢复"
            ),
            Self::Blocked(blockers) => write!(f, "{}，等它们结束后再恢复", blockers.join("，")),
        }
    }
}

fn parse_name(name: &str) -> Option<(String, DateTime<Utc>, i64)> {
    let stem = name.strip_suffix(SUFFIX)?;
    let (rest, version) = stem.rsplit_once("-v")?;
    let (kind, stamp) = rest.rsplit_once('-')?;
    if !KINDS.contains(&kind) {
        return None;
    }
    let at = NaiveDateTime::parse_from_str(stamp, STAMP).ok()?.and_utc();
    Some((kind.to_string(), at, version.parse().ok()?))
}

fn user_version(conn: &Connection) -> Result<i64> {
    Ok(conn.query_row("PRAGMA user_version", [], |row| row.get(0))?)
}

fn temp_name(dir: &Path, ext: &str) -> PathBuf {
    dir.join(format!(".tmp-{:016x}{ext}", fastrand::u64(..)))
}

/// 新建一个只给本机用户读写的文件(备份里是整个书库)。
fn create_private(path: &Path) -> std::io::Result<fs::File> {
    let mut options = fs::OpenOptions::new();
    options.write(true).create_new(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    options.open(path)
}

/// 不进备份的同步设置(恢复时保留恢复前的同步设置,备份里的用不上)。
const SECRET_SYNC_KEYS: &[&str] = &["webdav_password"];

/// 在 `VACUUM INTO` 出的副本上删掉密码。`secure_delete` 把删掉的内容清零,文件里不留原文。
fn strip_secrets(snapshot: &Path) -> Result<()> {
    let conn = Connection::open_with_flags(snapshot, OpenFlags::SQLITE_OPEN_READ_WRITE)?;
    conn.execute_batch("PRAGMA journal_mode=DELETE; PRAGMA secure_delete=ON;")?;
    let has_sync_state: bool = conn.query_row(
        "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'sync_state')",
        [],
        |row| row.get(0),
    )?;
    if has_sync_state {
        for key in SECRET_SYNC_KEYS {
            conn.execute("DELETE FROM sync_state WHERE key = ?1", [key])?;
        }
    }
    Ok(())
}

/// 把 `conn` 所在的数据库存成一份备份。
fn write_backup(conn: &Connection, dir: &Path, kind: &str) -> Result<BackupInfo> {
    fs::create_dir_all(dir).with_context(|| format!("failed to create {}", dir.display()))?;
    let version = user_version(conn)?;
    let now = Utc::now();
    let id = format!("{kind}-{}-v{version}", now.format(STAMP));
    let snapshot = temp_name(dir, ".db");
    let packed = temp_name(dir, SUFFIX);
    let result = (|| -> Result<u64> {
        // 先建成 0600 的空文件(`VACUUM INTO` 接受空文件),副本从一开始就不给别人读。
        drop(create_private(&snapshot)?);
        conn.execute("VACUUM INTO ?1", [snapshot.to_string_lossy().as_ref()])
            .context("VACUUM INTO failed")?;
        strip_secrets(&snapshot).context("failed to strip secrets from the backup")?;
        let mut input = BufReader::new(fs::File::open(&snapshot)?);
        let file = create_private(&packed)?;
        let mut encoder = GzEncoder::new(BufWriter::new(file), flate2::Compression::default());
        std::io::copy(&mut input, &mut encoder)?;
        let file = encoder.finish()?.into_inner().map_err(|e| e.into_error())?;
        file.sync_all()?;
        let bytes = file.metadata()?.len();
        fs::rename(&packed, dir.join(format!("{id}{SUFFIX}")))?;
        Ok(bytes)
    })();
    let _ = fs::remove_file(&snapshot);
    let _ = fs::remove_file(snapshot.with_extension("db-journal"));
    let _ = fs::remove_file(&packed);
    let bytes = result?;
    // 改名后的时刻按文件名里记的为准(精度到毫秒)。
    let (_, created_at, _) = parse_name(&format!("{id}{SUFFIX}")).expect("we just built this name");
    Ok(BackupInfo { id, kind: kind.to_string(), created_at, schema_version: version, bytes })
}

/// 数据库结构要升级时先存一份(`ensure_schema` 调用)。默认失败只记日志:备份不成不该让程序
/// 起不来;设了 `RUST_API_DB_REQUIRE_UPGRADE_BACKUP`(`require` 为真)时返回错误,不升级。
pub(super) fn backup_before_upgrade(conn: &Connection, data_root: &Path, require: bool) -> Result<()> {
    let current = match user_version(conn) {
        Ok(version) => version,
        Err(_) => return Ok(()),
    };
    // 0 是新建的空库(或远古的库),没什么可存。
    if current == 0 || current >= versioned_migration_count() {
        return Ok(());
    }
    let dir = backups_dir_for(data_root);
    match write_backup(conn, &dir, KIND_BEFORE_UPGRADE) {
        Ok(_) => Ok(()),
        Err(error) if require => Err(error.context(format!(
            "backup before database upgrade (v{current} -> v{}) failed; not upgrading because RUST_API_DB_REQUIRE_UPGRADE_BACKUP is set",
            versioned_migration_count()
        ))),
        Err(error) => {
            // 升级照常往下走（备份目录写不进去不该让程序起不来），但要让人看得到：之后迁移出错就没有回退点。
            tracing::error!("backup before database upgrade failed (upgrading without a fallback copy): {error:#}");
            Ok(())
        }
    }
}

fn backups_dir_for(data_root: &Path) -> PathBuf {
    data_root.join("backups").join("db")
}

/// 按保留规则该删掉的备份。`items` 新的在前。
fn to_prune(items: &[BackupInfo]) -> Vec<String> {
    let mut out = Vec::new();
    for (kind, keep) in [
        (KIND_MANUAL, KEEP_MANUAL),
        (KIND_BEFORE_RESTORE, KEEP_BEFORE_RESTORE),
        (KIND_BEFORE_UPGRADE, KEEP_BEFORE_UPGRADE),
    ] {
        out.extend(items.iter().filter(|b| b.kind == kind).skip(keep).map(|b| b.id.clone()));
    }
    let mut weeks = Vec::new();
    for item in items.iter().filter(|b| b.kind == KIND_AUTO).skip(KEEP_RECENT_AUTO) {
        let week = item.created_at.iso_week();
        let week = (week.year(), week.week());
        if weeks.len() < KEEP_WEEKLY_AUTO && !weeks.contains(&week) {
            weeks.push(week);
        } else {
            out.push(item.id.clone());
        }
    }
    out
}

impl Db {
    pub fn backups_dir(&self) -> PathBuf {
        backups_dir_for(&self.data_root)
    }

    /// 现在存一份备份。
    pub fn create_backup(&self, kind: &str) -> Result<BackupInfo> {
        if !KINDS.contains(&kind) {
            bail!("unknown backup kind: {kind}");
        }
        let conn = self.connect()?;
        write_backup(&conn, &self.backups_dir(), kind)
    }

    /// 全部备份,新的在前。
    pub fn list_backups(&self) -> Result<Vec<BackupInfo>> {
        let dir = self.backups_dir();
        let entries = match fs::read_dir(&dir) {
            Ok(entries) => entries,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
            Err(error) => return Err(error.into()),
        };
        let mut out = Vec::new();
        for entry in entries {
            let entry = entry?;
            let name = entry.file_name().to_string_lossy().to_string();
            let Some((kind, created_at, schema_version)) = parse_name(&name) else {
                continue;
            };
            let id = name.trim_end_matches(SUFFIX).to_string();
            out.push(BackupInfo { id, kind, created_at, schema_version, bytes: entry.metadata()?.len() });
        }
        out.sort_by(|a, b| b.created_at.cmp(&a.created_at).then_with(|| b.id.cmp(&a.id)));
        Ok(out)
    }

    /// 按保留规则删掉多余的备份,返回删了哪些。自动备份:最近 7 份全留,更早的每周留
    /// 最新的一份、留 4 周;手动的留最近 10 份;恢复前、升级前的各留最近 3 份。顺带清掉
    /// 中断留下的临时文件。
    pub fn prune_backups(&self) -> Result<Vec<String>> {
        let dir = self.backups_dir();
        let removed = to_prune(&self.list_backups()?);
        for id in &removed {
            fs::remove_file(dir.join(format!("{id}{SUFFIX}")))?;
        }
        for entry in fs::read_dir(&dir).into_iter().flatten().flatten() {
            let stale = entry.file_name().to_string_lossy().starts_with(".tmp-")
                && entry
                    .metadata()
                    .and_then(|m| m.modified())
                    .is_ok_and(|t| t.elapsed().unwrap_or_default() > Duration::from_secs(3600));
            if stale {
                let _ = fs::remove_file(entry.path());
            }
        }
        Ok(removed)
    }

    /// 删掉一份备份。没有这份时为 false。
    pub fn delete_backup(&self, id: &str) -> Result<bool> {
        let Some(path) = self.backup_path(id) else {
            return Ok(false);
        };
        fs::remove_file(path)?;
        Ok(true)
    }

    fn backup_path(&self, id: &str) -> Option<PathBuf> {
        let name = format!("{id}{SUFFIX}");
        if id.contains(['/', '\\']) || parse_name(&name).is_none() {
            return None;
        }
        let path = self.backups_dir().join(name);
        path.is_file().then_some(path)
    }

    /// 恢复前要先停下来的事(给用户看);空表示可以恢复。
    /// 恢复备份开始：拿写锁，直到返回的守卫丢掉。正在建任务、上传落库的先做完。
    pub fn begin_restore(&self) -> RestoreInProgressGuard<'_> {
        RestoreInProgressGuard(self.restore_gate.write().unwrap_or_else(std::sync::PoisonError::into_inner))
    }

    /// 建任务、重跑、上传落库前调，守卫留到落库完。正在恢复备份就返回 [`RestoreInProgress`]，调用方拒绝这次请求。
    pub fn hold_off_restore(&self) -> std::result::Result<RestoreHoldGuard<'_>, RestoreInProgress> {
        match self.restore_gate.try_read() {
            Ok(guard) => Ok(RestoreHoldGuard(guard)),
            Err(std::sync::TryLockError::Poisoned(poisoned)) => Ok(RestoreHoldGuard(poisoned.into_inner())),
            Err(std::sync::TryLockError::WouldBlock) => Err(RestoreInProgress),
        }
    }

    pub fn restore_blockers(&self) -> Result<Vec<String>> {
        blockers_on(&self.connect()?)
    }

    /// 用一份备份替换当前数据库的内容:[`Db::check_backup`] + [`Db::restore_checked`]。调用方
    /// 负责在两步之间先存一份恢复前的备份,并在这期间停住同步。
    pub fn restore_backup(&self, id: &str) -> Result<std::result::Result<(), RestoreRefusal>> {
        match self.check_backup(id)? {
            Ok(checked) => self.restore_checked(checked),
            Err(refusal) => Ok(Err(refusal)),
        }
    }

    /// 解开一份备份,检查完整性和版本。不动正在用的库;能恢复时返回解开的副本。
    pub fn check_backup(&self, id: &str) -> Result<std::result::Result<CheckedBackup, RestoreRefusal>> {
        let Some(packed) = self.backup_path(id) else {
            return Ok(Err(RestoreRefusal::NotFound));
        };
        let checked = CheckedBackup { id: id.to_string(), unpacked: temp_name(&self.backups_dir(), ".db") };
        let unpack = (|| -> std::io::Result<()> {
            let mut decoder = GzDecoder::new(BufReader::new(fs::File::open(&packed)?));
            let mut out = BufWriter::new(create_private(&checked.unpacked)?);
            std::io::copy(&mut decoder, &mut out)?;
            out.flush()
        })();
        if let Err(error) = unpack {
            return Ok(Err(RestoreRefusal::Damaged(error.to_string())));
        }
        // 解开的是临时副本:可写打开(全文索引的完整性检查要写)。
        let source = match Connection::open_with_flags(&checked.unpacked, OpenFlags::SQLITE_OPEN_READ_WRITE) {
            Ok(conn) => conn,
            Err(error) => return Ok(Err(RestoreRefusal::Damaged(error.to_string()))),
        };
        let check: std::result::Result<String, _> =
            source.query_row("PRAGMA integrity_check", [], |row| row.get(0));
        match check {
            Ok(text) if text == "ok" => {}
            Ok(text) => return Ok(Err(RestoreRefusal::Damaged(text))),
            Err(error) => return Ok(Err(RestoreRefusal::Damaged(error.to_string()))),
        }
        let version = user_version(&source)?;
        let supported = versioned_migration_count();
        if version > supported {
            return Ok(Err(RestoreRefusal::Newer { backup: version, supported }));
        }
        drop(source);
        Ok(Ok(checked))
    }

    /// 把检查过的备份换进正在用的库(见模块说明):先在副本上补结构、重置同步记账、清 pid,
    /// 换库前再查一次有没有在跑的任务(有就 [`RestoreRefusal::Blocked`],什么都不改),最后
    /// 一步换进去。返回 `Err` 时正在用的库没有变。
    pub fn restore_checked(&self, checked: CheckedBackup) -> Result<std::result::Result<(), RestoreRefusal>> {
        let mut source = Connection::open_with_flags(&checked.unpacked, OpenFlags::SQLITE_OPEN_READ_WRITE)?;
        source.execute_batch("PRAGMA foreign_keys=ON;")?;
        // 旧备份的结构补到最新(不再另存升级前备份:恢复前那份已经有了)。
        Db::apply_schema(&source)?;
        let mut target = self.connect()?;
        let previous_sync_state: Vec<(String, String)> = {
            let mut stmt = target.prepare("SELECT key, value FROM sync_state")?;
            let rows = stmt.query_map([], |row| Ok((row.get(0)?, row.get(1)?)))?;
            rows.collect::<std::result::Result<_, _>>()?
        };
        {
            let tx = source.transaction()?;
            sync_after_restore(&tx, &previous_sync_state)?;
            clear_restored_job_pids(&tx)?;
            tx.commit()?;
        }
        // 从调用方查过到现在(等同步停下、存恢复前备份)可能又有任务进来了:换库前再查一次。
        let blockers = blockers_on(&target)?;
        if !blockers.is_empty() {
            return Ok(Err(RestoreRefusal::Blocked(blockers)));
        }
        {
            let backup = Backup::new(&source, &mut target)?;
            // 一步拷完:整个替换在目标库的一次写事务里完成。别的连接正在写时等一等。
            let mut attempts = 0;
            loop {
                match backup.step(-1)? {
                    StepResult::Done => break,
                    StepResult::More => {}
                    StepResult::Busy | StepResult::Locked => {
                        attempts += 1;
                        if attempts > 100 {
                            bail!("database stayed busy; restore not started");
                        }
                        std::thread::sleep(Duration::from_millis(100));
                    }
                    _ => {}
                }
            }
        }
        drop(source);
        drop(checked);
        // 副本已经是 WAL、结构最新;这里只是保险,失败也不影响恢复结果。
        if let Err(error) = target.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;") {
            tracing::warn!("after restoring a backup: {error:#}");
        }
        *self.schema_ready.lock().expect("db schema_ready mutex poisoned") = true;
        Ok(Ok(()))
    }
}

/// [`Db::check_backup`] 检查过、能恢复的一份备份:解开的临时副本。用完(恢复了或放弃了)删掉。
pub struct CheckedBackup {
    id: String,
    unpacked: PathBuf,
}

impl CheckedBackup {
    pub fn id(&self) -> &str {
        &self.id
    }
}

impl Drop for CheckedBackup {
    fn drop(&mut self) {
        let _ = fs::remove_file(&self.unpacked);
        for suffix in ["-journal", "-wal", "-shm"] {
            let mut name = self.unpacked.clone().into_os_string();
            name.push(suffix);
            let _ = fs::remove_file(PathBuf::from(name));
        }
    }
}

/// 恢复前要先停下来的事(给用户看);空表示可以恢复。
fn blockers_on(conn: &Connection) -> Result<Vec<String>> {
    let count = |sql: &str| -> Result<i64> { Ok(conn.query_row(sql, [], |row| row.get(0))?) };
    let mut out = Vec::new();
    let jobs = count("SELECT COUNT(*) FROM jobs WHERE status_json IN ('\"queued\"', '\"running\"')")?;
    if jobs > 0 {
        out.push(format!("有 {jobs} 个任务在排队或运行"));
    }
    let operations = count(
        "SELECT COUNT(*) FROM document_operations WHERE status IN ('queued', 'running', 'validating')",
    )?;
    if operations > 0 {
        out.push(format!("AI 正在改 {operations} 份文档"));
    }
    let calculations = count("SELECT COUNT(*) FROM agent_calculation_runs WHERE status = 'running'")?;
    if calculations > 0 {
        out.push(format!("AI 有 {calculations} 个计算没算完"));
    }
    Ok(out)
}

/// 备份里排队/运行中的任务带着备份那一刻的 worker pid。恢复之后这些 pid 一律不属于当前
/// 任何进程（那个 worker 早没了，号码可能已被不相干的进程复用），留着的话对账会把它们当成
/// 孤儿 worker 去杀。只清 pid；这些行由拥有任务运行时的进程对账（立即一次，或运行期巡检），
/// 按启动恢复的规则判成续跑或失败。终态任务的 pid 只是历史记录，不动。
fn clear_restored_job_pids(conn: &Connection) -> Result<usize> {
    Ok(conn.execute(
        "UPDATE jobs SET pid = NULL
         WHERE pid IS NOT NULL AND status_json IN ('\"queued\"', '\"running\"')",
        [],
    )?)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn info(kind: &str, at: &str) -> BackupInfo {
        let created_at = DateTime::parse_from_rfc3339(at).unwrap().with_timezone(&Utc);
        BackupInfo { id: format!("{kind}-{at}"), kind: kind.into(), created_at, schema_version: 19, bytes: 1 }
    }

    fn temp_db() -> (PathBuf, Db) {
        let root = std::env::temp_dir().join(format!("retain-backup-{:016x}", fastrand::u64(..)));
        fs::create_dir_all(&root).unwrap();
        let db = Db::new(root.join("db").join("jobs.db"), root.clone());
        db.init().unwrap();
        (root, db)
    }

    fn title(db: &Db) -> Option<String> {
        db.connect()
            .unwrap()
            .query_row("SELECT title FROM documents WHERE document_id = 'd1'", [], |row| row.get(0))
            .ok()
    }

    fn set_title(db: &Db, title: &str) {
        db.connect()
            .unwrap()
            .execute(
                "INSERT INTO documents(document_id, title, source_filename, added_at, updated_at)
                 VALUES('d1', ?1, 'a.pdf', 't', 't')
                 ON CONFLICT(document_id) DO UPDATE SET title = excluded.title",
                [title],
            )
            .unwrap();
    }

    /// 升级前的备份存不成（备份目录的位置被一个文件占着）：默认照常升级，要求备份时报错、不升级。
    #[test]
    fn a_failed_upgrade_backup_stops_the_upgrade_only_when_required() {
        let (root, db) = temp_db();
        let conn = db.connect().unwrap();
        conn.pragma_update(None, "user_version", versioned_migration_count() - 1).unwrap();
        fs::write(root.join("backups"), b"not a directory").unwrap();

        backup_before_upgrade(&conn, &root, false).expect("default: upgrade without a backup");
        let error = backup_before_upgrade(&conn, &root, true).expect_err("required: refuse");
        let message = format!("{error:#}");
        assert!(message.contains("RUST_API_DB_REQUIRE_UPGRADE_BACKUP"), "{message}");

        // 备份存得成时两种都放行，要求备份时也真的存了一份。
        fs::remove_file(root.join("backups")).unwrap();
        backup_before_upgrade(&conn, &root, true).expect("backup written");
        assert_eq!(db.list_backups().unwrap().len(), 1);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn a_backup_restores_into_the_live_database_and_other_connections_see_it() {
        let (root, db) = temp_db();
        set_title(&db, "before");
        let backup = db.create_backup(KIND_MANUAL).unwrap();
        assert_eq!(backup.schema_version, versioned_migration_count());
        assert!(backup.bytes > 0);
        set_title(&db, "after");
        // 另一个进程(这里用另一个 Db)一直开着同一个库。
        let other = Db::new(root.join("db").join("jobs.db"), root.clone());
        assert_eq!(title(&other).as_deref(), Some("after"));

        assert_eq!(db.restore_backup(&backup.id).unwrap(), Ok(()));
        assert_eq!(title(&db).as_deref(), Some("before"));
        assert_eq!(title(&other).as_deref(), Some("before"));
        assert_eq!(db.list_backups().unwrap(), vec![backup.clone()]);
        assert_eq!(db.restore_backup("manual-nope").unwrap(), Err(RestoreRefusal::NotFound));
        assert_eq!(db.restore_backup("../../etc/passwd").unwrap(), Err(RestoreRefusal::NotFound));
        assert!(db.delete_backup(&backup.id).unwrap());
        assert!(db.list_backups().unwrap().is_empty());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn damaged_or_newer_backups_are_refused_and_nothing_changes() {
        let (root, db) = temp_db();
        set_title(&db, "current");
        let dir = db.backups_dir();
        fs::write(dir.join("manual-20261009T120000000Z-v19.db.gz"), b"not gzip").unwrap_or_else(|_| {
            fs::create_dir_all(&dir).unwrap();
            fs::write(dir.join("manual-20261009T120000000Z-v19.db.gz"), b"not gzip").unwrap();
        });
        assert!(matches!(
            db.restore_backup("manual-20261009T120000000Z-v19").unwrap(),
            Err(RestoreRefusal::Damaged(_))
        ));
        let newer = db.create_backup(KIND_MANUAL).unwrap();
        // 改成更新版本的结构号:解开、改 user_version、再压回去。
        let path = dir.join(format!("{}{SUFFIX}", newer.id));
        let raw = dir.join("raw.db");
        std::io::copy(&mut GzDecoder::new(fs::File::open(&path).unwrap()), &mut fs::File::create(&raw).unwrap()).unwrap();
        Connection::open(&raw).unwrap().pragma_update(None, "user_version", versioned_migration_count() + 1).unwrap();
        let mut encoder = GzEncoder::new(fs::File::create(&path).unwrap(), flate2::Compression::fast());
        std::io::copy(&mut fs::File::open(&raw).unwrap(), &mut encoder).unwrap();
        encoder.finish().unwrap();
        assert!(matches!(db.restore_backup(&newer.id).unwrap(), Err(RestoreRefusal::Newer { .. })));
        assert_eq!(title(&db).as_deref(), Some("current"));
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn an_upgrade_backs_up_first_but_a_new_database_does_not() {
        let (root, db) = temp_db();
        assert!(db.list_backups().unwrap().is_empty(), "fresh database: nothing to keep");
        let conn = db.connect().unwrap();
        conn.pragma_update(None, "user_version", versioned_migration_count() - 1).unwrap();
        backup_before_upgrade(&conn, &root, false).unwrap();
        let list = db.list_backups().unwrap();
        assert_eq!(list.len(), 1);
        assert_eq!((list[0].kind.as_str(), list[0].schema_version), (KIND_BEFORE_UPGRADE, versioned_migration_count() - 1));
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn running_work_blocks_a_restore() {
        let (root, db) = temp_db();
        assert!(db.restore_blockers().unwrap().is_empty());
        db.connect()
            .unwrap()
            .execute(
                "INSERT INTO jobs(job_id, workflow, status_json, created_at, updated_at, command_json, request_json, log_tail_json)
                 VALUES('j1', '\"book\"', '\"running\"', 't', 't', '[]', '{}', '[]')",
                [],
            )
            .unwrap();
        assert_eq!(db.restore_blockers().unwrap(), vec!["有 1 个任务在排队或运行".to_string()]);
        fs::remove_dir_all(root).unwrap();
    }

    /// 回归：备份里排队/运行中的任务带着备份时的 pid。恢复后这些 pid 不属于当前任何进程
    /// （可能已被不相干的进程复用），对账时不能拿去杀，恢复时就要清掉；终态任务不动。
    #[test]
    fn a_restore_clears_the_stale_pids_of_restored_queued_and_running_jobs() {
        let (root, db) = temp_db();
        let conn = db.connect().unwrap();
        for (id, status) in [("run", "running"), ("wait", "queued"), ("done", "succeeded")] {
            conn.execute(
                "INSERT INTO jobs(job_id, workflow, status_json, created_at, updated_at, pid, command_json, request_json, log_tail_json)
                 VALUES(?1, '\"book\"', ?2, 't', 't', 4242, '[]', '{}', '[]')",
                rusqlite::params![id, format!("\"{status}\"")],
            )
            .unwrap();
        }
        let backup = db.create_backup(KIND_MANUAL).unwrap();
        // 恢复前这些任务都结束了（否则 restore_blockers 不让恢复）。
        conn.execute("UPDATE jobs SET status_json = '\"failed\"', pid = NULL", []).unwrap();
        drop(conn);

        assert_eq!(db.restore_backup(&backup.id).unwrap(), Ok(()));
        let pid = |id: &str| -> Option<i64> {
            db.connect()
                .unwrap()
                .query_row("SELECT pid FROM jobs WHERE job_id = ?1", [id], |row| row.get(0))
                .unwrap()
        };
        assert_eq!(pid("run"), None, "恢复出来的 running 任务不能带着备份里的 pid");
        assert_eq!(pid("wait"), None, "恢复出来的 queued 任务不能带着备份里的 pid");
        assert_eq!(pid("done"), Some(4242), "终态任务的 pid 只是历史记录，不动");
        fs::remove_dir_all(root).unwrap();
    }

    fn unpack(db: &Db, id: &str) -> Vec<u8> {
        let path = db.backups_dir().join(format!("{id}{SUFFIX}"));
        let mut raw = Vec::new();
        std::io::Read::read_to_end(&mut GzDecoder::new(fs::File::open(path).unwrap()), &mut raw).unwrap();
        raw
    }

    /// 回归（审计 C4）：WebDAV 密码明文存在 sync_state 里，以前每份备份都带着它。备份里
    /// 不能有密码，文件只给本机用户读；恢复保留恢复前的同步设置，密码照旧在。
    #[test]
    fn backups_leave_the_webdav_password_out_and_are_private_to_the_owner() {
        let (root, db) = temp_db();
        db.sync_state_set("webdav_password", "top-secret-pass-77").unwrap();
        db.sync_state_set("webdav_url", "http://nas:5005/dav").unwrap();
        let backup = db.create_backup(KIND_MANUAL).unwrap();
        let raw = unpack(&db, &backup.id);
        assert!(
            !raw.windows(b"top-secret-pass-77".len()).any(|w| w == b"top-secret-pass-77"),
            "备份解开后不能查到 WebDAV 密码"
        );
        assert!(raw.windows(b"nas:5005".len()).any(|w| w == b"nas:5005"), "别的同步设置照常在备份里");
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mode = fs::metadata(db.backups_dir().join(format!("{}{SUFFIX}", backup.id))).unwrap().permissions().mode();
            assert_eq!(mode & 0o777, 0o600, "备份文件只给本机用户读写");
        }
        assert_eq!(db.restore_backup(&backup.id).unwrap(), Ok(()));
        assert_eq!(db.sync_state_get("webdav_password").unwrap().as_deref(), Some("top-secret-pass-77"));
        fs::remove_dir_all(root).unwrap();
    }

    /// 回归（审计 C3）：换库之后的几步（结构升级、同步记账、清 pid）以前在换好的正在用的库上
    /// 一步步做，中途失败接口回 500 而库已经换了。现在在解开的副本上做完再一步换进去：
    /// 任何一步失败，正在用的库不变。
    #[test]
    fn a_restore_that_fails_while_preparing_the_copy_leaves_the_live_database_alone() {
        let (root, db) = temp_db();
        let conn = db.connect().unwrap();
        set_title(&db, "before");
        conn.execute(
            "INSERT INTO jobs(job_id, workflow, status_json, created_at, updated_at, pid, command_json, request_json, log_tail_json)
             VALUES('j1', '\"book\"', '\"running\"', 't', 't', 4242, '[]', '{}', '[]')",
            [],
        )
        .unwrap();
        // 备份里有一个清 pid 时会失败的触发器。
        conn.execute_batch(
            "CREATE TRIGGER boom BEFORE UPDATE OF pid ON jobs BEGIN SELECT RAISE(ABORT, 'boom'); END;",
        )
        .unwrap();
        let backup = db.create_backup(KIND_MANUAL).unwrap();
        conn.execute_batch(
            "DROP TRIGGER boom; UPDATE jobs SET status_json = '\"failed\"', pid = NULL;",
        )
        .unwrap();
        drop(conn);
        set_title(&db, "after");
        assert!(db.restore_backup(&backup.id).is_err());
        assert_eq!(title(&db).as_deref(), Some("after"), "失败时正在用的库不能已经换了");
        fs::remove_dir_all(root).unwrap();
    }

    /// 回归（审计 C2）：「有没有任务在跑」以前只在恢复开头查一次。换库前在同一个阻塞线程里
    /// 再查一次：这时有任务在跑就不换。
    #[test]
    fn work_that_started_after_the_check_still_blocks_the_swap() {
        let (root, db) = temp_db();
        set_title(&db, "before");
        let backup = db.create_backup(KIND_MANUAL).unwrap();
        set_title(&db, "after");
        let checked = db.check_backup(&backup.id).unwrap().unwrap();
        db.connect()
            .unwrap()
            .execute(
                "INSERT INTO jobs(job_id, workflow, status_json, created_at, updated_at, command_json, request_json, log_tail_json)
                 VALUES('j1', '\"book\"', '\"queued\"', 't', 't', '[]', '{}', '[]')",
                [],
            )
            .unwrap();
        assert!(matches!(db.restore_checked(checked).unwrap(), Err(RestoreRefusal::Blocked(_))));
        assert_eq!(title(&db).as_deref(), Some("after"));
        let leftovers: Vec<_> = fs::read_dir(db.backups_dir())
            .unwrap()
            .flatten()
            .filter(|e| e.file_name().to_string_lossy().starts_with(".tmp-"))
            .collect();
        assert!(leftovers.is_empty(), "解开的副本用完要删掉：{leftovers:?}");
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn names_round_trip_and_strangers_are_ignored() {
        let (kind, at, version) = parse_name("before-upgrade-20261009T120000123Z-v18.db.gz").unwrap();
        assert_eq!((kind.as_str(), version), ("before-upgrade", 18));
        assert_eq!(at.to_rfc3339(), "2026-10-09T12:00:00.123+00:00");
        for name in ["notes.txt", "auto-20261009T120000123Z.db.gz", "other-20261009T120000123Z-v1.db.gz", ".tmp-1.db.gz"] {
            assert!(parse_name(name).is_none(), "{name}");
        }
    }

    #[test]
    fn keeps_a_week_of_daily_backups_then_one_per_week_for_four_weeks() {
        // 每天一份,共 60 天,新的在前。
        let start = DateTime::parse_from_rfc3339("2026-10-09T03:00:00Z").unwrap().with_timezone(&Utc);
        let items: Vec<BackupInfo> = (0..60)
            .map(|day| {
                let at = start - chrono::Duration::days(day);
                BackupInfo { id: format!("auto-{day}"), kind: KIND_AUTO.into(), created_at: at, schema_version: 19, bytes: 1 }
            })
            .collect();
        let removed = to_prune(&items);
        let kept: Vec<&BackupInfo> = items.iter().filter(|b| !removed.contains(&b.id)).collect();
        assert_eq!(kept.len(), KEEP_RECENT_AUTO + KEEP_WEEKLY_AUTO);
        let mut weeks: Vec<_> = kept[KEEP_RECENT_AUTO..].iter().map(|b| b.created_at.iso_week()).collect();
        weeks.dedup();
        assert_eq!(weeks.len(), KEEP_WEEKLY_AUTO, "one per distinct week");
        // 最旧留下的不超过五周前。
        assert!(start - kept.last().unwrap().created_at <= chrono::Duration::days(7 * 5));
    }

    #[test]
    fn manual_and_safety_backups_keep_their_own_counts() {
        let mut items = Vec::new();
        for i in 0..12 {
            items.push(info(KIND_MANUAL, &format!("2026-10-{:02}T00:00:00Z", 28 - i)));
            items.push(info(KIND_BEFORE_RESTORE, &format!("2026-09-{:02}T00:00:00Z", 28 - i)));
        }
        let removed = to_prune(&items);
        assert_eq!(removed.iter().filter(|id| id.starts_with("manual-")).count(), 2);
        assert_eq!(removed.iter().filter(|id| id.starts_with("before-restore-")).count(), 9);
    }
}

/// [`Db::begin_restore`] 的守卫：丢掉就算恢复结束。
pub struct RestoreInProgressGuard<'a>(#[allow(dead_code)] std::sync::RwLockWriteGuard<'a, ()>);

/// [`Db::hold_off_restore`] 的守卫：拿着它期间恢复不会开始。
pub struct RestoreHoldGuard<'a>(#[allow(dead_code)] std::sync::RwLockReadGuard<'a, ()>);

/// 正在恢复备份，这次建任务、上传不做。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct RestoreInProgress;

impl RestoreInProgress {
    /// 接口回 409 时 `error.details.reason` 的值。
    pub const REASON: &'static str = "restore_in_progress";
}

impl std::fmt::Display for RestoreInProgress {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter.write_str("a database backup is being restored; try again in a moment")
    }
}

impl std::error::Error for RestoreInProgress {}

#[cfg(test)]
mod restore_gate_tests {
    use std::time::{Duration, Instant};

    use super::*;

    fn db(name: &str) -> Db {
        let root = std::env::temp_dir().join(format!("retainpdf-restore-gate-{name}-{}", fastrand::u64(..)));
        Db::new(root.join("db").join("jobs.db"), root)
    }

    #[test]
    fn work_is_refused_while_a_restore_runs_and_allowed_again_after() {
        let db = db("refuse");
        let clone = db.clone();
        let restoring = db.begin_restore();
        assert_eq!(clone.hold_off_restore().err(), Some(RestoreInProgress), "clones share the gate");
        drop(restoring);
        let first = clone.hold_off_restore().expect("no restore any more");
        let second = db.hold_off_restore().expect("work does not block other work");
        drop((first, second));
    }

    #[test]
    fn a_restore_waits_for_work_already_in_progress() {
        let db = db("wait");
        let worker = db.clone();
        let (started, wait_started) = std::sync::mpsc::channel();
        let handle = std::thread::spawn(move || {
            let _hold = worker.hold_off_restore().unwrap();
            started.send(()).unwrap();
            std::thread::sleep(Duration::from_millis(300));
        });
        wait_started.recv().unwrap();
        let begun = Instant::now();
        let _restoring = db.begin_restore();
        assert!(begun.elapsed() >= Duration::from_millis(200), "the restore started before the work finished");
        handle.join().unwrap();
    }
}
