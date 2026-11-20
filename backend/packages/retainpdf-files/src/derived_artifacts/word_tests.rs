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
