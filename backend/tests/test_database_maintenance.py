import os
import sqlite3
from datetime import datetime, timedelta, timezone

import pytest

from scripts import database_maintenance


def test_sqlite_backup_retention_and_confirmed_restore(tmp_path, monkeypatch):
    database_path = tmp_path / "careercompass.db"
    with sqlite3.connect(database_path) as connection:
        connection.execute("CREATE TABLE sample (value TEXT NOT NULL)")
        connection.execute("INSERT INTO sample VALUES ('before-backup')")
    monkeypatch.setattr(
        database_maintenance.settings,
        "database_url",
        f"sqlite:///{database_path.as_posix()}",
    )

    backup_dir = tmp_path / "backups"
    stale_backup = backup_dir / "careercompass-old.sqlite3"
    unrelated_file = backup_dir / "keep.txt"
    backup_dir.mkdir()
    stale_backup.write_bytes(b"old")
    unrelated_file.write_text("keep", encoding="utf-8")
    old_timestamp = (datetime.now(timezone.utc) - timedelta(days=40)).timestamp()
    os.utime(stale_backup, (old_timestamp, old_timestamp))

    backup_path = database_maintenance.backup(backup_dir, retention_days=30)
    with sqlite3.connect(database_path) as connection:
        connection.execute("INSERT INTO sample VALUES ('after-backup')")

    with pytest.raises(ValueError, match="confirm-overwrite"):
        database_maintenance.restore(backup_path, confirm_overwrite=False)
    database_maintenance.restore(backup_path, confirm_overwrite=True)

    with sqlite3.connect(database_path) as connection:
        values = connection.execute("SELECT value FROM sample ORDER BY value").fetchall()
    assert values == [("before-backup",)]
    assert not stale_backup.exists()
    assert unrelated_file.read_text(encoding="utf-8") == "keep"
