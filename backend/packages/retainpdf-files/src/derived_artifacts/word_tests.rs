use super::*;

#[test]
fn uses_the_installed_pipeline_command_with_the_layout_docx_subcommand() {
    // Rust 这边起的是**装好的** `retainpdf-pipeline`,不是仓库里的源码。导出代码
    // 原来住在 `devtools/`(不在发布包里),从这条路径根本 import 不到。
    let deps =
        DerivedArtifactDeps::with_pipeline_command("python3", "/opt/retainpdf/bin/retainpdf-pipeline");
    let mut command = std::process::Command::new(deps.pipeline_command);
    command.arg("layout-docx");
    assert_eq!(
        command.get_program(),
        "/opt/retainpdf/bin/retainpdf-pipeline"
    );
    assert_eq!(
        command.get_args().collect::<Vec<_>>(),
        vec![std::ffi::OsStr::new("layout-docx")]
    );
}

#[test]
fn different_dpi_is_a_different_artifact() {
    // 背景位图的清晰度直接决定文件大小。两个 DPI 共用一个缓存键的话,先请求的那个
    // 会被后面的人拿到——拿到的是一份和自己要的不一样的文档。
    let low = LayoutDocxOptions { dpi: 96, watermark: false };
    let high = LayoutDocxOptions { dpi: 300, watermark: false };
    assert_ne!(low.cache_suffix(), high.cache_suffix());
    // 带不带水印也是两份
    assert_ne!(low.cache_suffix(), LayoutDocxOptions { dpi: 96, watermark: true }.cache_suffix());
    assert_eq!(
        LayoutDocxOptions::default().dpi,
        DEFAULT_BACKGROUND_DPI,
        "默认 DPI 变了的话,老缓存会全部失效并重建一遍"
    );
}

/// 导出逻辑改了之后，旧产物必须**不被命中**。
///
/// 缓存只比输入文件的 mtime（源 PDF、译文 PDF），代码改动不是输入。真发生过：
/// 2026-10-05 连修三个排版缺陷，用户每次下载拿到的都是修复前生成的那一份，表现是
/// 「改了半天一点变化都没有」。所以渲染器版本要进缓存键。
#[test]
fn the_renderer_version_is_part_of_the_cache_key() {
    let suffix = LayoutDocxOptions::default().cache_suffix();
    assert!(
        suffix.contains(&format!("v{RENDERER_VERSION}")),
        "缓存键里没有渲染器版本（{suffix}）—— 改了导出逻辑，用户还是会拿到旧 docx"
    );
    // 正对照：DPI 也还在，别把一个挤掉另一个。
    assert!(suffix.contains("dpi"), "缓存键里没有 DPI 了");
}

/// 手改译文只原子改写 `translated/` 里的页文件和断点（`revision.py`），`rerender` 默认关：两个 PDF 都不变。
/// 正文却是 Python 从 `translated/` 的 manifest 和页文件读的（`word/job_io.py`），新鲜度以前只看两个 PDF，
/// 改了译文下载的 Word 还是旧的；只翻译、没有译文 PDF 的任务永远不更新（S34、A-R1）。
#[test]
fn revising_the_translation_by_hand_makes_the_cached_docx_stale() {
    let root = std::env::temp_dir().join(format!("retain-word-inputs-{:016x}", fastrand::u64(..)));
    let translated = root.join("job").join("translated");
    std::fs::create_dir_all(&translated).unwrap();
    let source_pdf = root.join("source.pdf");
    let translated_pdf = root.join("translated.pdf");
    std::fs::write(&source_pdf, b"%PDF source").unwrap();
    std::fs::write(&translated_pdf, b"%PDF translated").unwrap();
    std::fs::write(translated.join("translation-manifest.json"), br#"{"pages":[{"path":"page-001.json"}]}"#).unwrap();
    std::fs::write(translated.join("page-001.json"), br#"[{"translated_text":"old"}]"#).unwrap();
    let checkpoint = translated.join("translation-checkpoint.v1.json");
    std::fs::write(&checkpoint, br#"{"generation":3}"#).unwrap();

    for translated_pdf in [Some(translated_pdf.as_path()), None] {
        let output = root.join(format!("out-{}.docx", translated_pdf.is_some()));
        let inputs = layout_docx_inputs(&root.join("job"), &source_pdf, translated_pdf);
        let inputs: Vec<&Path> = inputs.iter().map(PathBuf::as_path).collect();
        super::super::side_by_side::build_with_command(&output, "layout-docx", Duration::from_secs(30), &inputs, |temporary| {
            let mut command = std::process::Command::new("/bin/sh");
            command.arg("-c").arg("printf docx > \"$0\"").arg(temporary);
            command
        })
        .unwrap();
        assert!(cached_output_is_fresh(&output, &inputs).unwrap());

        // 和 Python 一样：写临时文件再换名；manifest、两个 PDF 都不动。
        std::fs::write(translated.join(".page.tmp"), br#"[{"translated_text":"new"}]"#).unwrap();
        std::fs::rename(translated.join(".page.tmp"), translated.join("page-001.json")).unwrap();
        let generation = std::fs::read_to_string(&checkpoint).unwrap();
        std::fs::write(translated.join(".checkpoint.tmp"), format!("{generation} ")).unwrap();
        std::fs::rename(translated.join(".checkpoint.tmp"), &checkpoint).unwrap();

        let inputs = layout_docx_inputs(&root.join("job"), &source_pdf, translated_pdf);
        let inputs: Vec<&Path> = inputs.iter().map(PathBuf::as_path).collect();
        assert!(
            !cached_output_is_fresh(&output, &inputs).unwrap(),
            "改了译文，Word 必须重新导出（有没有译文 PDF 都一样）: translated_pdf={translated_pdf:?}"
        );
    }
    std::fs::remove_dir_all(root).unwrap();
}
