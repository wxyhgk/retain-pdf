use crate::error::AppError;
use crate::models::{
    LibraryBatchDeleteInput, LibraryBatchDeleteResultView, LibraryBookDetailView,
    LibraryBookListView, LibraryDeleteResultView, ListJobsQuery,
};

use super::library::{
    delete_library_book, delete_library_books, get_library_book, list_library_books, LibraryDeps,
};

pub fn list_library_books_view(
    deps: &LibraryDeps<'_>,
    query: &ListJobsQuery,
    base_url: &str,
) -> Result<LibraryBookListView, AppError> {
    list_library_books(deps, query, base_url)
}

pub fn get_library_book_view(
    deps: &LibraryDeps<'_>,
    job_id: &str,
    base_url: &str,
) -> Result<LibraryBookDetailView, AppError> {
    get_library_book(deps, job_id, base_url)
}

pub fn delete_library_book_view(
    deps: &LibraryDeps<'_>,
    job_id: &str,
    force: bool,
) -> Result<LibraryDeleteResultView, AppError> {
    delete_library_book(deps, job_id, force)
}

pub fn delete_library_books_view(
    deps: &LibraryDeps<'_>,
    input: &LibraryBatchDeleteInput,
) -> Result<LibraryBatchDeleteResultView, AppError> {
    delete_library_books(deps, input)
}
