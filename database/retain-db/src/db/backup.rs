//! 数据库备份与恢复。
//!
//! 备份放在 `<数据目录>/backups/db/`,一份一个文件:`<种类>-<UTC 时刻>-v<结构版本>.db.gz`。
//! 内容是 `VACUUM INTO` 出的完整数据库(一致的快照,不用停服务、不挡别的读写),再 gzip
//! 压缩;先写临时名再改名,半份文件不会被当成备份。种类:
//!
//! - `auto`:后台每天一份(调度在 rust_api 的 `services/backup`);
//! - `manual`:用户点「立即备份」;
//! - `before-restore`:恢复前把当时的数据库先存一份,恢复错了还能退回;
//! - `before-upgrade`:数据库结构要升级(版本化迁移)之前自动存一份。
//!
//! 保留规则见 [`Db::prune_backups`]。
//!
//! # 恢复
//!
//! [`Db::restore_backup`] 先解压、检查完整性和版本(比本机程序新的不恢复),再用 SQLite
//! 的在线备份接口把内容整体写进正在用的数据库:一次写事务完成,别的连接和进程下一次读到
//! 的就是恢复后的内容,不用重启,也不会读到一半新一半旧。然后补上缺的结构升级。
//!
//! 只恢复数据库,数据目录里的文件(原文、译文、成品)不动:备份之后新加的书文件还在,
//! 只是数据库里没有它;开着同步时会再从同步文件夹收回来。
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

/// 把 `conn` 所在的数据库存成一份备份。
fn write_backup(conn: &Connection, dir: &Path, kind: &str) -> Result<BackupInfo> {
    fs::create_dir_all(dir).with_context(|| format!("failed to create {}", dir.display()))?;
    let version = user_version(conn)?;
    let now = Utc::now();
    let id = format!("{kind}-{}-v{version}", now.format(STAMP));
    let snapshot = temp_name(dir, ".db");
    let packed = temp_name(dir, SUFFIX);
    let result = (|| -> Result<u64> {
        conn.execute("VACUUM INTO ?1", [snapshot.to_string_lossy().as_ref()])
            .context("VACUUM INTO failed")?;
        let mut input = BufReader::new(fs::File::open(&snapshot)?);
        let file = fs::File::create(&packed)?;
        let mut encoder = GzEncoder::new(BufWriter::new(file), flate2::Compression::default());
        std::io::copy(&mut input, &mut encoder)?;
        let file = encoder.finish()?.into_inner().map_err(|e| e.into_error())?;
        file.sync_all()?;
        let bytes = file.metadata()?.len();
        fs::rename(&packed, dir.join(format!("{id}{SUFFIX}")))?;
        Ok(bytes)
    })();
    let _ = fs::remove_file(&snapshot);
    let _ = fs::remove_file(&packed);
    let bytes = result?;
    // 改名后的时刻按文件名里记的为准(精度到毫秒)。
    let (_, created_at, _) = parse_name(&format!("{id}{SUFFIX}")).expect("we just built this name");
    Ok(BackupInfo { id, kind: kind.to_string(), created_at, schema_version: version, bytes })
}

/// 数据库结构要升级时先存一份(`ensure_schema` 调用)。失败只记日志:备份不成不该让程序
/// 起不来。
pub(super) fn backup_before_upgrade(conn: &Connection, data_root: &Path) {
    let current = match user_version(conn) {
        Ok(version) => version,
        Err(_) => return,
    };
    // 0 是新建的空库(或远古的库),没什么可存。
    if current == 0 || current >= versioned_migration_count() {
        return;
    }
    let dir = backups_dir_for(data_root);
    if let Err(error) = write_backup(conn, &dir, KIND_BEFORE_UPGRADE) {
        eprintln!("warning: backup before database upgrade failed: {error:#}");
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
    pub fn restore_blockers(&self) -> Result<Vec<String>> {
        let conn = self.connect()?;
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

    /// 用一份备份替换当前数据库的内容(见模块说明)。调用方负责先存一份恢复前的备份、
    /// 确认没有在跑的任务,并在这期间停住同步。
    pub fn restore_backup(&self, id: &str) -> Result<std::result::Result<(), RestoreRefusal>> {
        let Some(path) = self.backup_path(id) else {
            return Ok(Err(RestoreRefusal::NotFound));
        };
        let dir = self.backups_dir();
        let unpacked = temp_name(&dir, ".db");
        let result = self.restore_unpacked(&path, &unpacked);
        let _ = fs::remove_file(&unpacked);
        result
    }

    fn restore_unpacked(&self, packed: &Path, unpacked: &Path) -> Result<std::result::Result<(), RestoreRefusal>> {
        let unpack = (|| -> std::io::Result<()> {
            let mut decoder = GzDecoder::new(BufReader::new(fs::File::open(packed)?));
            let mut out = BufWriter::new(fs::File::create(unpacked)?);
            std::io::copy(&mut decoder, &mut out)?;
            out.flush()
        })();
        if let Err(error) = unpack {
            return Ok(Err(RestoreRefusal::Damaged(error.to_string())));
        }
        // 解开的是临时副本:可写打开(全文索引的完整性检查要写)。
        let source = match Connection::open_with_flags(unpacked, OpenFlags::SQLITE_OPEN_READ_WRITE) {
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

        let mut target = self.connect()?;
        let previous_sync_state: Vec<(String, String)> = {
            let mut stmt = target.prepare("SELECT key, value FROM sync_state")?;
            let rows = stmt.query_map([], |row| Ok((row.get(0)?, row.get(1)?)))?;
            rows.collect::<std::result::Result<_, _>>()?
        };
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
        target.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")?;
        // 旧备份的结构补到最新(不再另存升级前备份:恢复前那份已经有了)。
        {
            let mut ready = self.schema_ready.lock().expect("db schema_ready mutex poisoned");
            Db::apply_schema(&target)?;
            *ready = true;
        }
        sync_after_restore(&target, &previous_sync_state)?;
        Ok(Ok(()))
    }
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
        backup_before_upgrade(&conn, &root);
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
