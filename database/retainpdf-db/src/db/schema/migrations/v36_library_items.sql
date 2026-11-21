-- 2026-11-21：书库换成「条目主表 + 各类型明细表」（数据库重做第 5a 步，
-- docs/ops/planning/database-redesign/20261121-书库条目模型.md）。
--
-- 以前一本书是 `documents` 一行，书目信息（书名、作者、年份、DOI）和 PDF 文件（文件名、大小、页数、阅读状态）揉在一起，
-- 书名来源另在 `document_title_state`，选哪份译文另在 `translation_version_choices`。后面要加笔记、文献管理、划线，
-- 拆成：
-- - `library_items`：条目主表，每个条目一行（现在只有文献 `reference`，以后有笔记、批注、插件的类型）；
-- - `item_references`：文献的书目信息，常用字段是列，其余 CSL 字段整块放 `extra_csl_json`；书名来源和锁并进来；
-- - `item_creators`：作者、编者……一人一行（以前是 `documents.authors_json` 一坨 JSON）；
-- - `item_files`：条目下的文件（PDF），**就是原来的 `documents` 原地改名**，`file_id` 是 PDF 内容的 sha256（原来的 `document_id`）。
--   原地改名而不是重建：译文版本、文件夹成员挂在它下面（外键级联），重建要删旧表，会把它们连带删掉；改名时 SQLite 把指向它的
--   外键一起改过来。`item_id` 用 ADD COLUMN 加的外键列只能可空，由触发器守着不许为空。
--   `chosen_version_id`（这本书选了哪份译文，空 = 自动逐页取最新）替代 `translation_version_choices`，只在本机、不同步。
-- - `item_title_suggestions`：书名建议改挂在条目上（原来的 `document_metadata_suggestions`，没人指向它，重建）。
--
-- 上传 PDF 时自动建的条目，编号就用 PDF 的内容指纹（item_id = file_id = 以前的 document_id）：接口里的 document_id 不变，
-- 两台设备传同一个 PDF 还是同一本书。以后手工建的、导入的条目和笔记用随机编号。
-- `documents.active_version_id` 是早已删掉的 AI 改写功能留下的列（真实库全空），删掉；`owner_user_id` 挪到条目上。
-- 接口不变：一本书（`DocumentRecord`）从视图 `library_documents` 读，见文件末尾。
-- 文件夹成员（`collection_documents`）照旧指向文件，第 5b 步放宽到任何条目。

CREATE TABLE library_items (
    item_id TEXT PRIMARY KEY,
    item_type TEXT NOT NULL CHECK (item_type IN ('reference', 'note', 'annotation') OR item_type LIKE 'plugin:%'),
    parent_item_id TEXT REFERENCES library_items(item_id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT,
    owner_user_id TEXT NOT NULL DEFAULT 'local'
);
CREATE INDEX idx_library_items_parent ON library_items(parent_item_id) WHERE parent_item_id IS NOT NULL;
CREATE INDEX idx_library_items_owner ON library_items(owner_user_id);

-- 字段名照 CSL-JSON（导出引用格式时整块拼回去）：csl_type = CSL 的 type，issued = 出版日期原样，year 是从里面取的年份（查询、排序用）。
CREATE TABLE item_references (
    item_id TEXT PRIMARY KEY REFERENCES library_items(item_id) ON DELETE CASCADE,
    csl_type TEXT NOT NULL DEFAULT 'document',
    title TEXT NOT NULL DEFAULT '',
    -- 书名从哪来：filename（上传时的文件名）/ ocr / pdf_metadata（书名建议）/ user（用户改的）。
    title_source TEXT NOT NULL DEFAULT 'filename',
    -- 用户改过就锁住，书名建议不再自动改它。
    title_locked INTEGER NOT NULL DEFAULT 0 CHECK (title_locked IN (0, 1)),
    title_suggestion_id TEXT,
    short_title TEXT NOT NULL DEFAULT '',
    issued TEXT NOT NULL DEFAULT '',
    year INTEGER,
    container_title TEXT NOT NULL DEFAULT '',
    volume TEXT NOT NULL DEFAULT '',
    issue TEXT NOT NULL DEFAULT '',
    pages TEXT NOT NULL DEFAULT '',
    publisher TEXT NOT NULL DEFAULT '',
    doi TEXT NOT NULL DEFAULT '',
    isbn TEXT NOT NULL DEFAULT '',
    url TEXT NOT NULL DEFAULT '',
    language TEXT NOT NULL DEFAULT '',
    abstract TEXT NOT NULL DEFAULT '',
    extra_csl_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(extra_csl_json))
);

-- 机构作者这类没有姓名之分的写 literal；显示名 = literal，没有就「名 姓」。
CREATE TABLE item_creators (
    item_id TEXT NOT NULL REFERENCES library_items(item_id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    role TEXT NOT NULL DEFAULT 'author',
    family TEXT NOT NULL DEFAULT '',
    given TEXT NOT NULL DEFAULT '',
    literal TEXT NOT NULL DEFAULT '',
    PRIMARY KEY (item_id, position)
);

INSERT INTO library_items (item_id, item_type, created_at, updated_at, owner_user_id)
SELECT document_id, 'reference', added_at, updated_at, owner_user_id FROM documents;

INSERT INTO item_references (item_id, title, title_source, title_locked, title_suggestion_id, year, doi)
SELECT d.document_id, d.title, COALESCE(ts.source, 'filename'),
       CASE WHEN COALESCE(ts.locked, 0) <> 0 THEN 1 ELSE 0 END, ts.suggestion_id, d.year, d.doi
FROM documents d
LEFT JOIN document_title_state ts ON ts.document_id = d.document_id;

INSERT INTO item_creators (item_id, position, literal)
SELECT d.document_id, CAST(author.key AS INTEGER),
       CASE WHEN author.type = 'text' THEN author.value ELSE CAST(author.value AS TEXT) END
FROM documents d, json_each(d.authors_json) AS author
WHERE json_valid(d.authors_json) AND json_type(d.authors_json) = 'array';

-- documents → item_files（原地改名，见开头）。
DROP TRIGGER IF EXISTS documents_inherit_owner;
DROP TRIGGER IF EXISTS sync_dirty_documents_insert;
DROP TRIGGER IF EXISTS sync_dirty_documents_update;
DROP TRIGGER IF EXISTS sync_dirty_documents_delete;
DROP INDEX IF EXISTS idx_documents_owner;
DROP INDEX IF EXISTS idx_documents_added_at;
ALTER TABLE documents RENAME TO item_files;
ALTER TABLE item_files RENAME COLUMN document_id TO file_id;
ALTER TABLE item_files ADD COLUMN item_id TEXT REFERENCES library_items(item_id) ON DELETE CASCADE;
UPDATE item_files SET item_id = file_id;
ALTER TABLE item_files ADD COLUMN chosen_version_id TEXT REFERENCES translation_versions(version_id) ON DELETE SET NULL;
UPDATE item_files SET chosen_version_id = (
    SELECT c.version_id FROM translation_version_choices c WHERE c.document_id = item_files.file_id
);
ALTER TABLE item_files DROP COLUMN title;
ALTER TABLE item_files DROP COLUMN authors_json;
ALTER TABLE item_files DROP COLUMN year;
ALTER TABLE item_files DROP COLUMN doi;
ALTER TABLE item_files DROP COLUMN active_version_id;
ALTER TABLE item_files DROP COLUMN owner_user_id;
CREATE INDEX idx_item_files_item ON item_files(item_id);
CREATE INDEX idx_item_files_added_at ON item_files(added_at DESC);
CREATE TRIGGER item_files_item_required_insert BEFORE INSERT ON item_files WHEN NEW.item_id IS NULL
BEGIN
    SELECT RAISE(ABORT, 'item_files.item_id is required');
END;
CREATE TRIGGER item_files_item_required_update BEFORE UPDATE OF item_id ON item_files WHEN NEW.item_id IS NULL
BEGIN
    SELECT RAISE(ABORT, 'item_files.item_id is required');
END;

DROP TABLE translation_version_choices;
DROP TABLE document_title_state;

CREATE TABLE item_title_suggestions (
    suggestion_id TEXT PRIMARY KEY,
    item_id TEXT NOT NULL REFERENCES library_items(item_id) ON DELETE CASCADE,
    source_job_id TEXT,
    artifact_sha256 TEXT NOT NULL,
    fields_json TEXT NOT NULL DEFAULT '["title"]',
    candidates_json TEXT NOT NULL,
    selected_title TEXT NOT NULL,
    generation_method TEXT NOT NULL DEFAULT 'deterministic',
    needs_ai_review INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'completed',
    applied_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
INSERT INTO item_title_suggestions (
    suggestion_id, item_id, source_job_id, artifact_sha256, fields_json, candidates_json, selected_title,
    generation_method, needs_ai_review, status, applied_at, created_at, updated_at
)
SELECT s.suggestion_id, f.item_id, s.source_job_id, s.artifact_sha256, s.fields_json, s.candidates_json, s.selected_title,
       s.generation_method, s.needs_ai_review, s.status, s.applied_at, s.created_at, s.updated_at
FROM document_metadata_suggestions s
JOIN item_files f ON f.file_id = s.document_id;
DROP TABLE document_metadata_suggestions;
CREATE INDEX idx_item_title_suggestions_item ON item_title_suggestions(item_id, created_at DESC, suggestion_id DESC);
CREATE UNIQUE INDEX idx_item_title_suggestions_evidence ON item_title_suggestions(
    item_id, COALESCE(source_job_id, ''), artifact_sha256, selected_title
);

-- 多用户模式的归属：自动建的条目跟着同一个文件最早那次上传（以前是 documents 的同名触发器）。
CREATE TRIGGER library_items_inherit_owner AFTER INSERT ON library_items
BEGIN
    UPDATE library_items SET owner_user_id = COALESCE(
        (SELECT u.owner_user_id FROM uploads u WHERE u.content_hash = NEW.item_id ORDER BY u.uploaded_at LIMIT 1),
        owner_user_id
    )
    WHERE item_id = NEW.item_id AND owner_user_id = 'local';
END;

-- 同步：一个文献条目连同它的书目、作者、文件、书名建议是一个同步实体（种类照旧叫 document，键是 item_id）。
CREATE TRIGGER sync_dirty_library_items_insert AFTER INSERT ON library_items
WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard)
BEGIN
    INSERT INTO sync_dirty(kind, entity_key, changed_at)
    VALUES('document', NEW.item_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at;
END;
CREATE TRIGGER sync_dirty_library_items_update AFTER UPDATE ON library_items
WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard)
BEGIN
    INSERT INTO sync_dirty(kind, entity_key, changed_at)
    VALUES('document', NEW.item_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at;
END;
CREATE TRIGGER sync_dirty_library_items_delete AFTER DELETE ON library_items
WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard)
BEGIN
    INSERT INTO sync_dirty(kind, entity_key, changed_at)
    VALUES('document', OLD.item_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at;
END;
CREATE TRIGGER sync_dirty_item_references_insert AFTER INSERT ON item_references
WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard)
BEGIN
    INSERT INTO sync_dirty(kind, entity_key, changed_at)
    VALUES('document', NEW.item_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at;
END;
CREATE TRIGGER sync_dirty_item_references_update AFTER UPDATE ON item_references
WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard)
BEGIN
    INSERT INTO sync_dirty(kind, entity_key, changed_at)
    VALUES('document', NEW.item_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at;
END;
CREATE TRIGGER sync_dirty_item_references_delete AFTER DELETE ON item_references
WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard)
BEGIN
    INSERT INTO sync_dirty(kind, entity_key, changed_at)
    VALUES('document', OLD.item_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at;
END;
CREATE TRIGGER sync_dirty_item_creators_insert AFTER INSERT ON item_creators
WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard)
BEGIN
    INSERT INTO sync_dirty(kind, entity_key, changed_at)
    VALUES('document', NEW.item_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at;
END;
CREATE TRIGGER sync_dirty_item_creators_update AFTER UPDATE ON item_creators
WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard)
BEGIN
    INSERT INTO sync_dirty(kind, entity_key, changed_at)
    VALUES('document', NEW.item_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at;
END;
CREATE TRIGGER sync_dirty_item_creators_delete AFTER DELETE ON item_creators
WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard)
BEGIN
    INSERT INTO sync_dirty(kind, entity_key, changed_at)
    VALUES('document', OLD.item_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at;
END;
CREATE TRIGGER sync_dirty_item_files_insert AFTER INSERT ON item_files
WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard)
BEGIN
    INSERT INTO sync_dirty(kind, entity_key, changed_at)
    VALUES('document', NEW.item_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at;
END;
CREATE TRIGGER sync_dirty_item_files_update AFTER UPDATE ON item_files
WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard)
BEGIN
    INSERT INTO sync_dirty(kind, entity_key, changed_at)
    VALUES('document', NEW.item_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at;
END;
CREATE TRIGGER sync_dirty_item_files_delete AFTER DELETE ON item_files
WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard)
BEGIN
    INSERT INTO sync_dirty(kind, entity_key, changed_at)
    VALUES('document', OLD.item_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at;
END;
CREATE TRIGGER sync_dirty_item_title_suggestions_insert AFTER INSERT ON item_title_suggestions
WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard)
BEGIN
    INSERT INTO sync_dirty(kind, entity_key, changed_at)
    VALUES('document', NEW.item_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at;
END;
CREATE TRIGGER sync_dirty_item_title_suggestions_update AFTER UPDATE ON item_title_suggestions
WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard)
BEGIN
    INSERT INTO sync_dirty(kind, entity_key, changed_at)
    VALUES('document', NEW.item_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at;
END;
CREATE TRIGGER sync_dirty_item_title_suggestions_delete AFTER DELETE ON item_title_suggestions
WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard)
BEGIN
    INSERT INTO sync_dirty(kind, entity_key, changed_at)
    VALUES('document', OLD.item_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at;
END;

-- 一本书（接口的 DocumentRecord）：一个文件 + 它所属条目的书目信息。document_id 就是文件的内容指纹。
-- 改了什么就按条目、文件两边较新的那个时间算 updated_at（改书名动条目，改阅读状态、换任务动文件）。
CREATE VIEW library_documents AS
SELECT
    f.file_id AS document_id,
    f.item_id,
    i.owner_user_id,
    COALESCE(r.title, '') AS title,
    COALESCE(r.title_source, 'filename') AS title_source,
    COALESCE(r.title_locked, 0) AS title_locked,
    (
        SELECT json_group_array(
            CASE WHEN c.literal <> '' THEN c.literal ELSE trim(c.given || ' ' || c.family) END ORDER BY c.position
        )
        FROM item_creators c
        WHERE c.item_id = f.item_id AND c.role = 'author'
    ) AS authors_json,
    r.year,
    COALESCE(r.doi, '') AS doi,
    f.source_filename,
    f.page_count,
    f.bytes,
    f.active_job_id,
    f.chosen_version_id,
    f.reading_status,
    f.added_at,
    f.last_opened_at,
    MAX(i.updated_at, f.updated_at) AS updated_at
FROM item_files f
JOIN library_items i ON i.item_id = f.item_id
LEFT JOIN item_references r ON r.item_id = f.item_id;
