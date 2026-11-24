"""Create and restore explicit local SQLite or PostgreSQL backups."""
import argparse
import os
import shutil
import sqlite3
import subprocess
from contextlib import closing
from datetime import datetime, timedelta, timezone
from pathlib import Path

from sqlalchemy.engine import make_url

from app.config import settings


BACKUP_PREFIX = "careercompass-"


def _database_url():
    return make_url(settings.database_url)


def _sqlite_path():
    url = _database_url()
    if url.get_backend_name() != "sqlite" or url.database in (None, "", ":memory:"):
        raise ValueError("The configured SQLite database must be a file-backed database.")
    path = Path(url.database)
    return path if path.is_absolute() else Path.cwd() / path


def _postgres_environment():
    url = _database_url()
    if url.get_backend_name() != "postgresql":
        raise ValueError("The configured database is not PostgreSQL.")
    environment = os.environ.copy()
    environment.update({
        "PGHOST":url.host or "localhost",
        "PGPORT":str(url.port or 5432),
        "PGUSER":url.username or "",
        "PGPASSWORD":url.password or "",
        "PGDATABASE":url.database or "",
    })
    if url.query.get("sslmode"):
        environment["PGSSLMODE"] = str(url.query["sslmode"])
    return environment


def _run_postgres_tool(tool, arguments):
    executable = shutil.which(tool)
    if not executable:
        raise RuntimeError(f"{tool} is required for PostgreSQL backups but was not found on PATH.")
    result = subprocess.run(
        [executable, *arguments],
        env=_postgres_environment(),
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode:
        raise RuntimeError(f"{tool} failed with exit code {result.returncode}; check database access and client compatibility.")


def _backup_sqlite(output_path):
    source_path = _sqlite_path()
    if not source_path.is_file():
        raise FileNotFoundError(f"Configured SQLite database does not exist: {source_path}")
    with closing(sqlite3.connect(source_path)) as source, closing(sqlite3.connect(output_path)) as target:
        source.backup(target)
        check = target.execute("PRAGMA integrity_check").fetchone()
        if not check or check[0] != "ok":
            raise RuntimeError("The SQLite backup failed its integrity check.")


def _backup_postgres(output_path):
    try:
        _run_postgres_tool("pg_dump", ["--format=custom", "--no-owner", f"--file={output_path}"])
    except RuntimeError:
        output_path.unlink(missing_ok=True)
        raise


def _prune_backups(directory, retention_days):
    cutoff = datetime.now(timezone.utc) - timedelta(days=retention_days)
    for candidate in directory.iterdir():
        if not candidate.is_file() or not candidate.name.startswith(BACKUP_PREFIX):
            continue
        if candidate.suffix not in {".sqlite3", ".dump"}:
            continue
        modified = datetime.fromtimestamp(candidate.stat().st_mtime, timezone.utc)
        if modified < cutoff:
            candidate.unlink()


def backup(directory, retention_days):
    if retention_days < 1:
        raise ValueError("Retention must be at least one day.")
    output_dir = Path(directory).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    suffix = ".sqlite3" if _database_url().get_backend_name() == "sqlite" else ".dump"
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    output_path = output_dir / f"{BACKUP_PREFIX}{timestamp}{suffix}"
    try:
        if suffix == ".sqlite3":
            _backup_sqlite(output_path)
        else:
            _backup_postgres(output_path)
    except Exception:
        output_path.unlink(missing_ok=True)
        raise
    if os.name != "nt":
        output_path.chmod(0o600)
    _prune_backups(output_dir, retention_days)
    return output_path


def restore(source, confirm_overwrite):
    source_path = Path(source).resolve(strict=True)
    if not confirm_overwrite:
        raise ValueError("Restoring overwrites the active database; pass --confirm-overwrite to proceed.")
    if not source_path.is_file() or not source_path.name.startswith(BACKUP_PREFIX):
        raise ValueError("Choose a regular CareerCompass backup file.")

    backend = _database_url().get_backend_name()
    if backend == "sqlite":
        destination = _sqlite_path().resolve()
        if source_path == destination:
            raise ValueError("The backup file cannot be the active database file.")
        with closing(sqlite3.connect(source_path)) as source_db, closing(sqlite3.connect(destination)) as target_db:
            integrity = source_db.execute("PRAGMA integrity_check").fetchone()
            if not integrity or integrity[0] != "ok":
                raise RuntimeError("The selected SQLite backup is not valid.")
            source_db.backup(target_db)
    elif backend == "postgresql":
        _run_postgres_tool(
            "pg_restore",
            ["--clean", "--if-exists", "--no-owner", "--single-transaction", f"--dbname={_postgres_environment()['PGDATABASE']}", str(source_path)],
        )
    else:
        raise ValueError(f"Backups are not supported for database backend {backend}.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    backup_parser = commands.add_parser("backup", help="Create a verified database backup.")
    backup_parser.add_argument("--directory", default="backups")
    backup_parser.add_argument("--retention-days", type=int, default=30)
    restore_parser = commands.add_parser("restore", help="Restore a backup over the configured database.")
    restore_parser.add_argument("source")
    restore_parser.add_argument("--confirm-overwrite", action="store_true")
    args = parser.parse_args()

    if args.command == "backup":
        print(backup(args.directory, args.retention_days))
    else:
        restore(args.source, args.confirm_overwrite)
        print("Database restore completed.")


if __name__ == "__main__":
    main()
