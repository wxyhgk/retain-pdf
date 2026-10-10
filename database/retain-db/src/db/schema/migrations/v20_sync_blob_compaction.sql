-- 同步文件夹的整理与回收(格式 3)。
-- - sync_blobs 一份内容可以记几个位置:重新打包后新旧包里都有,两台设备也可能各传过一份;
-- - sync_own_records:本机发出的每个实体的最后一条改动记录在哪一段(整理时只读这些段);
-- - sync_retired_packs:各设备停用的包(将要删除或已经删了),不再往里引用、取文件时排最后。
CREATE TABLE sync_blobs_v20 (
    sha256  TEXT NOT NULL,
    device  TEXT NOT NULL,
    segment INTEGER NOT NULL,
    offset  INTEGER NOT NULL,
    length  INTEGER NOT NULL,
    PRIMARY KEY(sha256, device, segment)
);
INSERT INTO sync_blobs_v20(sha256, device, segment, offset, length)
    SELECT sha256, device, segment, offset, length FROM sync_blobs;
DROP TABLE sync_blobs;
ALTER TABLE sync_blobs_v20 RENAME TO sync_blobs;
CREATE INDEX idx_sync_blobs_pack ON sync_blobs(device, segment);
CREATE TABLE sync_own_records (
    kind       TEXT NOT NULL,
    entity_key TEXT NOT NULL,
    segment    INTEGER NOT NULL,
    PRIMARY KEY(kind, entity_key)
);
CREATE INDEX idx_sync_own_records_segment ON sync_own_records(segment);
CREATE TABLE sync_retired_packs (
    device  TEXT NOT NULL,
    segment INTEGER NOT NULL,
    since   TEXT NOT NULL,
    PRIMARY KEY(device, segment)
);
