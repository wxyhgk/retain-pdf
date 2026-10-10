-- remember cleanup on each source, including children consumed only
-- through a parent's feed. Rerendering must not resurrect expired history.
ALTER TABLE event_source_versions ADD COLUMN retention_cutoff TEXT;
INSERT INTO event_source_versions(job_id, revision, retention_cutoff)
    SELECT owner_job_id, 1, retention_cutoff FROM event_feeds
    WHERE retention_cutoff IS NOT NULL
    ON CONFLICT(job_id) DO UPDATE SET
        revision = revision + 1, retention_cutoff = excluded.retention_cutoff;
INSERT INTO event_source_versions(job_id, revision, retention_cutoff)
    SELECT jobs.job_id, 1, event_feed_retention.cutoff
    FROM jobs CROSS JOIN event_feed_retention
    WHERE jobs.status_json IN ('"succeeded"', '"failed"', '"canceled"')
    ON CONFLICT(job_id) DO UPDATE SET
        revision = revision + 1, retention_cutoff = excluded.retention_cutoff
    WHERE retention_cutoff IS NULL OR retention_cutoff < excluded.retention_cutoff;
