#[path = "input/ocr.rs"]
mod ocr;
#[path = "input/render.rs"]
mod render;
#[path = "input/request.rs"]
mod request;
#[path = "input/resolved.rs"]
mod resolved;
#[path = "input/runtime.rs"]
mod runtime;
#[path = "input/source.rs"]
mod source;
#[cfg(test)]
#[path = "input/tests.rs"]
mod tests;
#[path = "input/translation.rs"]
mod translation;

pub use ocr::OcrInput;
pub use render::{RenderInput, DEFAULT_SOURCE_CLEANUP_STRATEGY, SOURCE_CLEANUP_STRATEGIES};
pub use request::CreateJobInput;
pub use resolved::ResolvedJobSpec;
pub use runtime::RuntimeInput;
pub use source::{JobSourceInput, ResolvedSourceSpec};
pub use translation::{GlossaryEntryInput, TranslationInput};
pub use translation::{
    TRANSLATION_CONTEXT_MODES, TRANSLATION_GLOSSARY_MODES, TRANSLATION_MATH_MODES,
    TRANSLATION_MEMORY_MODES, TRANSLATION_PREPARATION_MODES,
};
