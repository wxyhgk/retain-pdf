-- 现在每张表的完整样子：新建空库跑完 schema/base.sql、LEGACY_COLUMNS 和全部编号迁移以后的结果。
-- 测试生成，不要手改：UPDATE_SCHEMA=1 cargo test -p retainpdf-db schema_snapshot
-- 主键写成 PRIMARY KEY#n（复合主键里的第几列）；FTS5 自己的影子表不单列。
-- user_version 41

TABLE artifacts
  job_id TEXT PRIMARY KEY#1
  artifacts_json TEXT NOT NULL
  FOREIGN KEY (job_id) REFERENCES jobs(job_id) ON UPDATE NO ACTION ON DELETE CASCADE
  INDEX idx_artifacts_job_id: CREATE INDEX idx_artifacts_job_id ON artifacts(job_id)
  PRIMARY KEY (job_id)
  TRIGGER sync_dirty_artifacts_delete: CREATE TRIGGER sync_dirty_artifacts_delete AFTER DELETE ON artifacts WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard) BEGIN INSERT INTO sync_dirty(kind, entity_key, changed_at) VALUES('job', OLD.job_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at; END
  TRIGGER sync_dirty_artifacts_insert: CREATE TRIGGER sync_dirty_artifacts_insert AFTER INSERT ON artifacts WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard) BEGIN INSERT INTO sync_dirty(kind, entity_key, changed_at) VALUES('job', NEW.job_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at; END
  TRIGGER sync_dirty_artifacts_update: CREATE TRIGGER sync_dirty_artifacts_update AFTER UPDATE ON artifacts WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard) BEGIN INSERT INTO sync_dirty(kind, entity_key, changed_at) VALUES('job', NEW.job_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at; END

TABLE ask_conversation_messages
  message_id TEXT PRIMARY KEY#1
  conversation_id TEXT NOT NULL
  seq INTEGER NOT NULL
  role TEXT NOT NULL
  text TEXT NOT NULL
  thought TEXT
  usage_json TEXT
  agent_id TEXT
  side_conversation_id TEXT
  document_id TEXT
  job_id TEXT
  version_id TEXT
  pane TEXT
  page INTEGER
  selection_json TEXT
  client_message_id TEXT
  created_at TEXT NOT NULL
  FOREIGN KEY (conversation_id) REFERENCES ask_conversations(conversation_id) ON UPDATE NO ACTION ON DELETE CASCADE
  FOREIGN KEY (document_id) REFERENCES item_files(file_id) ON UPDATE NO ACTION ON DELETE SET NULL
  FOREIGN KEY (side_conversation_id) REFERENCES ask_conversations(conversation_id) ON UPDATE NO ACTION ON DELETE SET NULL
  INDEX idx_ask_conversation_messages_document: CREATE INDEX idx_ask_conversation_messages_document ON ask_conversation_messages(document_id, page) WHERE document_id IS NOT NULL
  PRIMARY KEY (message_id)
  UNIQUE (conversation_id, client_message_id)
  UNIQUE (conversation_id, seq)

TABLE ask_conversations
  conversation_id TEXT PRIMARY KEY#1
  kind TEXT NOT NULL
  parent_id TEXT
  forked_from_message_id TEXT
  status TEXT NOT NULL
  title TEXT NOT NULL DEFAULT ''
  summary TEXT
  document_id TEXT
  created_at TEXT NOT NULL
  updated_at TEXT NOT NULL
  closed_at TEXT
  FOREIGN KEY (document_id) REFERENCES item_files(file_id) ON UPDATE NO ACTION ON DELETE SET NULL
  FOREIGN KEY (forked_from_message_id) REFERENCES ask_conversation_messages(message_id) ON UPDATE NO ACTION ON DELETE SET NULL
  FOREIGN KEY (parent_id) REFERENCES ask_conversations(conversation_id) ON UPDATE NO ACTION ON DELETE CASCADE
  INDEX idx_ask_conversations_one_open_main: CREATE UNIQUE INDEX idx_ask_conversations_one_open_main ON ask_conversations(kind) WHERE kind = 'main' AND status = 'open'
  INDEX idx_ask_conversations_parent: CREATE INDEX idx_ask_conversations_parent ON ask_conversations(parent_id, created_at)
  PRIMARY KEY (conversation_id)

TABLE ask_memories
  memory_id TEXT PRIMARY KEY#1
  scope TEXT NOT NULL
  document_id TEXT
  category TEXT NOT NULL
  text TEXT NOT NULL
  status TEXT NOT NULL
  superseded_by TEXT
  origin TEXT NOT NULL
  agent_id TEXT
  source_conversation_id TEXT
  source_message_id TEXT
  source_job_id TEXT
  source_page INTEGER
  created_at TEXT NOT NULL
  updated_at TEXT NOT NULL
  deleted_at TEXT
  FOREIGN KEY (document_id) REFERENCES item_files(file_id) ON UPDATE NO ACTION ON DELETE CASCADE
  FOREIGN KEY (source_conversation_id) REFERENCES ask_conversations(conversation_id) ON UPDATE NO ACTION ON DELETE SET NULL
  FOREIGN KEY (source_message_id) REFERENCES ask_conversation_messages(message_id) ON UPDATE NO ACTION ON DELETE SET NULL
  FOREIGN KEY (superseded_by) REFERENCES ask_memories(memory_id) ON UPDATE NO ACTION ON DELETE SET NULL
  INDEX idx_ask_memories_document: CREATE INDEX idx_ask_memories_document ON ask_memories(document_id, status, updated_at) WHERE document_id IS NOT NULL
  INDEX idx_ask_memories_scope: CREATE INDEX idx_ask_memories_scope ON ask_memories(scope, status, updated_at)
  INDEX idx_ask_memories_source_conversation: CREATE INDEX idx_ask_memories_source_conversation ON ask_memories(source_conversation_id, created_at) WHERE source_conversation_id IS NOT NULL
  PRIMARY KEY (memory_id)
  TRIGGER ask_memories_fts_delete: CREATE TRIGGER ask_memories_fts_delete AFTER DELETE ON ask_memories BEGIN DELETE FROM ask_memories_fts WHERE memory_id = old.memory_id; END
  TRIGGER ask_memories_fts_insert: CREATE TRIGGER ask_memories_fts_insert AFTER INSERT ON ask_memories BEGIN INSERT INTO ask_memories_fts (memory_id, text) VALUES (new.memory_id, new.text); END
  TRIGGER ask_memories_fts_update: CREATE TRIGGER ask_memories_fts_update AFTER UPDATE OF text ON ask_memories BEGIN DELETE FROM ask_memories_fts WHERE memory_id = old.memory_id; INSERT INTO ask_memories_fts (memory_id, text) VALUES (new.memory_id, new.text); END

CREATE VIRTUAL TABLE ask_memories_fts USING fts5(memory_id UNINDEXED, text, tokenize='trigram')

TABLE ask_messages
  thread_id TEXT NOT NULL PRIMARY KEY#1
  position INTEGER NOT NULL PRIMARY KEY#2
  role TEXT NOT NULL
  text TEXT NOT NULL
  thought TEXT
  usage_json TEXT
  FOREIGN KEY (thread_id) REFERENCES ask_threads(thread_id) ON UPDATE NO ACTION ON DELETE CASCADE
  PRIMARY KEY (thread_id, position)

TABLE ask_settings
  id INTEGER PRIMARY KEY#1
  memory_enabled INTEGER NOT NULL DEFAULT 1
  updated_at TEXT NOT NULL

TABLE ask_threads
  thread_id TEXT PRIMARY KEY#1
  document_id TEXT NOT NULL
  agent_id TEXT NOT NULL
  session_id TEXT
  title TEXT NOT NULL DEFAULT ''
  pane TEXT NOT NULL
  page INTEGER NOT NULL
  item_id TEXT
  selection TEXT NOT NULL DEFAULT ''
  source_text TEXT NOT NULL DEFAULT ''
  translated_text TEXT NOT NULL DEFAULT ''
  section TEXT NOT NULL DEFAULT ''
  point_x REAL
  point_y REAL
  created_at TEXT NOT NULL
  updated_at TEXT NOT NULL
  FOREIGN KEY (document_id) REFERENCES item_files(file_id) ON UPDATE NO ACTION ON DELETE CASCADE
  INDEX idx_ask_threads_document: CREATE INDEX idx_ask_threads_document ON ask_threads(document_id, updated_at)
  PRIMARY KEY (thread_id)

CREATE VIRTUAL TABLE blocks_fts USING fts5( document_id UNINDEXED, job_id UNINDEXED, page_idx UNINDEXED, block_id UNINDEXED, source_text, translated_text, tokenize='trigram' )

TABLE collection_items
  collection_id TEXT NOT NULL PRIMARY KEY#1
  item_id TEXT NOT NULL PRIMARY KEY#2
  added_at TEXT NOT NULL
  FOREIGN KEY (collection_id) REFERENCES collections(collection_id) ON UPDATE NO ACTION ON DELETE CASCADE
  FOREIGN KEY (item_id) REFERENCES library_items(item_id) ON UPDATE NO ACTION ON DELETE CASCADE
  INDEX idx_collection_items_item: CREATE INDEX idx_collection_items_item ON collection_items(item_id)
  PRIMARY KEY (collection_id, item_id)
  TRIGGER sync_dirty_collection_items_delete: CREATE TRIGGER sync_dirty_collection_items_delete AFTER DELETE ON collection_items WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard) BEGIN INSERT INTO sync_dirty(kind, entity_key, changed_at) VALUES('collection_member', OLD.collection_id || '|' || OLD.item_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at; END
  TRIGGER sync_dirty_collection_items_insert: CREATE TRIGGER sync_dirty_collection_items_insert AFTER INSERT ON collection_items WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard) BEGIN INSERT INTO sync_dirty(kind, entity_key, changed_at) VALUES('collection_member', NEW.collection_id || '|' || NEW.item_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at; END
  TRIGGER sync_dirty_collection_items_update: CREATE TRIGGER sync_dirty_collection_items_update AFTER UPDATE ON collection_items WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard) BEGIN INSERT INTO sync_dirty(kind, entity_key, changed_at) VALUES('collection_member', NEW.collection_id || '|' || NEW.item_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at; END

TABLE collections
  collection_id TEXT PRIMARY KEY#1
  name TEXT NOT NULL
  parent_id TEXT
  sort_order INTEGER NOT NULL DEFAULT 0
  created_at TEXT NOT NULL
  owner_user_id TEXT NOT NULL DEFAULT 'local'
  FOREIGN KEY (parent_id) REFERENCES collections(collection_id) ON UPDATE NO ACTION ON DELETE SET NULL
  PRIMARY KEY (collection_id)
  TRIGGER sync_dirty_collections_delete: CREATE TRIGGER sync_dirty_collections_delete AFTER DELETE ON collections WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard) BEGIN INSERT INTO sync_dirty(kind, entity_key, changed_at) VALUES('collection', OLD.collection_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at; END
  TRIGGER sync_dirty_collections_insert: CREATE TRIGGER sync_dirty_collections_insert AFTER INSERT ON collections WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard) BEGIN INSERT INTO sync_dirty(kind, entity_key, changed_at) VALUES('collection', NEW.collection_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at; END
  TRIGGER sync_dirty_collections_update: CREATE TRIGGER sync_dirty_collections_update AFTER UPDATE ON collections WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard) BEGIN INSERT INTO sync_dirty(kind, entity_key, changed_at) VALUES('collection', NEW.collection_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at; END

TABLE event_feed_items
  owner_job_id TEXT NOT NULL PRIMARY KEY#1
  seq INTEGER NOT NULL PRIMARY KEY#2
  source_key TEXT NOT NULL
  event_id TEXT NOT NULL
  ts TEXT NOT NULL
  source_seq INTEGER
  source_event_uid TEXT
  payload_json TEXT
  FOREIGN KEY (owner_job_id) REFERENCES event_feeds(owner_job_id) ON UPDATE NO ACTION ON DELETE CASCADE
  PRIMARY KEY (owner_job_id, seq)
  UNIQUE (owner_job_id, event_id)
  UNIQUE (owner_job_id, source_key)

TABLE event_feed_retention
  singleton INTEGER PRIMARY KEY#1
  cutoff TEXT NOT NULL

TABLE event_feeds
  owner_job_id TEXT PRIMARY KEY#1
  epoch TEXT NOT NULL
  revision INTEGER NOT NULL
  context TEXT NOT NULL
  checkpoints_json TEXT NOT NULL
  high_seq INTEGER NOT NULL DEFAULT 0
  retention_cutoff TEXT
  FOREIGN KEY (owner_job_id) REFERENCES jobs(job_id) ON UPDATE NO ACTION ON DELETE CASCADE
  PRIMARY KEY (owner_job_id)

TABLE event_source_versions
  job_id TEXT PRIMARY KEY#1
  high_seq INTEGER NOT NULL DEFAULT 0
  revision INTEGER NOT NULL DEFAULT 0
  retention_cutoff TEXT
  PRIMARY KEY (job_id)

TABLE events
  job_id TEXT NOT NULL PRIMARY KEY#1
  seq INTEGER NOT NULL PRIMARY KEY#2
  ts TEXT NOT NULL
  level TEXT NOT NULL
  stage TEXT
  stage_detail TEXT
  provider TEXT
  provider_stage TEXT
  event TEXT NOT NULL
  event_type TEXT
  progress_current INTEGER
  progress_total INTEGER
  payload_json TEXT
  retry_count INTEGER
  elapsed_ms INTEGER
  message TEXT NOT NULL
  event_uid TEXT NOT NULL DEFAULT ''
  INDEX idx_events_job_seq: CREATE INDEX idx_events_job_seq ON events(job_id, seq)
  INDEX idx_events_translation_commit: CREATE INDEX idx_events_translation_commit ON events(job_id, seq) WHERE event = 'pipeline_unit_committed' AND stage = 'translate'
  INDEX idx_events_uid: CREATE UNIQUE INDEX idx_events_uid ON events(event_uid) WHERE event_uid <> ''
  PRIMARY KEY (job_id, seq)
  TRIGGER events_assign_uid: CREATE TRIGGER events_assign_uid AFTER INSERT ON events WHEN NEW.event_uid = '' BEGIN UPDATE events SET event_uid = lower(hex(randomblob(16))) WHERE job_id = NEW.job_id AND seq = NEW.seq; END
  TRIGGER events_immutable_uid: CREATE TRIGGER events_immutable_uid BEFORE UPDATE OF event_uid ON events WHEN OLD.event_uid <> '' AND NEW.event_uid IS NOT OLD.event_uid BEGIN SELECT RAISE(ABORT, 'event_uid is immutable'); END
  TRIGGER events_source_delete: CREATE TRIGGER events_source_delete AFTER DELETE ON events BEGIN INSERT INTO event_source_versions(job_id, high_seq, revision) VALUES(OLD.job_id, OLD.seq, 1) ON CONFLICT(job_id) DO UPDATE SET revision = revision + 1; END
  TRIGGER events_source_insert: CREATE TRIGGER events_source_insert AFTER INSERT ON events BEGIN INSERT INTO event_source_versions(job_id, high_seq, revision) VALUES(NEW.job_id, NEW.seq, 0) ON CONFLICT(job_id) DO UPDATE SET revision = revision + CASE WHEN NEW.seq <= high_seq THEN 1 ELSE 0 END, high_seq = MAX(high_seq, NEW.seq); END
  TRIGGER events_source_update: CREATE TRIGGER events_source_update AFTER UPDATE OF job_id, seq, ts, level, stage, stage_detail, provider, provider_stage, event, event_type, progress_current, progress_total, payload_json, retry_count, elapsed_ms, message ON events BEGIN INSERT INTO event_source_versions(job_id, high_seq, revision) VALUES(OLD.job_id, OLD.seq, 1) ON CONFLICT(job_id) DO UPDATE SET revision = revision + 1; INSERT INTO event_source_versions(job_id, high_seq, revision) SELECT NEW.job_id, NEW.seq, 1 WHERE NEW.job_id <> OLD.job_id ON CONFLICT(job_id) DO UPDATE SET revision = revision + 1, high_seq = MAX(high_seq, NEW.seq); UPDATE event_source_versions SET high_seq = MAX(high_seq, NEW.seq) WHERE job_id = NEW.job_id; END
  TRIGGER sync_dirty_events_delete: CREATE TRIGGER sync_dirty_events_delete AFTER DELETE ON events WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard) BEGIN INSERT INTO sync_dirty(kind, entity_key, changed_at) VALUES('job', OLD.job_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at; END
  TRIGGER sync_dirty_events_insert: CREATE TRIGGER sync_dirty_events_insert AFTER INSERT ON events WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard) BEGIN INSERT INTO sync_dirty(kind, entity_key, changed_at) VALUES('job', NEW.job_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at; END
  TRIGGER sync_dirty_events_update: CREATE TRIGGER sync_dirty_events_update AFTER UPDATE ON events WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard) BEGIN INSERT INTO sync_dirty(kind, entity_key, changed_at) VALUES('job', NEW.job_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at; END

TABLE glossaries
  glossary_id TEXT PRIMARY KEY#1
  name TEXT NOT NULL
  description TEXT NOT NULL DEFAULT ''
  source_lang TEXT NOT NULL DEFAULT ''
  target_lang TEXT NOT NULL DEFAULT ''
  enabled INTEGER NOT NULL DEFAULT 1
  entries_json TEXT NOT NULL
  created_at TEXT NOT NULL
  updated_at TEXT NOT NULL
  owner_user_id TEXT NOT NULL DEFAULT 'local'
  INDEX idx_glossaries_updated_at: CREATE INDEX idx_glossaries_updated_at ON glossaries(updated_at DESC)
  PRIMARY KEY (glossary_id)
  TRIGGER sync_dirty_glossaries_delete: CREATE TRIGGER sync_dirty_glossaries_delete AFTER DELETE ON glossaries WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard) BEGIN INSERT INTO sync_dirty(kind, entity_key, changed_at) VALUES('glossary', OLD.glossary_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at; END
  TRIGGER sync_dirty_glossaries_insert: CREATE TRIGGER sync_dirty_glossaries_insert AFTER INSERT ON glossaries WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard) BEGIN INSERT INTO sync_dirty(kind, entity_key, changed_at) VALUES('glossary', NEW.glossary_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at; END
  TRIGGER sync_dirty_glossaries_update: CREATE TRIGGER sync_dirty_glossaries_update AFTER UPDATE ON glossaries WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard) BEGIN INSERT INTO sync_dirty(kind, entity_key, changed_at) VALUES('glossary', NEW.glossary_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at; END

TABLE idempotency_keys
  owner_user_id TEXT NOT NULL PRIMARY KEY#1
  route TEXT NOT NULL PRIMARY KEY#2
  idempotency_key TEXT NOT NULL PRIMARY KEY#3
  request_method TEXT NOT NULL
  request_path TEXT NOT NULL
  request_body_sha256 TEXT NOT NULL
  status TEXT NOT NULL
  response_status INTEGER
  response_content_type TEXT
  response_body BLOB
  created_at TEXT NOT NULL
  completed_at TEXT
  expires_at TEXT NOT NULL
  INDEX idx_idempotency_keys_expires: CREATE INDEX idx_idempotency_keys_expires ON idempotency_keys(expires_at)
  PRIMARY KEY (owner_user_id, route, idempotency_key)

TABLE invite_codes
  invite_id TEXT PRIMARY KEY#1
  code TEXT NOT NULL
  max_uses INTEGER NOT NULL
  used_count INTEGER NOT NULL DEFAULT 0
  initial_pages INTEGER NOT NULL DEFAULT 0
  note TEXT NOT NULL DEFAULT ''
  expires_at TEXT NOT NULL DEFAULT ''
  revoked_at TEXT NOT NULL DEFAULT ''
  created_by TEXT NOT NULL
  created_at TEXT NOT NULL
  PRIMARY KEY (invite_id)
  UNIQUE (code)

TABLE item_creators
  item_id TEXT NOT NULL PRIMARY KEY#1
  position INTEGER NOT NULL PRIMARY KEY#2
  role TEXT NOT NULL DEFAULT 'author'
  family TEXT NOT NULL DEFAULT ''
  given TEXT NOT NULL DEFAULT ''
  literal TEXT NOT NULL DEFAULT ''
  FOREIGN KEY (item_id) REFERENCES library_items(item_id) ON UPDATE NO ACTION ON DELETE CASCADE
  PRIMARY KEY (item_id, position)
  TRIGGER sync_dirty_item_creators_delete: CREATE TRIGGER sync_dirty_item_creators_delete AFTER DELETE ON item_creators WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard) BEGIN INSERT INTO sync_dirty(kind, entity_key, changed_at) VALUES('document', OLD.item_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at; END
  TRIGGER sync_dirty_item_creators_insert: CREATE TRIGGER sync_dirty_item_creators_insert AFTER INSERT ON item_creators WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard) BEGIN INSERT INTO sync_dirty(kind, entity_key, changed_at) VALUES('document', NEW.item_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at; END
  TRIGGER sync_dirty_item_creators_update: CREATE TRIGGER sync_dirty_item_creators_update AFTER UPDATE ON item_creators WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard) BEGIN INSERT INTO sync_dirty(kind, entity_key, changed_at) VALUES('document', NEW.item_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at; END

TABLE item_files
  file_id TEXT PRIMARY KEY#1
  source_filename TEXT NOT NULL
  page_count INTEGER NOT NULL DEFAULT 0
  bytes INTEGER NOT NULL DEFAULT 0
  active_job_id TEXT
  reading_status TEXT NOT NULL DEFAULT 'unread'
  added_at TEXT NOT NULL
  last_opened_at TEXT
  updated_at TEXT NOT NULL
  item_id TEXT
  chosen_version_id TEXT
  FOREIGN KEY (chosen_version_id) REFERENCES translation_versions(version_id) ON UPDATE NO ACTION ON DELETE SET NULL
  FOREIGN KEY (item_id) REFERENCES library_items(item_id) ON UPDATE NO ACTION ON DELETE CASCADE
  INDEX idx_item_files_added_at: CREATE INDEX idx_item_files_added_at ON item_files(added_at DESC)
  INDEX idx_item_files_item: CREATE INDEX idx_item_files_item ON item_files(item_id)
  PRIMARY KEY (file_id)
  TRIGGER item_files_item_required_insert: CREATE TRIGGER item_files_item_required_insert BEFORE INSERT ON item_files WHEN NEW.item_id IS NULL BEGIN SELECT RAISE(ABORT, 'item_files.item_id is required'); END
  TRIGGER item_files_item_required_update: CREATE TRIGGER item_files_item_required_update BEFORE UPDATE OF item_id ON item_files WHEN NEW.item_id IS NULL BEGIN SELECT RAISE(ABORT, 'item_files.item_id is required'); END
  TRIGGER sync_dirty_item_files_delete: CREATE TRIGGER sync_dirty_item_files_delete AFTER DELETE ON item_files WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard) BEGIN INSERT INTO sync_dirty(kind, entity_key, changed_at) VALUES('document', OLD.item_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at; END
  TRIGGER sync_dirty_item_files_insert: CREATE TRIGGER sync_dirty_item_files_insert AFTER INSERT ON item_files WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard) BEGIN INSERT INTO sync_dirty(kind, entity_key, changed_at) VALUES('document', NEW.item_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at; END
  TRIGGER sync_dirty_item_files_update: CREATE TRIGGER sync_dirty_item_files_update AFTER UPDATE ON item_files WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard) BEGIN INSERT INTO sync_dirty(kind, entity_key, changed_at) VALUES('document', NEW.item_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at; END

TABLE item_references
  item_id TEXT PRIMARY KEY#1
  csl_type TEXT NOT NULL DEFAULT 'document'
  title TEXT NOT NULL DEFAULT ''
  title_source TEXT NOT NULL DEFAULT 'filename'
  title_locked INTEGER NOT NULL DEFAULT 0
  title_suggestion_id TEXT
  short_title TEXT NOT NULL DEFAULT ''
  issued TEXT NOT NULL DEFAULT ''
  year INTEGER
  container_title TEXT NOT NULL DEFAULT ''
  volume TEXT NOT NULL DEFAULT ''
  issue TEXT NOT NULL DEFAULT ''
  pages TEXT NOT NULL DEFAULT ''
  publisher TEXT NOT NULL DEFAULT ''
  doi TEXT NOT NULL DEFAULT ''
  isbn TEXT NOT NULL DEFAULT ''
  url TEXT NOT NULL DEFAULT ''
  language TEXT NOT NULL DEFAULT ''
  abstract TEXT NOT NULL DEFAULT ''
  extra_csl_json TEXT NOT NULL DEFAULT '{}'
  FOREIGN KEY (item_id) REFERENCES library_items(item_id) ON UPDATE NO ACTION ON DELETE CASCADE
  PRIMARY KEY (item_id)
  TRIGGER sync_dirty_item_references_delete: CREATE TRIGGER sync_dirty_item_references_delete AFTER DELETE ON item_references WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard) BEGIN INSERT INTO sync_dirty(kind, entity_key, changed_at) VALUES('document', OLD.item_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at; END
  TRIGGER sync_dirty_item_references_insert: CREATE TRIGGER sync_dirty_item_references_insert AFTER INSERT ON item_references WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard) BEGIN INSERT INTO sync_dirty(kind, entity_key, changed_at) VALUES('document', NEW.item_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at; END
  TRIGGER sync_dirty_item_references_update: CREATE TRIGGER sync_dirty_item_references_update AFTER UPDATE ON item_references WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard) BEGIN INSERT INTO sync_dirty(kind, entity_key, changed_at) VALUES('document', NEW.item_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at; END

TABLE item_relations
  subject_item_id TEXT NOT NULL PRIMARY KEY#1
  relation TEXT NOT NULL PRIMARY KEY#2
  object_item_id TEXT NOT NULL PRIMARY KEY#3
  created_at TEXT NOT NULL
  FOREIGN KEY (object_item_id) REFERENCES library_items(item_id) ON UPDATE NO ACTION ON DELETE CASCADE
  FOREIGN KEY (subject_item_id) REFERENCES library_items(item_id) ON UPDATE NO ACTION ON DELETE CASCADE
  INDEX idx_item_relations_object: CREATE INDEX idx_item_relations_object ON item_relations(object_item_id)
  PRIMARY KEY (subject_item_id, relation, object_item_id)
  TRIGGER sync_dirty_item_relations_delete: CREATE TRIGGER sync_dirty_item_relations_delete AFTER DELETE ON item_relations WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard) BEGIN INSERT INTO sync_dirty(kind, entity_key, changed_at) VALUES('document', OLD.subject_item_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at; END
  TRIGGER sync_dirty_item_relations_insert: CREATE TRIGGER sync_dirty_item_relations_insert AFTER INSERT ON item_relations WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard) BEGIN INSERT INTO sync_dirty(kind, entity_key, changed_at) VALUES('document', NEW.subject_item_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at; END
  TRIGGER sync_dirty_item_relations_update: CREATE TRIGGER sync_dirty_item_relations_update AFTER UPDATE ON item_relations WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard) BEGIN INSERT INTO sync_dirty(kind, entity_key, changed_at) VALUES('document', NEW.subject_item_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at; END

TABLE item_tags
  item_id TEXT NOT NULL PRIMARY KEY#1
  tag_id TEXT NOT NULL PRIMARY KEY#2
  added_at TEXT NOT NULL
  FOREIGN KEY (item_id) REFERENCES library_items(item_id) ON UPDATE NO ACTION ON DELETE CASCADE
  FOREIGN KEY (tag_id) REFERENCES tags(tag_id) ON UPDATE NO ACTION ON DELETE CASCADE
  INDEX idx_item_tags_tag: CREATE INDEX idx_item_tags_tag ON item_tags(tag_id)
  PRIMARY KEY (item_id, tag_id)
  TRIGGER sync_dirty_item_tags_delete: CREATE TRIGGER sync_dirty_item_tags_delete AFTER DELETE ON item_tags WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard) BEGIN INSERT INTO sync_dirty(kind, entity_key, changed_at) VALUES('document', OLD.item_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at; END
  TRIGGER sync_dirty_item_tags_insert: CREATE TRIGGER sync_dirty_item_tags_insert AFTER INSERT ON item_tags WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard) BEGIN INSERT INTO sync_dirty(kind, entity_key, changed_at) VALUES('document', NEW.item_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at; END
  TRIGGER sync_dirty_item_tags_update: CREATE TRIGGER sync_dirty_item_tags_update AFTER UPDATE ON item_tags WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard) BEGIN INSERT INTO sync_dirty(kind, entity_key, changed_at) VALUES('document', NEW.item_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at; END

TABLE item_title_suggestions
  suggestion_id TEXT PRIMARY KEY#1
  item_id TEXT NOT NULL
  source_job_id TEXT
  artifact_sha256 TEXT NOT NULL
  fields_json TEXT NOT NULL DEFAULT '["title"]'
  candidates_json TEXT NOT NULL
  selected_title TEXT NOT NULL
  generation_method TEXT NOT NULL DEFAULT 'deterministic'
  needs_ai_review INTEGER NOT NULL DEFAULT 0
  status TEXT NOT NULL DEFAULT 'completed'
  applied_at TEXT
  created_at TEXT NOT NULL
  updated_at TEXT NOT NULL
  FOREIGN KEY (item_id) REFERENCES library_items(item_id) ON UPDATE NO ACTION ON DELETE CASCADE
  INDEX idx_item_title_suggestions_evidence: CREATE UNIQUE INDEX idx_item_title_suggestions_evidence ON item_title_suggestions( item_id, COALESCE(source_job_id, ''), artifact_sha256, selected_title )
  INDEX idx_item_title_suggestions_item: CREATE INDEX idx_item_title_suggestions_item ON item_title_suggestions(item_id, created_at DESC, suggestion_id DESC)
  PRIMARY KEY (suggestion_id)
  TRIGGER sync_dirty_item_title_suggestions_delete: CREATE TRIGGER sync_dirty_item_title_suggestions_delete AFTER DELETE ON item_title_suggestions WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard) BEGIN INSERT INTO sync_dirty(kind, entity_key, changed_at) VALUES('document', OLD.item_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at; END
  TRIGGER sync_dirty_item_title_suggestions_insert: CREATE TRIGGER sync_dirty_item_title_suggestions_insert AFTER INSERT ON item_title_suggestions WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard) BEGIN INSERT INTO sync_dirty(kind, entity_key, changed_at) VALUES('document', NEW.item_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at; END
  TRIGGER sync_dirty_item_title_suggestions_update: CREATE TRIGGER sync_dirty_item_title_suggestions_update AFTER UPDATE ON item_title_suggestions WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard) BEGIN INSERT INTO sync_dirty(kind, entity_key, changed_at) VALUES('document', NEW.item_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at; END

TABLE job_artifact_entries
  job_id TEXT NOT NULL PRIMARY KEY#1
  artifact_key TEXT NOT NULL PRIMARY KEY#2
  artifact_group TEXT NOT NULL
  artifact_kind TEXT NOT NULL
  relative_path TEXT NOT NULL
  file_name TEXT
  content_type TEXT NOT NULL
  ready INTEGER NOT NULL
  size_bytes INTEGER
  checksum TEXT
  source_stage TEXT
  created_at TEXT NOT NULL
  updated_at TEXT NOT NULL
  FOREIGN KEY (job_id) REFERENCES jobs(job_id) ON UPDATE NO ACTION ON DELETE CASCADE
  INDEX idx_job_artifact_entries_job_id: CREATE INDEX idx_job_artifact_entries_job_id ON job_artifact_entries(job_id)
  PRIMARY KEY (job_id, artifact_key)
  TRIGGER sync_dirty_job_artifact_entries_delete: CREATE TRIGGER sync_dirty_job_artifact_entries_delete AFTER DELETE ON job_artifact_entries WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard) BEGIN INSERT INTO sync_dirty(kind, entity_key, changed_at) VALUES('job', OLD.job_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at; END
  TRIGGER sync_dirty_job_artifact_entries_insert: CREATE TRIGGER sync_dirty_job_artifact_entries_insert AFTER INSERT ON job_artifact_entries WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard) BEGIN INSERT INTO sync_dirty(kind, entity_key, changed_at) VALUES('job', NEW.job_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at; END
  TRIGGER sync_dirty_job_artifact_entries_update: CREATE TRIGGER sync_dirty_job_artifact_entries_update AFTER UPDATE ON job_artifact_entries WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard) BEGIN INSERT INTO sync_dirty(kind, entity_key, changed_at) VALUES('job', NEW.job_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at; END

TABLE job_derivations
  job_id TEXT PRIMARY KEY#1
  source_job_id TEXT NOT NULL
  created_at TEXT NOT NULL
  FOREIGN KEY (job_id) REFERENCES jobs(job_id) ON UPDATE NO ACTION ON DELETE CASCADE
  INDEX idx_job_derivations_source: CREATE INDEX idx_job_derivations_source ON job_derivations(source_job_id)
  PRIMARY KEY (job_id)

TABLE job_page_charges
  job_id TEXT PRIMARY KEY#1
  user_id TEXT NOT NULL
  pages INTEGER NOT NULL
  status TEXT NOT NULL
  created_at TEXT NOT NULL
  updated_at TEXT NOT NULL
  PRIMARY KEY (job_id)

TABLE job_stage_history
  job_id TEXT NOT NULL PRIMARY KEY#1
  seq INTEGER NOT NULL PRIMARY KEY#2
  stage TEXT NOT NULL
  detail TEXT
  enter_at TEXT NOT NULL
  exit_at TEXT
  duration_ms INTEGER
  terminal_status TEXT
  progress_current INTEGER
  progress_total INTEGER
  FOREIGN KEY (job_id) REFERENCES jobs(job_id) ON UPDATE NO ACTION ON DELETE CASCADE
  PRIMARY KEY (job_id, seq)
  TRIGGER sync_dirty_job_stage_history_delete: CREATE TRIGGER sync_dirty_job_stage_history_delete AFTER DELETE ON job_stage_history WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard) BEGIN INSERT INTO sync_dirty(kind, entity_key, changed_at) VALUES('job', OLD.job_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at; END
  TRIGGER sync_dirty_job_stage_history_insert: CREATE TRIGGER sync_dirty_job_stage_history_insert AFTER INSERT ON job_stage_history WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard) BEGIN INSERT INTO sync_dirty(kind, entity_key, changed_at) VALUES('job', NEW.job_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at; END
  TRIGGER sync_dirty_job_stage_history_update: CREATE TRIGGER sync_dirty_job_stage_history_update AFTER UPDATE ON job_stage_history WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard) BEGIN INSERT INTO sync_dirty(kind, entity_key, changed_at) VALUES('job', NEW.job_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at; END

TABLE job_usage_cache
  job_id TEXT PRIMARY KEY#1
  source_key TEXT NOT NULL
  has_records INTEGER NOT NULL
  estimated INTEGER NOT NULL
  computed_at TEXT NOT NULL
  PRIMARY KEY (job_id)

TABLE job_usage_rollups
  job_id TEXT NOT NULL PRIMARY KEY#1
  stage TEXT NOT NULL PRIMARY KEY#2
  model TEXT NOT NULL PRIMARY KEY#3
  host TEXT NOT NULL PRIMARY KEY#4
  month TEXT NOT NULL PRIMARY KEY#5
  first_at TEXT
  last_at TEXT
  requests INTEGER NOT NULL
  requests_without_usage INTEGER NOT NULL
  input_tokens INTEGER NOT NULL
  output_tokens INTEGER NOT NULL
  cache_hit_tokens INTEGER NOT NULL
  cache_reported_input_tokens INTEGER NOT NULL
  cache_write_tokens INTEGER NOT NULL
  reasoning_tokens INTEGER NOT NULL
  estimated_cost_usd REAL NOT NULL
  priced_requests INTEGER NOT NULL
  list_priced_requests INTEGER NOT NULL
  unpriced_requests INTEGER NOT NULL
  price_provider TEXT
  price_basis TEXT
  first_priced_seq INTEGER
  FOREIGN KEY (job_id) REFERENCES job_usage_cache(job_id) ON UPDATE NO ACTION ON DELETE CASCADE
  PRIMARY KEY (job_id, stage, model, host, month)

TABLE jobs
  job_id TEXT PRIMARY KEY#1
  created_at TEXT NOT NULL
  updated_at TEXT NOT NULL
  started_at TEXT
  finished_at TEXT
  upload_id TEXT
  pid INTEGER
  command_json TEXT NOT NULL
  request_json TEXT NOT NULL
  error TEXT
  stage TEXT
  stage_detail TEXT
  progress_current INTEGER
  progress_total INTEGER
  log_tail_json TEXT NOT NULL
  result_json TEXT
  failure_json TEXT
  document_id TEXT
  run_generation INTEGER NOT NULL DEFAULT 0
  worker_identity TEXT
  owner_user_id TEXT NOT NULL DEFAULT 'local'
  status TEXT NOT NULL DEFAULT 'queued'
  workflow TEXT NOT NULL DEFAULT 'book'
  parent_job_id TEXT
  stage_entered_at TEXT
  last_error_at TEXT
  retry_count INTEGER NOT NULL DEFAULT 0
  last_retry_at TEXT
  FOREIGN KEY (parent_job_id) REFERENCES jobs(job_id) ON UPDATE NO ACTION ON DELETE SET NULL
  INDEX idx_jobs_document_updated: CREATE INDEX idx_jobs_document_updated ON jobs(document_id, updated_at DESC, job_id DESC)
  INDEX idx_jobs_owner: CREATE INDEX idx_jobs_owner ON jobs(owner_user_id)
  INDEX idx_jobs_parent: CREATE INDEX idx_jobs_parent ON jobs(parent_job_id) WHERE parent_job_id IS NOT NULL
  INDEX idx_jobs_status: CREATE INDEX idx_jobs_status ON jobs(status, updated_at DESC)
  INDEX idx_jobs_updated_at: CREATE INDEX idx_jobs_updated_at ON jobs(updated_at DESC)
  INDEX idx_jobs_upload_id: CREATE INDEX idx_jobs_upload_id ON jobs(upload_id)
  PRIMARY KEY (job_id)
  TRIGGER jobs_inherit_owner: CREATE TRIGGER jobs_inherit_owner AFTER INSERT ON jobs BEGIN UPDATE jobs SET owner_user_id = COALESCE( (SELECT u.owner_user_id FROM uploads u WHERE u.upload_id = NEW.upload_id), (SELECT p.owner_user_id FROM jobs p WHERE p.job_id = CASE WHEN json_valid(NEW.request_json) THEN json_extract(NEW.request_json, '$.source.artifact_job_id') END AND p.job_id <> NEW.job_id), owner_user_id) WHERE job_id = NEW.job_id AND owner_user_id = 'local'; END
  TRIGGER jobs_page_charge_refund: CREATE TRIGGER jobs_page_charge_refund AFTER UPDATE OF status ON jobs WHEN NEW.status IN ('failed', 'canceled') BEGIN INSERT INTO page_ledger (user_id, delta, kind, job_id, note, created_at) SELECT user_id, pages, 'refund', job_id, NEW.status, strftime('%Y-%m-%dT%H:%M:%SZ', 'now') FROM job_page_charges WHERE job_id = NEW.job_id AND status = 'reserved'; UPDATE job_page_charges SET status = 'refunded', updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE job_id = NEW.job_id AND status = 'reserved'; END
  TRIGGER jobs_page_charge_refund_on_delete: CREATE TRIGGER jobs_page_charge_refund_on_delete AFTER DELETE ON jobs BEGIN INSERT INTO page_ledger (user_id, delta, kind, job_id, note, created_at) SELECT user_id, pages, 'refund', job_id, 'deleted', strftime('%Y-%m-%dT%H:%M:%SZ', 'now') FROM job_page_charges WHERE job_id = OLD.job_id AND status = 'reserved'; UPDATE job_page_charges SET status = 'refunded', updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE job_id = OLD.job_id AND status = 'reserved'; END
  TRIGGER jobs_page_charge_settle: CREATE TRIGGER jobs_page_charge_settle AFTER UPDATE OF status ON jobs WHEN NEW.status = 'succeeded' BEGIN UPDATE job_page_charges SET status = 'settled', updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE job_id = NEW.job_id AND status = 'reserved'; END
  TRIGGER sync_dirty_jobs_delete: CREATE TRIGGER sync_dirty_jobs_delete AFTER DELETE ON jobs WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard) BEGIN INSERT INTO sync_dirty(kind, entity_key, changed_at) VALUES('job', OLD.job_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at; END
  TRIGGER sync_dirty_jobs_insert: CREATE TRIGGER sync_dirty_jobs_insert AFTER INSERT ON jobs WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard) BEGIN INSERT INTO sync_dirty(kind, entity_key, changed_at) VALUES('job', NEW.job_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at; END
  TRIGGER sync_dirty_jobs_update: CREATE TRIGGER sync_dirty_jobs_update AFTER UPDATE ON jobs WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard) BEGIN INSERT INTO sync_dirty(kind, entity_key, changed_at) VALUES('job', NEW.job_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at; END

VIEW library_documents
  CREATE VIEW library_documents AS SELECT f.file_id AS document_id, f.item_id, i.owner_user_id, COALESCE(r.title, '') AS title, COALESCE(r.title_source, 'filename') AS title_source, COALESCE(r.title_locked, 0) AS title_locked, ( SELECT json_group_array( CASE WHEN c.literal <> '' THEN c.literal ELSE trim(c.given || ' ' || c.family) END ORDER BY c.position ) FROM item_creators c WHERE c.item_id = f.item_id AND c.role = 'author' ) AS authors_json, r.year, COALESCE(r.doi, '') AS doi, f.source_filename, f.page_count, f.bytes, f.active_job_id, f.chosen_version_id, f.reading_status, f.added_at, f.last_opened_at, MAX(i.updated_at, f.updated_at) AS updated_at, ( SELECT json_group_array( json_object('tag_id', t.tag_id, 'name', t.name, 'color', t.color) ORDER BY t.name, t.tag_id ) FROM item_tags it JOIN tags t ON t.tag_id = it.tag_id WHERE it.item_id = f.item_id ) AS tags_json FROM item_files f JOIN library_items i ON i.item_id = f.item_id LEFT JOIN item_references r ON r.item_id = f.item_id

TABLE library_items
  item_id TEXT PRIMARY KEY#1
  item_type TEXT NOT NULL
  parent_item_id TEXT
  created_at TEXT NOT NULL
  updated_at TEXT NOT NULL
  deleted_at TEXT
  owner_user_id TEXT NOT NULL DEFAULT 'local'
  FOREIGN KEY (parent_item_id) REFERENCES library_items(item_id) ON UPDATE NO ACTION ON DELETE CASCADE
  INDEX idx_library_items_owner: CREATE INDEX idx_library_items_owner ON library_items(owner_user_id)
  INDEX idx_library_items_parent: CREATE INDEX idx_library_items_parent ON library_items(parent_item_id) WHERE parent_item_id IS NOT NULL
  PRIMARY KEY (item_id)
  TRIGGER library_items_inherit_owner: CREATE TRIGGER library_items_inherit_owner AFTER INSERT ON library_items BEGIN UPDATE library_items SET owner_user_id = COALESCE( (SELECT u.owner_user_id FROM uploads u WHERE u.content_hash = NEW.item_id ORDER BY u.uploaded_at LIMIT 1), owner_user_id ) WHERE item_id = NEW.item_id AND owner_user_id = 'local'; END
  TRIGGER sync_dirty_library_items_delete: CREATE TRIGGER sync_dirty_library_items_delete AFTER DELETE ON library_items WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard) BEGIN INSERT INTO sync_dirty(kind, entity_key, changed_at) VALUES('document', OLD.item_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at; END
  TRIGGER sync_dirty_library_items_insert: CREATE TRIGGER sync_dirty_library_items_insert AFTER INSERT ON library_items WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard) BEGIN INSERT INTO sync_dirty(kind, entity_key, changed_at) VALUES('document', NEW.item_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at; END
  TRIGGER sync_dirty_library_items_update: CREATE TRIGGER sync_dirty_library_items_update AFTER UPDATE ON library_items WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard) BEGIN INSERT INTO sync_dirty(kind, entity_key, changed_at) VALUES('document', NEW.item_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at; END

TABLE model_operations
  job_id TEXT NOT NULL PRIMARY KEY#1
  operation_id TEXT NOT NULL PRIMARY KEY#2
  unit_id TEXT NOT NULL
  request_hash TEXT NOT NULL
  purpose TEXT NOT NULL
  status TEXT NOT NULL
  result_json TEXT
  error_code TEXT
  created_at TEXT NOT NULL
  updated_at TEXT NOT NULL
  FOREIGN KEY (job_id) REFERENCES model_sessions(job_id) ON UPDATE NO ACTION ON DELETE CASCADE
  INDEX idx_model_operations_status: CREATE INDEX idx_model_operations_status ON model_operations(status)
  INDEX idx_model_operations_unit: CREATE INDEX idx_model_operations_unit ON model_operations(job_id, unit_id)
  PRIMARY KEY (job_id, operation_id)

TABLE model_sessions
  job_id TEXT PRIMARY KEY#1
  token_hash TEXT NOT NULL
  expires_at INTEGER NOT NULL
  profile_json TEXT NOT NULL
  paused INTEGER NOT NULL DEFAULT 0
  created_at TEXT NOT NULL
  FOREIGN KEY (job_id) REFERENCES jobs(job_id) ON UPDATE NO ACTION ON DELETE CASCADE
  PRIMARY KEY (job_id)

TABLE page_ledger
  entry_id INTEGER PRIMARY KEY#1
  user_id TEXT NOT NULL
  delta INTEGER NOT NULL
  kind TEXT NOT NULL
  job_id TEXT NOT NULL DEFAULT ''
  note TEXT NOT NULL DEFAULT ''
  actor_user_id TEXT NOT NULL DEFAULT ''
  created_at TEXT NOT NULL
  INDEX page_ledger_by_user: CREATE INDEX page_ledger_by_user ON page_ledger(user_id, entry_id)

TABLE pipeline_attempts
  job_id TEXT NOT NULL PRIMARY KEY#1
  attempt INTEGER NOT NULL PRIMARY KEY#2
  generation INTEGER NOT NULL
  status TEXT NOT NULL
  worker_id TEXT NOT NULL
  current_stage TEXT
  created_at TEXT NOT NULL
  updated_at TEXT NOT NULL
  finished_at TEXT
  auto_resume_count INTEGER NOT NULL DEFAULT 0
  auto_resume_progress INTEGER NOT NULL DEFAULT 0
  FOREIGN KEY (job_id) REFERENCES jobs(job_id) ON UPDATE NO ACTION ON DELETE CASCADE
  INDEX idx_pipeline_attempt_generation: CREATE INDEX idx_pipeline_attempt_generation ON pipeline_attempts(job_id, attempt, generation)
  INDEX idx_pipeline_attempt_status: CREATE INDEX idx_pipeline_attempt_status ON pipeline_attempts(status, updated_at)
  PRIMARY KEY (job_id, attempt)
  TRIGGER sync_dirty_pipeline_attempts_delete: CREATE TRIGGER sync_dirty_pipeline_attempts_delete AFTER DELETE ON pipeline_attempts WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard) BEGIN INSERT INTO sync_dirty(kind, entity_key, changed_at) VALUES('job', OLD.job_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at; END
  TRIGGER sync_dirty_pipeline_attempts_insert: CREATE TRIGGER sync_dirty_pipeline_attempts_insert AFTER INSERT ON pipeline_attempts WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard) BEGIN INSERT INTO sync_dirty(kind, entity_key, changed_at) VALUES('job', NEW.job_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at; END
  TRIGGER sync_dirty_pipeline_attempts_update: CREATE TRIGGER sync_dirty_pipeline_attempts_update AFTER UPDATE ON pipeline_attempts WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard) BEGIN INSERT INTO sync_dirty(kind, entity_key, changed_at) VALUES('job', NEW.job_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at; END

TABLE pipeline_dispatches
  job_id TEXT NOT NULL PRIMARY KEY#1
  attempt INTEGER NOT NULL PRIMARY KEY#2
  stage_key TEXT NOT NULL
  dispatch_key TEXT NOT NULL PRIMARY KEY#3
  generation INTEGER NOT NULL
  provider TEXT NOT NULL
  operation TEXT NOT NULL
  request_hash TEXT NOT NULL
  status TEXT NOT NULL
  receipt_json TEXT
  ambiguity_reason TEXT
  created_at TEXT NOT NULL
  updated_at TEXT NOT NULL
  receipted_at TEXT
  FOREIGN KEY (job_id, attempt) REFERENCES pipeline_attempts(job_id, attempt) ON UPDATE NO ACTION ON DELETE CASCADE
  INDEX idx_pipeline_dispatch_status: CREATE INDEX idx_pipeline_dispatch_status ON pipeline_dispatches(job_id, attempt, status, stage_key)
  PRIMARY KEY (job_id, attempt, dispatch_key)
  TRIGGER sync_dirty_pipeline_dispatches_delete: CREATE TRIGGER sync_dirty_pipeline_dispatches_delete AFTER DELETE ON pipeline_dispatches WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard) BEGIN INSERT INTO sync_dirty(kind, entity_key, changed_at) VALUES('job', OLD.job_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at; END
  TRIGGER sync_dirty_pipeline_dispatches_insert: CREATE TRIGGER sync_dirty_pipeline_dispatches_insert AFTER INSERT ON pipeline_dispatches WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard) BEGIN INSERT INTO sync_dirty(kind, entity_key, changed_at) VALUES('job', NEW.job_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at; END
  TRIGGER sync_dirty_pipeline_dispatches_update: CREATE TRIGGER sync_dirty_pipeline_dispatches_update AFTER UPDATE ON pipeline_dispatches WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard) BEGIN INSERT INTO sync_dirty(kind, entity_key, changed_at) VALUES('job', NEW.job_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at; END

TABLE pipeline_stages
  job_id TEXT NOT NULL PRIMARY KEY#1
  attempt INTEGER NOT NULL PRIMARY KEY#2
  stage_key TEXT NOT NULL PRIMARY KEY#3
  stage_order INTEGER NOT NULL
  generation INTEGER NOT NULL
  status TEXT NOT NULL
  last_committed_unit_key TEXT
  last_committed_unit_order INTEGER
  last_page_hash TEXT
  created_at TEXT NOT NULL
  updated_at TEXT NOT NULL
  finished_at TEXT
  raw_stage TEXT
  substage TEXT
  stage_detail TEXT
  progress_current INTEGER
  progress_total INTEGER
  progress_unit TEXT
  producer_seq INTEGER
  observation_payload_json TEXT NOT NULL DEFAULT '{}'
  FOREIGN KEY (job_id, attempt) REFERENCES pipeline_attempts(job_id, attempt) ON UPDATE NO ACTION ON DELETE CASCADE
  INDEX idx_pipeline_stage_status: CREATE INDEX idx_pipeline_stage_status ON pipeline_stages(job_id, attempt, status, stage_order)
  PRIMARY KEY (job_id, attempt, stage_key)
  TRIGGER sync_dirty_pipeline_stages_delete: CREATE TRIGGER sync_dirty_pipeline_stages_delete AFTER DELETE ON pipeline_stages WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard) BEGIN INSERT INTO sync_dirty(kind, entity_key, changed_at) VALUES('job', OLD.job_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at; END
  TRIGGER sync_dirty_pipeline_stages_insert: CREATE TRIGGER sync_dirty_pipeline_stages_insert AFTER INSERT ON pipeline_stages WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard) BEGIN INSERT INTO sync_dirty(kind, entity_key, changed_at) VALUES('job', NEW.job_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at; END
  TRIGGER sync_dirty_pipeline_stages_update: CREATE TRIGGER sync_dirty_pipeline_stages_update AFTER UPDATE ON pipeline_stages WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard) BEGIN INSERT INTO sync_dirty(kind, entity_key, changed_at) VALUES('job', NEW.job_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at; END

TABLE pipeline_units
  job_id TEXT NOT NULL PRIMARY KEY#1
  attempt INTEGER NOT NULL PRIMARY KEY#2
  stage_key TEXT NOT NULL PRIMARY KEY#3
  unit_key TEXT NOT NULL PRIMARY KEY#4
  unit_order INTEGER NOT NULL
  generation INTEGER NOT NULL
  producer_generation INTEGER
  status TEXT NOT NULL
  page_index INTEGER
  page_hash TEXT NOT NULL
  payload_json TEXT NOT NULL DEFAULT '{}'
  committed_at TEXT NOT NULL
  updated_at TEXT NOT NULL
  FOREIGN KEY (job_id, attempt, stage_key) REFERENCES pipeline_stages(job_id, attempt, stage_key) ON UPDATE NO ACTION ON DELETE CASCADE
  INDEX idx_pipeline_unit_order: CREATE INDEX idx_pipeline_unit_order ON pipeline_units(job_id, attempt, stage_key, unit_order)
  PRIMARY KEY (job_id, attempt, stage_key, unit_key)
  TRIGGER sync_dirty_pipeline_units_delete: CREATE TRIGGER sync_dirty_pipeline_units_delete AFTER DELETE ON pipeline_units WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard) BEGIN INSERT INTO sync_dirty(kind, entity_key, changed_at) VALUES('job', OLD.job_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at; END
  TRIGGER sync_dirty_pipeline_units_insert: CREATE TRIGGER sync_dirty_pipeline_units_insert AFTER INSERT ON pipeline_units WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard) BEGIN INSERT INTO sync_dirty(kind, entity_key, changed_at) VALUES('job', NEW.job_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at; END
  TRIGGER sync_dirty_pipeline_units_update: CREATE TRIGGER sync_dirty_pipeline_units_update AFTER UPDATE ON pipeline_units WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard) BEGIN INSERT INTO sync_dirty(kind, entity_key, changed_at) VALUES('job', NEW.job_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at; END

TABLE platform_settings
  id INTEGER PRIMARY KEY#1
  translation_model TEXT NOT NULL DEFAULT ''
  translation_base_url TEXT NOT NULL DEFAULT ''
  translation_api_protocol TEXT NOT NULL DEFAULT ''
  translation_thinking TEXT NOT NULL DEFAULT ''
  translation_max_workers INTEGER NOT NULL DEFAULT 0
  translation_credential_ref TEXT NOT NULL DEFAULT ''
  translation_credential_owned INTEGER NOT NULL DEFAULT 0
  ocr_provider TEXT NOT NULL DEFAULT ''
  ocr_credential_ref TEXT NOT NULL DEFAULT ''
  ocr_credential_owned INTEGER NOT NULL DEFAULT 0
  updated_at TEXT NOT NULL
  updated_by TEXT NOT NULL DEFAULT ''

TABLE sessions
  token_hash TEXT PRIMARY KEY#1
  user_id TEXT NOT NULL
  created_at TEXT NOT NULL
  expires_at TEXT NOT NULL
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON UPDATE NO ACTION ON DELETE CASCADE
  INDEX sessions_by_user: CREATE INDEX sessions_by_user ON sessions(user_id)
  PRIMARY KEY (token_hash)

TABLE sync_apply_guard
  singleton INTEGER PRIMARY KEY#1

TABLE sync_blobs
  sha256 TEXT NOT NULL PRIMARY KEY#1
  device TEXT NOT NULL PRIMARY KEY#2
  segment INTEGER NOT NULL PRIMARY KEY#3
  offset INTEGER NOT NULL
  length INTEGER NOT NULL
  INDEX idx_sync_blobs_pack: CREATE INDEX idx_sync_blobs_pack ON sync_blobs(device, segment)
  PRIMARY KEY (sha256, device, segment)

TABLE sync_cursors
  device_id TEXT PRIMARY KEY#1
  segment INTEGER NOT NULL
  PRIMARY KEY (device_id)

TABLE sync_dirty
  kind TEXT NOT NULL PRIMARY KEY#1
  entity_key TEXT NOT NULL PRIMARY KEY#2
  changed_at TEXT NOT NULL
  PRIMARY KEY (kind, entity_key)

TABLE sync_entities
  kind TEXT NOT NULL PRIMARY KEY#1
  entity_key TEXT NOT NULL PRIMARY KEY#2
  clock TEXT NOT NULL
  deleted INTEGER NOT NULL DEFAULT 0
  digest TEXT NOT NULL DEFAULT ''
  base_json TEXT NOT NULL DEFAULT ''
  clocks_json TEXT NOT NULL DEFAULT '{}'
  PRIMARY KEY (kind, entity_key)

TABLE sync_entity_files
  kind TEXT NOT NULL PRIMARY KEY#1
  entity_key TEXT NOT NULL PRIMARY KEY#2
  path TEXT NOT NULL PRIMARY KEY#3
  sha256 TEXT NOT NULL
  INDEX idx_sync_entity_files_path: CREATE INDEX idx_sync_entity_files_path ON sync_entity_files(path)
  PRIMARY KEY (kind, entity_key, path)

TABLE sync_file_cache
  path TEXT PRIMARY KEY#1
  size INTEGER NOT NULL
  mtime_ns INTEGER NOT NULL
  sha256 TEXT NOT NULL
  PRIMARY KEY (path)

TABLE sync_own_records
  kind TEXT NOT NULL PRIMARY KEY#1
  entity_key TEXT NOT NULL PRIMARY KEY#2
  segment INTEGER NOT NULL
  INDEX idx_sync_own_records_segment: CREATE INDEX idx_sync_own_records_segment ON sync_own_records(segment)
  PRIMARY KEY (kind, entity_key)

TABLE sync_pending
  kind TEXT NOT NULL PRIMARY KEY#1
  entity_key TEXT NOT NULL PRIMARY KEY#2
  clock TEXT NOT NULL
  record_json TEXT NOT NULL
  reason TEXT NOT NULL
  attempts INTEGER NOT NULL DEFAULT 0
  PRIMARY KEY (kind, entity_key)

TABLE sync_retired_packs
  device TEXT NOT NULL PRIMARY KEY#1
  segment INTEGER NOT NULL PRIMARY KEY#2
  since TEXT NOT NULL
  PRIMARY KEY (device, segment)

TABLE sync_state
  key TEXT PRIMARY KEY#1
  value TEXT NOT NULL
  PRIMARY KEY (key)

TABLE tags
  tag_id TEXT PRIMARY KEY#1
  name TEXT NOT NULL
  color TEXT NOT NULL DEFAULT ''
  created_at TEXT NOT NULL
  updated_at TEXT NOT NULL
  owner_user_id TEXT NOT NULL DEFAULT 'local'
  INDEX idx_tags_owner_name: CREATE INDEX idx_tags_owner_name ON tags(owner_user_id, name)
  PRIMARY KEY (tag_id)
  TRIGGER sync_dirty_tags_delete: CREATE TRIGGER sync_dirty_tags_delete AFTER DELETE ON tags WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard) BEGIN INSERT INTO sync_dirty(kind, entity_key, changed_at) VALUES('tag', OLD.tag_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at; END
  TRIGGER sync_dirty_tags_insert: CREATE TRIGGER sync_dirty_tags_insert AFTER INSERT ON tags WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard) BEGIN INSERT INTO sync_dirty(kind, entity_key, changed_at) VALUES('tag', NEW.tag_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at; END
  TRIGGER sync_dirty_tags_update: CREATE TRIGGER sync_dirty_tags_update AFTER UPDATE ON tags WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard) BEGIN INSERT INTO sync_dirty(kind, entity_key, changed_at) VALUES('tag', NEW.tag_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at; END

TABLE translation_version_jobs
  job_id TEXT PRIMARY KEY#1
  version_id TEXT NOT NULL
  FOREIGN KEY (job_id) REFERENCES jobs(job_id) ON UPDATE NO ACTION ON DELETE CASCADE
  FOREIGN KEY (version_id) REFERENCES translation_versions(version_id) ON UPDATE NO ACTION ON DELETE CASCADE
  INDEX idx_translation_version_jobs_version: CREATE INDEX idx_translation_version_jobs_version ON translation_version_jobs(version_id)
  PRIMARY KEY (job_id)

TABLE translation_versions
  version_id TEXT PRIMARY KEY#1
  document_id TEXT NOT NULL
  base_version_id TEXT
  origin TEXT NOT NULL DEFAULT ''
  label TEXT NOT NULL DEFAULT ''
  hidden_at TEXT
  created_at TEXT NOT NULL
  FOREIGN KEY (document_id) REFERENCES item_files(file_id) ON UPDATE NO ACTION ON DELETE CASCADE
  INDEX idx_translation_versions_document: CREATE INDEX idx_translation_versions_document ON translation_versions(document_id, created_at)
  PRIMARY KEY (version_id)

TABLE uploads
  upload_id TEXT PRIMARY KEY#1
  filename TEXT NOT NULL
  stored_path TEXT NOT NULL
  bytes INTEGER NOT NULL
  page_count INTEGER NOT NULL
  uploaded_at TEXT NOT NULL
  developer_mode INTEGER NOT NULL
  content_hash TEXT NOT NULL DEFAULT ''
  owner_user_id TEXT NOT NULL DEFAULT 'local'
  INDEX idx_uploads_content_hash: CREATE INDEX idx_uploads_content_hash ON uploads(content_hash)
  INDEX idx_uploads_owner: CREATE INDEX idx_uploads_owner ON uploads(owner_user_id)
  PRIMARY KEY (upload_id)
  TRIGGER sync_dirty_uploads_delete: CREATE TRIGGER sync_dirty_uploads_delete AFTER DELETE ON uploads WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard) BEGIN INSERT INTO sync_dirty(kind, entity_key, changed_at) VALUES('upload', OLD.upload_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at; END
  TRIGGER sync_dirty_uploads_insert: CREATE TRIGGER sync_dirty_uploads_insert AFTER INSERT ON uploads WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard) BEGIN INSERT INTO sync_dirty(kind, entity_key, changed_at) VALUES('upload', NEW.upload_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at; END
  TRIGGER sync_dirty_uploads_update: CREATE TRIGGER sync_dirty_uploads_update AFTER UPDATE ON uploads WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard) BEGIN INSERT INTO sync_dirty(kind, entity_key, changed_at) VALUES('upload', NEW.upload_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at; END

TABLE users
  user_id TEXT PRIMARY KEY#1
  username TEXT NOT NULL
  username_key TEXT NOT NULL
  password_hash TEXT NOT NULL
  role TEXT NOT NULL
  status TEXT NOT NULL
  must_change_password INTEGER NOT NULL DEFAULT 0
  failed_logins INTEGER NOT NULL DEFAULT 0
  locked_until TEXT NOT NULL DEFAULT ''
  created_at TEXT NOT NULL
  updated_at TEXT NOT NULL
  last_login_at TEXT NOT NULL DEFAULT ''
  deleted_at TEXT NOT NULL DEFAULT ''
  invite_id TEXT NOT NULL DEFAULT ''
  INDEX users_by_invite: CREATE INDEX users_by_invite ON users(invite_id) WHERE invite_id <> ''
  PRIMARY KEY (user_id)
  UNIQUE (username_key)
