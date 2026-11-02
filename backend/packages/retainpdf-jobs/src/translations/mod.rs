//! 译文：逐条看、人工改、修改历史、重翻一条。

mod artifacts;
pub(crate) mod common;
mod edits;
mod index;
mod item;
mod queries;
mod replay;
mod revision;
#[cfg(test)]
mod tests;

pub(crate) use artifacts::load_manifest_pages;
pub(crate) use index::load_translation_debug_list_view;
pub(crate) use item::load_translation_debug_item_view;
pub(crate) use replay::replay_translation_item;
pub(crate) use revision::{load_translation_revision_history, revise_translation_item};
