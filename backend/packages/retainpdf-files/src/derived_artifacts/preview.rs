use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::Duration;

use retainpdf_api_base::error::AppError;
use retainpdf_core::models::domain::JobSnapshot;

use super::side_by_side::{build_with_command, build_with_command_and_exit_check};
use super::{cached_output_is_fresh, job_artifacts_dir, DerivedArtifactDeps};

#[derive(Clone, Copy)]
pub enum BookImageKind {
    Cover,
    Thumbnail,
}

impl BookImageKind {
    pub fn file_name(self) -> &'static str {
        match self {
            Self::Cover => "cover.jpg",
            Self::Thumbnail => "thumbnail.jpg",
        }
    }

    pub fn width_px(self) -> u32 {
        match self {
            Self::Cover => 900,
            Self::Thumbnail => 360,
        }
    }
}

pub fn ensure_book_image(
    deps: DerivedArtifactDeps<'_>,
    data_root: &Path,
    job: &JobSnapshot,
    source_pdf: &Path,
    kind: BookImageKind,
) -> Result<PathBuf, AppError> {
    let output_dir = job_artifacts_dir(data_root, job)?;
    let output_path = output_dir.join(kind.file_name());
    ensure_book_image_at_path(deps, source_pdf, &output_path, kind)
}

/// 文档级封面/缩略图：从源 PDF 首页渲染，缓存到 documents/<id>/。
pub fn ensure_document_book_image(
    deps: DerivedArtifactDeps<'_>,
    data_root: &Path,
    document_id: &str,
    source_pdf: &Path,
    kind: BookImageKind,
) -> Result<PathBuf, AppError> {
    let output_dir = super::document_artifacts_dir(data_root, document_id)?;
    let output_path = output_dir.join(kind.file_name());
    ensure_book_image_at_path(deps, source_pdf, &output_path, kind)
}

/// 封面、缩略图和页预览一样按生成前记下的原文戳判断新鲜（见 `freshness.rs`）：书的原文会变
/// （单机下 Agent 文档操作提交以后，原文换成新版本的文件），以前「文件在就用」会一直发旧图。
fn ensure_book_image_at_path(
    deps: DerivedArtifactDeps<'_>,
    source_pdf: &Path,
    output_path: &Path,
    kind: BookImageKind,
) -> Result<PathBuf, AppError> {
    if cached_output_is_fresh(output_path, &[source_pdf])? {
        return Ok(output_path.to_path_buf());
    }
    render_book_image(deps.python_bin, source_pdf, output_path, kind.width_px(), RENDER_TIMEOUT)?;
    Ok(output_path.to_path_buf())
}

/// 单页预览图。缓存文件名只由页码、宽度、dpi 决定，所以要和对照 PDF、Word 一样判断新鲜度：
/// 源 PDF 变了（译文重渲染、原地重跑覆盖了 `translated.pdf`），就重新渲染，
/// 不能把旧页图当成新的发出去（按生成前记下的源 PDF 戳比，见 `freshness.rs`）。
///
/// 页码超出 PDF 页数：渲染脚本以 [`PAGE_OUT_OF_RANGE_EXIT`] 退出，这里变成 404。
/// 渲染超过 [`RENDER_TIMEOUT`]：整个进程组被杀，返回 500 `page-preview builder timed out`。
pub fn ensure_page_preview(
    deps: DerivedArtifactDeps<'_>,
    output_path: &Path,
    source_pdf: &Path,
    page_index: u32,
    width_px: u32,
    dpi: u32,
) -> Result<PathBuf, AppError> {
    ensure_page_preview_within(deps, output_path, source_pdf, page_index, width_px, dpi, RENDER_TIMEOUT)
}

fn ensure_page_preview_within(
    deps: DerivedArtifactDeps<'_>,
    output_path: &Path,
    source_pdf: &Path,
    page_index: u32,
    width_px: u32,
    dpi: u32,
    timeout: Duration,
) -> Result<PathBuf, AppError> {
    if cached_output_is_fresh(output_path, &[source_pdf])? {
        return Ok(output_path.to_path_buf());
    }
    render_pdf_page_preview(
        deps.python_bin,
        source_pdf,
        output_path,
        page_index,
        width_px,
        dpi,
        timeout,
    )?;
    Ok(output_path.to_path_buf())
}

/// 页预览、封面渲染一页的时限。正常几百毫秒到几秒；超过它多半是 fitz 被某个 PDF 卡死了。
///
/// 必须有：文件出口共用 `DownloadGeneration` 的 2 个名额，请求断开也不会取消已经在跑的渲染。
/// 以前没有时限，卡死两次就占满名额，之后所有文件请求（连 translated.pdf 的下载）都排队，
/// 只能重启。对照 PDF 120 秒、Word 600 秒是整本书的活，这里只渲染一页，远小于它们。
const RENDER_TIMEOUT: Duration = Duration::from_secs(60);

/// 渲染脚本发现页码超出 PDF 页数时的退出码，和别的失败区分开：客户端写错页码是 404，不是 500。
const PAGE_OUT_OF_RANGE_EXIT: i32 = 3;

/// 封面、缩略图：源 PDF 首页。和页预览一样走 `build_with_command`：带时限、超时杀进程组、
/// 先写临时文件再换名（以前直接写目标文件，渲染中途被杀会留下半截 JPG，之后一直命中）。
fn render_book_image(
    python_bin: &str,
    source_pdf: &Path,
    output_path: &Path,
    width_px: u32,
    timeout: Duration,
) -> Result<(), AppError> {
    // 输出是 Rust 给的临时文件（扩展名 `.tmp`），格式要写明，不能让 fitz 按扩展名猜。
    let script = r#"
import sys
from pathlib import Path
import fitz

source = Path(sys.argv[1])
output = Path(sys.argv[2])
width_px = int(sys.argv[3])

with fitz.open(source) as doc:
    if doc.page_count < 1:
        raise RuntimeError("source pdf has no pages")
    page = doc[0]
    scale = width_px / max(float(page.rect.width), 1.0)
    pix = page.get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False)
    pix.save(output, output="jpg")
"#;
    // 记下生成前的原文戳，下一次按它判断新不新鲜（原文换了版本就重新渲染）。
    build_with_command(output_path, "book-image", timeout, &[source_pdf], |temporary| {
        let mut command = Command::new(python_bin);
        command
            .arg("-c")
            .arg(script)
            .arg(source_pdf)
            .arg(temporary)
            .arg(width_px.to_string());
        command
    })
}

fn render_pdf_page_preview(
    python_bin: &str,
    source_pdf: &Path,
    output_path: &Path,
    page_index: u32,
    width_px: u32,
    dpi: u32,
    timeout: Duration,
) -> Result<(), AppError> {
    // 输出是 Rust 给的临时文件，Rust 负责换名（重新渲染旧缓存时，别的请求不会读到写了
    // 一半的图）；格式要写明，不能让 fitz 按扩展名 `.tmp` 猜。
    let script = r#"
import sys
from pathlib import Path
import fitz

source = Path(sys.argv[1])
output = Path(sys.argv[2])
page_index = int(sys.argv[3])
width_px = int(sys.argv[4])
dpi = int(sys.argv[5])

with fitz.open(source) as doc:
    if page_index < 0 or page_index >= doc.page_count:
        print(f"page out of range: {page_index + 1}/{doc.page_count}", file=sys.stderr)
        sys.exit(3)
    page = doc[page_index]
    if dpi > 0:
        scale = dpi / 72.0
    else:
        scale = width_px / max(float(page.rect.width), 1.0)
    pix = page.get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False)
    pix.save(output, output="jpg", jpg_quality=82)
"#;
    build_with_command_and_exit_check(
        output_path,
        "page-preview",
        timeout,
        &[source_pdf],
        |temporary| {
            let mut command = Command::new(python_bin);
            command
                .arg("-c")
                .arg(script)
                .arg(source_pdf)
                .arg(temporary)
                .arg(page_index.to_string())
                .arg(width_px.to_string())
                .arg(dpi.to_string());
            command
        },
        |status| {
            (status.code() == Some(PAGE_OUT_OF_RANGE_EXIT)).then(|| {
                AppError::not_found(format!("no such file: pages/{}.jpg", page_index + 1))
            })
        },
    )
}

#[cfg(all(test, unix))]
mod tests {
    use std::os::unix::fs::PermissionsExt;
    use std::time::{Duration, SystemTime};

    use super::*;

    /// 写一个假 python 脚本，先带 `--warm` 跑一次再交出去。macOS 上刚写出来的脚本第一次执行可能要等
    /// 很久（看着像系统对新可执行文件的检查）：并发跑测试时 5 秒内脚本第一行都没跑到，先跑过一次就不再等。
    /// 不预热的话卡死渲染那条会在第一行之前就撞上时限、一个孙进程都没记下（2026-10-22、10-23 合并前
    /// 检查两次红在这里，计时放宽到 5 秒照样红；预热后 12 份测试程序同时跑也不红）。
    ///
    /// Linux 上并发跑测试时，别的线程恰好在这一刻 fork，子进程在 exec 之前还拿着这个文件的写句柄，
    /// 马上执行会报 `ETXTBSY`（Text file busy，2026-11-25 PR #209 的 CI 红在这里）：预热这一次碰上就稍等重试。
    fn fake_script(path: PathBuf, body: &str) -> PathBuf {
        std::fs::write(&path, format!("#!/bin/sh\n[ \"$1\" = --warm ] && exit 0\n{body}")).unwrap();
        std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o755)).unwrap();
        let mut attempt = 0;
        let warm = loop {
            match std::process::Command::new(&path).arg("--warm").status() {
                Err(error) if error.kind() == std::io::ErrorKind::ExecutableFileBusy && attempt < 50 => {
                    attempt += 1;
                    std::thread::sleep(Duration::from_millis(20));
                }
                result => break result.unwrap(),
            }
        };
        assert!(warm.success(), "{path:?}");
        path
    }

    /// 假 python：`python -c <脚本> <源> <输出> …`，按 `$exit` 退出，退出 0 时往输出里写 `new`。
    fn fake_python(dir: &Path, exit_code: i32) -> PathBuf {
        fake_script(
            dir.join(format!("fake-python-{exit_code}.sh")),
            &format!("if [ {exit_code} -eq 0 ]; then printf new > \"$4\"; fi\nexit {exit_code}\n"),
        )
    }

    fn set_mtime(path: &Path, time: SystemTime) {
        std::fs::File::options()
            .write(true)
            .open(path)
            .unwrap()
            .set_modified(time)
            .unwrap();
    }

    struct Case {
        dir: PathBuf,
        source: PathBuf,
        cached: PathBuf,
    }

    fn case(name: &str) -> Case {
        let dir = std::env::temp_dir().join(format!("retainpdf-preview-{name}-{}", fastrand::u64(..)));
        std::fs::create_dir_all(&dir).unwrap();
        let source = dir.join("translated.pdf");
        let cached = dir.join("preview-translated-p0001-w1200-d0.jpg");
        std::fs::write(&source, b"%PDF").unwrap();
        std::fs::write(&cached, b"old").unwrap();
        Case { dir, source, cached }
    }

    #[test]
    fn cached_preview_older_than_its_pdf_is_rendered_again() {
        let case = case("stale");
        let now = SystemTime::now();
        set_mtime(&case.source, now);
        set_mtime(&case.cached, now - Duration::from_secs(60));
        let python = fake_python(&case.dir, 0);
        let deps = DerivedArtifactDeps::new(python.to_str().unwrap());
        let path = ensure_page_preview(deps, &case.cached, &case.source, 0, 1200, 0).unwrap();
        assert_eq!(std::fs::read(path).unwrap(), b"new", "译文重渲染以后不能再发旧页图");
    }

    #[test]
    fn cached_preview_newer_than_its_pdf_is_reused_without_rendering() {
        let case = case("fresh");
        let now = SystemTime::now();
        set_mtime(&case.source, now - Duration::from_secs(60));
        set_mtime(&case.cached, now);
        let python = fake_python(&case.dir, 1);
        let deps = DerivedArtifactDeps::new(python.to_str().unwrap());
        let path = ensure_page_preview(deps, &case.cached, &case.source, 0, 1200, 0).unwrap();
        assert_eq!(std::fs::read(path).unwrap(), b"old");
    }

    #[test]
    fn page_beyond_the_pdf_is_not_found_not_an_internal_error() {
        let case = case("range");
        std::fs::remove_file(&case.cached).unwrap();
        let python = fake_python(&case.dir, PAGE_OUT_OF_RANGE_EXIT);
        let deps = DerivedArtifactDeps::new(python.to_str().unwrap());
        let error = ensure_page_preview(deps, &case.cached, &case.source, 8, 1200, 0).unwrap_err();
        assert!(matches!(&error, AppError::NotFound(message) if message == "no such file: pages/9.jpg"), "{error:?}");
        let python = fake_python(&case.dir, 1);
        let deps = DerivedArtifactDeps::new(python.to_str().unwrap());
        let error = ensure_page_preview(deps, &case.cached, &case.source, 0, 1200, 0).unwrap_err();
        assert!(matches!(error, AppError::Internal(_)), "别的渲染失败仍然是内部错误");
    }

    /// 卡死的假 python：起一个 `sleep` 当孙进程，自己等着它。pid 记在 `sleep-<sh 的 pid>.pid`。
    fn hanging_python(dir: &Path) -> PathBuf {
        fake_script(
            dir.join("hanging-python.sh"),
            &format!("sleep 20 &\necho $! > \"{}/sleep-$$.pid\"\nwait\n", dir.display()),
        )
    }

    /// 记次数的假 python：第 n 次渲染往输出里写 `render-n`。`replace_source_first` 时第一次渲染
    /// 中途把源 PDF 换掉（读完源以后、写出页图以前，原地重渲染写完了新的 translated.pdf）。
    fn counting_python(dir: &Path, replace_source_first: bool) -> PathBuf {
        let path = dir.join("counting-python.sh");
        let count = dir.join("count");
        let replace = if replace_source_first {
            "if [ \"$n\" -eq 1 ]; then printf rerendered-pdf > \"$3.new\"; mv \"$3.new\" \"$3\"; fi\n"
        } else {
            ""
        };
        fake_script(
            path,
            &format!(
                "n=$(cat \"{count}\" 2>/dev/null || echo 0)\nn=$((n+1))\necho $n > \"{count}\"\n{replace}printf \"render-$n\" > \"$4\"\n",
                count = count.display(),
            ),
        )
    }

    fn sleep_pids(dir: &Path) -> Vec<i32> {
        std::fs::read_dir(dir)
            .unwrap()
            .filter_map(|entry| entry.ok())
            .filter(|entry| entry.file_name().to_string_lossy().starts_with("sleep-"))
            .filter_map(|entry| std::fs::read_to_string(entry.path()).ok()?.trim().parse().ok())
            .collect()
    }

    fn process_is_gone(pid: i32) -> bool {
        let deadline = std::time::Instant::now() + Duration::from_secs(3);
        while std::time::Instant::now() < deadline {
            if unsafe { libc::kill(pid, 0) } == -1
                && std::io::Error::last_os_error().raw_os_error() == Some(libc::ESRCH)
            {
                return true;
            }
            std::thread::sleep(Duration::from_millis(20));
        }
        unsafe { libc::kill(pid, libc::SIGKILL) };
        false
    }

    /// 卡死的假渲染撞上的时限。不能太短：并行跑测试时起一个 sh 要几百毫秒，太短的话 sh 还没
    /// 起好 `sleep` 就被杀了，测不到孙进程。
    const SHORT_TIMEOUT: Duration = Duration::from_secs(2);

    /// 文件出口共用 `DownloadGeneration` 的 2 个名额。以前页预览的渲染进程没有超时，一个让
    /// fitz 卡死的 PDF 打两次预览，名额就永远被占着，之后所有文件请求（连 translated.pdf
    /// 的下载）都排队，只能重启。
    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn a_hung_page_render_is_killed_and_frees_its_generation_slot() {
        use std::sync::Arc;

        use crate::download_generation::{DownloadGeneration, FileDownload};

        let case = case("hung");
        std::fs::remove_file(&case.cached).unwrap();
        let hung = hanging_python(&case.dir);
        let ok = fake_python(&case.dir, 0);
        let generation = Arc::new(DownloadGeneration::default());
        let render = |python: PathBuf, page: u32, timeout: Duration| {
            let dir = case.dir.clone();
            let source = case.source.clone();
            move || {
                let deps = DerivedArtifactDeps::new(python.to_str().unwrap());
                let output = dir.join(format!("preview-p{page}.jpg"));
                ensure_page_preview_within(deps, &output, &source, page, 1200, 0, timeout)
                    .map(|path| FileDownload::new(path, "image/jpeg", None))
            }
        };
        let started = std::time::Instant::now();
        let hung_renders: Vec<_> = (0..2)
            .map(|page| {
                let generation = Arc::clone(&generation);
                let work = render(hung.clone(), page, SHORT_TIMEOUT);
                tokio::spawn(async move { generation.run(format!("page-{page}"), work).await })
            })
            .collect();
        // 让两个卡死的渲染先占上名额。
        tokio::time::sleep(Duration::from_millis(100)).await;
        // 正常的渲染给足时间（起一个 sh 在这台机器上就要两三百毫秒），只让卡死的那两个撞上时限。
        let third = generation.run("page-2".to_string(), render(ok, 2, Duration::from_secs(10))).await;
        let elapsed = started.elapsed();
        for task in hung_renders {
            let error = task.await.unwrap().unwrap_err();
            assert!(
                matches!(&error, AppError::Internal(message) if message.contains("page-preview builder timed out")),
                "{error:?}"
            );
        }
        let third = third.expect("名额被卡死的渲染占着，后来的请求没轮上");
        assert_eq!(std::fs::read(&third.path).unwrap(), b"new");
        assert!(elapsed < Duration::from_secs(8), "等了 {elapsed:?} 才轮到第三个请求");
        let pids = sleep_pids(&case.dir);
        assert_eq!(pids.len(), 2, "{pids:?}");
        for pid in pids {
            assert!(process_is_gone(pid), "超时后渲染进程的子进程 {pid} 还活着");
        }
    }

    #[test]
    fn a_hung_cover_render_times_out_and_is_killed() {
        let case = case("hung-cover");
        let hung = hanging_python(&case.dir);
        let cover = case.dir.join("cover.jpg");
        let started = std::time::Instant::now();
        let error = render_book_image(hung.to_str().unwrap(), &case.source, &cover, 360, SHORT_TIMEOUT)
            .unwrap_err();
        assert!(
            matches!(&error, AppError::Internal(message) if message.contains("book-image builder timed out")),
            "{error:?}"
        );
        assert!(started.elapsed() < Duration::from_secs(6));
        assert!(!cover.exists(), "超时不能留下半截封面");
        for pid in sleep_pids(&case.dir) {
            assert!(process_is_gone(pid), "超时后渲染进程的子进程 {pid} 还活着");
        }
    }

    #[test]
    fn a_pdf_rerendered_while_its_page_was_rendering_is_rendered_again() {
        // 渲染读的是旧 PDF；换名出来的页图比新 PDF 还晚，以前按修改时间就一直被当成新鲜的。
        let case = case("raced");
        std::fs::remove_file(&case.cached).unwrap();
        let python = counting_python(&case.dir, true);
        let deps = DerivedArtifactDeps::new(python.to_str().unwrap());
        let first = ensure_page_preview(deps, &case.cached, &case.source, 0, 1200, 0).unwrap();
        assert_eq!(std::fs::read(&first).unwrap(), b"render-1", "这一次按请求时的 PDF 出图");
        let second = ensure_page_preview(deps, &case.cached, &case.source, 0, 1200, 0).unwrap();
        assert_eq!(std::fs::read(second).unwrap(), b"render-2", "渲染期间 PDF 换了，下一次要重新渲染");
        let third = ensure_page_preview(deps, &case.cached, &case.source, 0, 1200, 0).unwrap();
        assert_eq!(std::fs::read(third).unwrap(), b"render-2", "PDF 没再变，第三次用缓存");
    }

    /// 书的原文会变：单机下 Agent 文档操作提交以后，书的原文换成新版本（另一个文件）。
    /// 以前封面、缩略图只看文件在不在，旧图永远不更新。
    #[test]
    fn a_cover_cached_before_the_source_changed_is_rendered_again() {
        let case = case("cover-legacy");
        let cover = case.dir.join("cover.jpg");
        std::fs::write(&cover, b"old").unwrap();
        let now = SystemTime::now();
        set_mtime(&cover, now - Duration::from_secs(60));
        set_mtime(&case.source, now);
        let python = fake_python(&case.dir, 0);
        let deps = DerivedArtifactDeps::new(python.to_str().unwrap());
        let path = ensure_book_image_at_path(deps, &case.source, &cover, BookImageKind::Cover).unwrap();
        assert_eq!(std::fs::read(path).unwrap(), b"new", "原文比封面新，封面要重新渲染");
    }

    #[test]
    fn a_cover_follows_the_committed_source_version_and_is_reused_while_it_stays() {
        let case = case("cover-version");
        let cover = case.dir.join("thumbnail.jpg");
        let python = counting_python(&case.dir, false);
        let deps = DerivedArtifactDeps::new(python.to_str().unwrap());
        let kind = BookImageKind::Thumbnail;
        ensure_book_image_at_path(deps, &case.source, &cover, kind).unwrap();
        ensure_book_image_at_path(deps, &case.source, &cover, kind).unwrap();
        assert_eq!(std::fs::read(&cover).unwrap(), b"render-1", "原文没变，第二次用缓存");
        // 提交了新版本：书的原文换成另一个文件。修改时间故意比缩略图早（版本文件先落盘、
        // 后提交），只比修改时间也看不出来。
        let version = case.dir.join("version-2.pdf");
        std::fs::write(&version, b"%PDF-v2").unwrap();
        let cover_modified = std::fs::metadata(&cover).unwrap().modified().unwrap();
        set_mtime(&version, cover_modified - Duration::from_secs(60));
        ensure_book_image_at_path(deps, &version, &cover, kind).unwrap();
        assert_eq!(std::fs::read(&cover).unwrap(), b"render-2", "换了版本，缩略图要按新原文重新渲染");
        ensure_book_image_at_path(deps, &version, &cover, kind).unwrap();
        assert_eq!(std::fs::read(&cover).unwrap(), b"render-2");
    }

    #[test]
    fn a_pdf_rewritten_within_the_same_tick_is_rendered_again() {
        // 秒级精度的文件系统上，页图生成完、同一秒里 PDF 又被重写，两边修改时间相等，
        // 以前的 `>=` 判成新鲜。
        let case = case("same-tick");
        std::fs::remove_file(&case.cached).unwrap();
        let python = counting_python(&case.dir, false);
        let deps = DerivedArtifactDeps::new(python.to_str().unwrap());
        ensure_page_preview(deps, &case.cached, &case.source, 0, 1200, 0).unwrap();
        let cached_modified = std::fs::metadata(&case.cached).unwrap().modified().unwrap();
        std::fs::write(&case.source, b"%PDF-rerendered").unwrap();
        set_mtime(&case.source, cached_modified);
        let path = ensure_page_preview(deps, &case.cached, &case.source, 0, 1200, 0).unwrap();
        assert_eq!(std::fs::read(path).unwrap(), b"render-2");
    }
}
