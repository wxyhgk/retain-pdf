//! 清单 `backend/config/runtime_assets.json`（编译时嵌入；Python 那边读下载好之后写的 current.json，不读清单）。

use once_cell::sync::Lazy;
use serde::Deserialize;

const MANIFEST_JSON: &str = include_str!("../../../../config/runtime_assets.json");

#[derive(Debug, Clone, Deserialize)]
pub(crate) struct Manifest {
    pub registries: Vec<Registry>,
    assets: ManifestAssets,
}

#[derive(Debug, Clone, Deserialize)]
pub(crate) struct Registry {
    pub name: String,
    pub url: String,
    #[serde(default)]
    pub preferred_time_zones: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
struct ManifestAssets {
    fonts: PackageSpec,
    typst: TypstSpec,
}

#[derive(Debug, Clone, Deserialize)]
pub(crate) struct PackageSpec {
    #[serde(default)]
    pub title: String,
    #[serde(default)]
    pub version: String,
    pub package: String,
    pub package_version: String,
    pub files: Vec<FileSpec>,
}

#[derive(Debug, Clone, Deserialize)]
struct TypstSpec {
    title: String,
    version: String,
    platforms: std::collections::BTreeMap<String, PackageSpec>,
}

#[derive(Debug, Clone, Deserialize)]
pub(crate) struct FileSpec {
    pub path: String,
    pub sha256: String,
    pub size: u64,
    #[serde(default)]
    pub executable: bool,
}

/// 一份要按需下载的资源（这台机器、这个平台上的）。
#[derive(Debug, Clone)]
pub(crate) struct AssetSpec {
    /// `fonts`、`typst`：缓存目录名、current.json 的键、接口里的编号。
    pub id: &'static str,
    pub title: String,
    pub version: String,
    /// 缓存目录 `<id>/<dir_name>`。
    pub dir_name: String,
    pub package: PackageSpec,
    /// 下好以后要执行的那个文件（Typst）；字体没有。
    pub bin: Option<String>,
}

impl AssetSpec {
    pub fn total_bytes(&self) -> u64 {
        self.package.files.iter().map(|file| file.size).sum()
    }
}

pub(crate) static MANIFEST: Lazy<Manifest> = Lazy::new(|| {
    serde_json::from_str(MANIFEST_JSON).expect("backend/config/runtime_assets.json 必须是合法的清单")
});

/// 这台机器的平台键，和清单里 Typst 的 platforms 一致。
pub(crate) fn current_platform() -> &'static str {
    match (std::env::consts::OS, std::env::consts::ARCH) {
        ("macos", "aarch64") => "darwin-arm64",
        ("macos", "x86_64") => "darwin-x64",
        ("linux", "x86_64") => "linux-x64",
        ("linux", "aarch64") => "linux-arm64",
        ("windows", "x86_64") => "win32-x64",
        ("windows", "aarch64") => "win32-arm64",
        _ => "unknown",
    }
}

/// 这台机器要的资源：字体，和这个平台的 Typst（清单里没有这个平台就不列）。
pub(crate) fn assets_for_this_machine() -> Vec<AssetSpec> {
    assets_for_platform(&MANIFEST, current_platform())
}

pub(crate) fn assets_for_platform(manifest: &Manifest, platform: &str) -> Vec<AssetSpec> {
    let fonts = &manifest.assets.fonts;
    let mut assets = vec![AssetSpec {
        id: "fonts",
        title: fonts.title.clone(),
        version: fonts.version.clone(),
        dir_name: fonts.version.clone(),
        package: fonts.clone(),
        bin: None,
    }];
    let typst = &manifest.assets.typst;
    if let Some(package) = typst.platforms.get(platform) {
        let bin = package.files.iter().find(|file| file.executable).map(|file| file.path.clone());
        assets.push(AssetSpec {
            id: "typst",
            title: typst.title.clone(),
            version: typst.version.clone(),
            dir_name: format!("{}-{platform}", typst.version),
            package: package.clone(),
            bin,
        });
    }
    assets
}
