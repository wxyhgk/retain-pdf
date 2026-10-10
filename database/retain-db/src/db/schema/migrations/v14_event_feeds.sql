-- durable event identities and owner-scoped, rebuildable read feeds.
-- Source versions deliberately outlive job deletion: a reused job/sequence
-- identity must never accidentally validate an old source checkpoint.
CREATE INDEX idx_jobs_document_updated
    ON jobs(document_id, updated_at DESC, job_id DESC);
CREATE INDEX idx_events_translation_commit
    ON events(job_id, seq)
    WHERE event = 'pipeline_unit_committed' AND stage = 'translate';

ALTER TABLE events ADD COLUMN event_uid TEXT NOT NULL DEFAULT '';
UPDATE events SET event_uid = lower(hex(randomblob(16))) WHERE event_uid = '';
CREATE UNIQUE INDEX idx_events_uid ON events(event_uid) WHERE event_uid <> '';
CREATE TABLE event_source_versions (
    job_id TEXT PRIMARY KEY,
    high_seq INTEGER NOT NULL DEFAULT 0,
    revision INTEGER NOT NULL DEFAULT 0
);
INSERT INTO event_source_versions(job_id, high_seq)
    SELECT job_id, MAX(seq) FROM events GROUP BY job_id;

CREATE TRIGGER events_assign_uid AFTER INSERT ON events WHEN NEW.event_uid = ''
BEGIN
    UPDATE events SET event_uid = lower(hex(randomblob(16)))
    WHERE job_id = NEW.job_id AND seq = NEW.seq;
END;
CREATE TRIGGER events_immutable_uid BEFORE UPDATE OF event_uid ON events
    WHEN OLD.event_uid <> '' AND NEW.event_uid IS NOT OLD.event_uid
BEGIN
    SELECT RAISE(ABORT, 'event_uid is immutable');
END;
CREATE TRIGGER events_source_insert AFTER INSERT ON events
BEGIN
    INSERT INTO event_source_versions(job_id, high_seq, revision)
    VALUES(NEW.job_id, NEW.seq, 0)
    ON CONFLICT(job_id) DO UPDATE SET
        revision = revision + CASE WHEN NEW.seq <= high_seq THEN 1 ELSE 0 END,
        high_seq = MAX(high_seq, NEW.seq);
END;
CREATE TRIGGER events_source_update AFTER UPDATE OF
    job_id, seq, ts, level, stage, stage_detail, provider, provider_stage,
    event, event_type, progress_current, progress_total, payload_json,
    retry_count, elapsed_ms, message ON events
BEGIN
    INSERT INTO event_source_versions(job_id, high_seq, revision)
    VALUES(OLD.job_id, OLD.seq, 1)
    ON CONFLICT(job_id) DO UPDATE SET revision = revision + 1;
    INSERT INTO event_source_versions(job_id, high_seq, revision)
    SELECT NEW.job_id, NEW.seq, 1 WHERE NEW.job_id <> OLD.job_id
    ON CONFLICT(job_id) DO UPDATE SET
        revision = revision + 1, high_seq = MAX(high_seq, NEW.seq);
    UPDATE event_source_versions SET high_seq = MAX(high_seq, NEW.seq)
    WHERE job_id = NEW.job_id;
END;
CREATE TRIGGER events_source_delete AFTER DELETE ON events
BEGIN
    INSERT INTO event_source_versions(job_id, high_seq, revision)
    VALUES(OLD.job_id, OLD.seq, 1)
    ON CONFLICT(job_id) DO UPDATE SET revision = revision + 1;
END;

CREATE TABLE event_feeds (
    owner_job_id TEXT PRIMARY KEY REFERENCES jobs(job_id) ON DELETE CASCADE,
    epoch TEXT NOT NULL,
    revision INTEGER NOT NULL,
    context TEXT NOT NULL,
    checkpoints_json TEXT NOT NULL,
    high_seq INTEGER NOT NULL DEFAULT 0,
    retention_cutoff TEXT
);
CREATE TABLE event_feed_items (
    owner_job_id TEXT NOT NULL REFERENCES event_feeds(owner_job_id) ON DELETE CASCADE,
    seq INTEGER NOT NULL,
    source_key TEXT NOT NULL,
    event_id TEXT NOT NULL,
    ts TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    PRIMARY KEY(owner_job_id, seq),
    UNIQUE(owner_job_id, source_key),
    UNIQUE(owner_job_id, event_id)
);
CREATE TABLE event_feed_retention (
    singleton INTEGER PRIMARY KEY CHECK(singleton = 1),
    cutoff TEXT NOT NULL
);
