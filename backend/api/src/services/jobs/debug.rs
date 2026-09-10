#[path = "debug/artifacts.rs"]
mod artifacts;
#[path = "debug/common.rs"]
mod common;
#[path = "debug/diagnostics.rs"]
mod diagnostics;
#[path = "debug/index.rs"]
mod index;
#[path = "debug/item.rs"]
mod item;
#[path = "debug/replay.rs"]
mod replay;
#[cfg(test)]
#[path = "debug/tests.rs"]
mod tests;

pub(crate) use diagnostics::load_translation_diagnostics_view;
pub(crate) use index::load_translation_debug_list_view;
pub(crate) use item::load_translation_debug_item_view;
pub(crate) use replay::replay_translation_item;
