-- 同步文件夹里的文件按段打包(格式 2)。记下每份文件内容在哪台设备、哪一段的包里、
-- 什么位置:收的时候按位置取,发的时候已经在某个包里的不再重复上传。
CREATE TABLE sync_blobs (
    sha256  TEXT PRIMARY KEY,
    device  TEXT NOT NULL,
    segment INTEGER NOT NULL,
    offset  INTEGER NOT NULL,
    length  INTEGER NOT NULL
);
