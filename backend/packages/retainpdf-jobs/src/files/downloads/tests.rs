use std::sync::Arc;

use retainpdf_api_base::error::AppError;
use crate::views::PagePreviewQuery;

use super::fixture::{DownloadFixture as Fixture, JOB_ID};
use crate::files::downloads::{Disposition, JobFile};

fn preview(kind: &str, width: u32, dpi: u32) -> PagePreviewQuery {
    PagePreviewQuery {
        kind: kind.into(),
        width: Some(width),
        dpi: Some(dpi),
    }
}

#[tokio::test(flavor = "current_thread")]
async fn same_normalized_preview_shares_cache_miss_and_keeps_runtime_responsive() {
    let fixture = Fixture::new();
    let downloads = fixture.downloads();
    let wide = preview(" SOURCE ", 9999, 999);
    let normalized = preview("source", 2400, 300);
    let (first, second, ()) = tokio::join!(
        downloads.open(JOB_ID, JobFile::page(1, &wide), Disposition::Inline),
        downloads.open(JOB_ID, JobFile::page(1, &normalized), Disposition::Inline),
        fixture.release_when_started(),
    );
    let first = first.unwrap();
    assert_eq!(first.path, second.unwrap().path);
    assert_eq!(
        first.path.file_name().unwrap(),
        "preview-source-p0001-w2400-d300.jpg"
    );
    assert_eq!(fixture.render_count(), 1);
    let cached = downloads
        .open(JOB_ID, JobFile::page(1, &normalized), Disposition::Inline)
        .await
        .unwrap();
    assert_eq!(cached.path, first.path);
    assert_eq!(
        fixture.render_count(),
        1,
        "completed requests use the file cache"
    );
}

#[tokio::test]
async fn different_preview_specs_never_share_results() {
    let fixture = Fixture::new();
    let downloads = fixture.downloads();
    let source = preview("source", 1200, 0);
    let translated = preview("translated", 1200, 0);
    let (first, second, ()) = tokio::join!(
        downloads.open(JOB_ID, JobFile::page(1, &source), Disposition::Inline),
        downloads.open(JOB_ID, JobFile::page(1, &translated), Disposition::Inline),
        fixture.release_when_started(),
    );
    let first = first.unwrap().path;
    assert_ne!(first, second.unwrap().path);
    let other_page = downloads
        .open(JOB_ID, JobFile::page(2, &source), Disposition::Inline)
        .await
        .unwrap()
        .path;
    let other_width = downloads
        .open(JOB_ID, JobFile::page(1, &preview("source", 1600, 0)), Disposition::Inline)
        .await
        .unwrap()
        .path;
    let other_dpi = downloads
        .open(JOB_ID, JobFile::page(1, &preview("source", 1200, 72)), Disposition::Inline)
        .await
        .unwrap()
        .path;
    let paths = [first, other_page, other_width, other_dpi]
        .into_iter()
        .collect::<std::collections::HashSet<_>>();
    assert_eq!(paths.len(), 4);
    assert_eq!(fixture.render_count(), 5);
}

#[tokio::test(flavor = "current_thread")]
async fn cover_and_thumbnail_share_duplicate_requests_but_not_each_other() {
    let fixture = Fixture::new();
    let downloads = fixture.downloads();
    let (cover, duplicate_cover, thumbnail, ()) = tokio::join!(
        downloads.open(JOB_ID, JobFile::Cover, Disposition::Inline),
        downloads.open(JOB_ID, JobFile::Cover, Disposition::Inline),
        downloads.open(JOB_ID, JobFile::Thumbnail, Disposition::Inline),
        fixture.release_when_started(),
    );
    let cover = cover.unwrap().path;
    assert_eq!(cover, duplicate_cover.unwrap().path);
    assert_ne!(cover, thumbnail.unwrap().path);
    assert_eq!(fixture.render_count(), 2);
    downloads.open(JOB_ID, JobFile::Cover, Disposition::Inline).await.unwrap();
    downloads.open(JOB_ID, JobFile::Thumbnail, Disposition::Inline).await.unwrap();
    assert_eq!(fixture.render_count(), 2);
}

#[tokio::test]
async fn canceled_preview_request_leaves_one_live_writer_for_next_caller() {
    let fixture = Arc::new(Fixture::new());
    let owner = fixture.clone();
    let first = tokio::spawn(async move {
        owner
            .downloads()
            .open(JOB_ID, JobFile::page(1, &preview("source", 1200, 0)), Disposition::Inline)
            .await
    });
    fixture.wait_started().await;
    first.abort();
    assert!(first.await.unwrap_err().is_cancelled());
    let downloads = fixture.downloads();
    let query = preview("source", 1200, 0);
    let (joined, ()) = tokio::join!(
        downloads.open(JOB_ID, JobFile::page(1, &query), Disposition::Inline),
        fixture.release_when_started(),
    );
    assert!(joined.unwrap().path.is_file());
    assert_eq!(fixture.render_count(), 1);
}

#[tokio::test]
async fn preview_validation_keeps_job_scope_before_parameter_errors() {
    let fixture = Fixture::new();
    let downloads = fixture.downloads();
    let invalid = preview("invalid", 0, 0);
    assert!(matches!(
        downloads
            .open("missing", JobFile::page(0, &invalid), Disposition::Inline)
            .await,
        Err(AppError::NotFound(_))
    ));
    assert!(matches!(
        downloads.open(JOB_ID, JobFile::page(0, &invalid), Disposition::Inline).await,
        Err(AppError::BadRequest(_))
    ));
    assert!(matches!(
        downloads
            .open(JOB_ID, JobFile::page(0, &preview("source", 1200, 0)), Disposition::Inline)
            .await,
        Err(AppError::BadRequest(_))
    ));
    assert_eq!(fixture.render_count(), 0);
}

#[tokio::test(flavor = "current_thread")]
async fn downloads_carry_the_watermark_by_default_and_reuse_the_stamped_copy() {
    // 2026-11-20：下载的译文 PDF 默认盖水印（retainpdf-pipeline watermark-pdf 按需生成、缓存），`?watermark=0` 取原版。
    use std::os::unix::fs::PermissionsExt;
    let fixture = Fixture::new();
    let pipeline = fixture.root.join("pipeline");
    std::fs::write(
        &pipeline,
        "#!/bin/sh\nprintf '%s\\n' \"$1\" >> \"$0.calls\"\nwhile [ $# -gt 0 ]; do\n  if [ \"$1\" = --output-pdf ]; then printf 'stamped pdf' > \"$2\"; fi\n  shift\ndone\n",
    )
    .unwrap();
    std::fs::set_permissions(&pipeline, std::fs::Permissions::from_mode(0o755)).unwrap();
    let pipeline_command = pipeline.to_string_lossy().into_owned();
    let downloads = crate::files::downloads::JobDownloads::new(
        &fixture.db,
        &fixture.root,
        &fixture.root,
        &fixture.generation,
        &fixture.renderer,
        &pipeline_command,
    );
    let stamped = downloads.open(JOB_ID, JobFile::TranslatedPdf { watermark: true }, Disposition::Inline).await.unwrap();
    assert_eq!(std::fs::read(&stamped.path).unwrap(), b"stamped pdf");
    let again = downloads.open(JOB_ID, JobFile::TranslatedPdf { watermark: true }, Disposition::Inline).await.unwrap();
    assert_eq!(again.path, stamped.path);
    let plain = downloads.open(JOB_ID, JobFile::TranslatedPdf { watermark: false }, Disposition::Inline).await.unwrap();
    assert_eq!(std::fs::read(&plain.path).unwrap(), b"translated");
    let calls = std::fs::read_to_string(fixture.root.join("pipeline.calls")).unwrap();
    assert_eq!(calls.lines().collect::<Vec<_>>(), ["watermark-pdf"], "盖一次，之后用缓存");
}
