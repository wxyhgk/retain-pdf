-- 2026-11-21：书库条目第 5b 步（docs/ops/planning/database-redesign/20261121-书库条目模型.md）。
--
-- - 文件夹成员 `collection_documents`（成员是书的文件）重建成 `collection_items`（成员是任何条目）。没有表指向它，重建安全。
--   同步种类照旧叫 collection_member，键照旧是「文件夹编号|成员编号」（自动建的条目编号就是文件的内容指纹，值不变）。
-- - 标签 `tags` 和条目的标签 `item_tags`（多对多，任何条目都能打）。标签编号由名字算出来（见数据库层 `tags.rs`），
--   两台设备各自建了同名标签同步后是同一个；名字不加唯一约束（同步写入时撞了会卡住），重名由建标签时查重挡住。
-- - 条目之间的关联 `item_relations`（相关、引用、由……生成，例如笔记由划线生成）。挂在主语条目上一起同步。
-- 回收站用 5a 已有的 `library_items.deleted_at`，这一步不加接口（用户 11-21 定）。

CREATE TABLE collection_items (
    collection_id TEXT NOT NULL REFERENCES collections(collection_id) ON DELETE CASCADE,
    item_id TEXT NOT NULL REFERENCES library_items(item_id) ON DELETE CASCADE,
    added_at TEXT NOT NULL,
    PRIMARY KEY (collection_id, item_id)
);
CREATE INDEX idx_collection_items_item ON collection_items(item_id);
INSERT INTO collection_items (collection_id, item_id, added_at)
SELECT cd.collection_id, f.item_id, cd.added_at
FROM collection_documents cd
JOIN item_files f ON f.file_id = cd.document_id;
DROP TABLE collection_documents;

CREATE TABLE tags (
    tag_id TEXT PRIMARY KEY,
    name TEXT NOT NULL CHECK (length(trim(name)) > 0),
    -- 空 = 不设颜色；有就是 #RRGGBB。
    color TEXT NOT NULL DEFAULT '' CHECK (color = '' OR (length(color) = 7 AND color GLOB '#[0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f]')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    owner_user_id TEXT NOT NULL DEFAULT 'local'
);
CREATE INDEX idx_tags_owner_name ON tags(owner_user_id, name);

CREATE TABLE item_tags (
    item_id TEXT NOT NULL REFERENCES library_items(item_id) ON DELETE CASCADE,
    tag_id TEXT NOT NULL REFERENCES tags(tag_id) ON DELETE CASCADE,
    added_at TEXT NOT NULL,
    PRIMARY KEY (item_id, tag_id)
);
CREATE INDEX idx_item_tags_tag ON item_tags(tag_id);

CREATE TABLE item_relations (
    subject_item_id TEXT NOT NULL REFERENCES library_items(item_id) ON DELETE CASCADE,
    relation TEXT NOT NULL CHECK (relation IN ('related', 'cites', 'derived_from')),
    object_item_id TEXT NOT NULL REFERENCES library_items(item_id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    PRIMARY KEY (subject_item_id, relation, object_item_id),
    CHECK (subject_item_id <> object_item_id)
);
CREATE INDEX idx_item_relations_object ON item_relations(object_item_id);

-- 同步：文件夹成员一条一个实体；标签一个一个实体；条目的标签、关联跟着条目（种类 document）走。
CREATE TRIGGER sync_dirty_collection_items_insert AFTER INSERT ON collection_items
WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard)
BEGIN
    INSERT INTO sync_dirty(kind, entity_key, changed_at)
    VALUES('collection_member', NEW.collection_id || '|' || NEW.item_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at;
END;
CREATE TRIGGER sync_dirty_collection_items_update AFTER UPDATE ON collection_items
WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard)
BEGIN
    INSERT INTO sync_dirty(kind, entity_key, changed_at)
    VALUES('collection_member', NEW.collection_id || '|' || NEW.item_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at;
END;
CREATE TRIGGER sync_dirty_collection_items_delete AFTER DELETE ON collection_items
WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard)
BEGIN
    INSERT INTO sync_dirty(kind, entity_key, changed_at)
    VALUES('collection_member', OLD.collection_id || '|' || OLD.item_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at;
END;
CREATE TRIGGER sync_dirty_tags_insert AFTER INSERT ON tags
WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard)
BEGIN
    INSERT INTO sync_dirty(kind, entity_key, changed_at)
    VALUES('tag', NEW.tag_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at;
END;
CREATE TRIGGER sync_dirty_tags_update AFTER UPDATE ON tags
WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard)
BEGIN
    INSERT INTO sync_dirty(kind, entity_key, changed_at)
    VALUES('tag', NEW.tag_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at;
END;
CREATE TRIGGER sync_dirty_tags_delete AFTER DELETE ON tags
WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard)
BEGIN
    INSERT INTO sync_dirty(kind, entity_key, changed_at)
    VALUES('tag', OLD.tag_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at;
END;
CREATE TRIGGER sync_dirty_item_tags_insert AFTER INSERT ON item_tags
WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard)
BEGIN
    INSERT INTO sync_dirty(kind, entity_key, changed_at)
    VALUES('document', NEW.item_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at;
END;
CREATE TRIGGER sync_dirty_item_tags_update AFTER UPDATE ON item_tags
WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard)
BEGIN
    INSERT INTO sync_dirty(kind, entity_key, changed_at)
    VALUES('document', NEW.item_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at;
END;
CREATE TRIGGER sync_dirty_item_tags_delete AFTER DELETE ON item_tags
WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard)
BEGIN
    INSERT INTO sync_dirty(kind, entity_key, changed_at)
    VALUES('document', OLD.item_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at;
END;
CREATE TRIGGER sync_dirty_item_relations_insert AFTER INSERT ON item_relations
WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard)
BEGIN
    INSERT INTO sync_dirty(kind, entity_key, changed_at)
    VALUES('document', NEW.subject_item_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at;
END;
CREATE TRIGGER sync_dirty_item_relations_update AFTER UPDATE ON item_relations
WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard)
BEGIN
    INSERT INTO sync_dirty(kind, entity_key, changed_at)
    VALUES('document', NEW.subject_item_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at;
END;
CREATE TRIGGER sync_dirty_item_relations_delete AFTER DELETE ON item_relations
WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard)
BEGIN
    INSERT INTO sync_dirty(kind, entity_key, changed_at)
    VALUES('document', OLD.subject_item_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at;
END;

-- 多用户模式的归属：标签建的时候由数据库层写上（照文件夹的做法），这里不用触发器。

-- 一本书（视图，见 v36）多一列：书上的标签，按名字排。
DROP VIEW library_documents;
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
    MAX(i.updated_at, f.updated_at) AS updated_at,
    (
        SELECT json_group_array(
            json_object('tag_id', t.tag_id, 'name', t.name, 'color', t.color) ORDER BY t.name, t.tag_id
        )
        FROM item_tags it
        JOIN tags t ON t.tag_id = it.tag_id
        WHERE it.item_id = f.item_id
    ) AS tags_json
FROM item_files f
JOIN library_items i ON i.item_id = f.item_id
LEFT JOIN item_references r ON r.item_id = f.item_id;
