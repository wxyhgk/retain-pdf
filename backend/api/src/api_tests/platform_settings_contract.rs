//! 平台设置契约 `platform-settings.v1` 的生产者锁（设置类第 2 批第 3～5 组，2026-11-24）：字体、同步、备份、健康检查。
//!
//! 返回：打真实接口，拿 serde 实际写出来的 JSON，对着 backend-root/contracts 里的定义核对类型和键集合
//! （多一个键、少一个键都红）。请求：`SyncSettingsInput` 是 `deny_unknown_fields`，契约的 `properties` 要和 Rust 认的字段一样。

use super::credentials_contract::{assert_exact, ok_data};
use super::job_view_contract::contract;
use super::jobs_common::test_state;

const CONTRACT: &str = "platform-settings.v1.schema.json";

#[tokio::test]
async fn font_list_matches_published_schema() {
    let state = test_state("platform-settings-fonts");
    let contract = contract(CONTRACT);
    // 测试的字体目录里放一个文件，列表里至少有一项（系统字体有没有看机器）。
    let fonts_dir = state.config.data_root.join("fonts");
    std::fs::create_dir_all(&fonts_dir).unwrap();
    std::fs::write(fonts_dir.join("ContractTest-Regular.otf"), b"not really a font").unwrap();

    let fonts = ok_data(&state, "GET", "/api/v1/fonts", None).await;
    super::job_view_contract::assert_definition(&fonts, &contract, "FontListView", "fonts");
    let items = fonts.as_array().expect("fonts is an array");
    assert!(!items.is_empty(), "{fonts}");
    for (index, item) in items.iter().enumerate() {
        assert_exact(item, &contract, "FontInfo", &format!("fonts[{index}]"));
    }
}
