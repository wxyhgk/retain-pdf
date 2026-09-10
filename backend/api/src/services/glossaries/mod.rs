//! Glossary HTTP entry points and task glossary resolution.

pub(crate) mod api;
mod csv;
mod entries;
mod records;

#[cfg(test)]
use csv::{parse_glossary_csv, parse_glossary_csv_text};
pub(crate) use entries::resolve_task_glossary_request;
#[cfg(test)]
use entries::{merge_glossary_entries, normalize_glossary_entries, MAX_GLOSSARY_ENTRIES};
#[cfg(test)]
use records::{
    create_glossary, delete_glossary, filter_glossaries, list_glossaries, load_glossary_or_404,
    update_glossary,
};

#[cfg(test)]
mod tests;
