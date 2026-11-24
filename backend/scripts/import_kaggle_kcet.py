"""Import the bundled KCET dataset without replacing other cutoff sources."""
import csv
import io
import re
import sys
import zipfile
from collections import defaultdict
from datetime import date
from pathlib import Path

from sqlalchemy import func, select

BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))

from app.database import Base, SessionLocal, engine
from app.models import CollegeCutoff


ARCHIVE_PATH = BACKEND_ROOT / "data" / "kcet_kaggle_2023_2025.zip"
DATASET_URL = "https://www.kaggle.com/datasets/sowmithns/kcet-college-admission-and-cutoff-trends-2023-2024"
EXPECTED_SOURCE_FILES = {
    f"kcet_{year}_r{round_number}{region}_dataset.csv"
    for year in (2023, 2024, 2025)
    for round_number in (1, 2, 3)
    for region in ("", "_HK")
} - {"kcet_2023_r3_dataset.csv"}
SOURCE_FILE_PATTERN = re.compile(r"kcet_(2023|2024|2025)_r([123])(_HK)?_dataset\.csv$")


def _csv_rows(archive, name):
    with archive.open(name) as source:
        yield from csv.DictReader(io.TextIOWrapper(source, encoding="utf-8-sig", newline=""))


def iter_kcet_records(archive_path=ARCHIVE_PATH, checked_on=None):
    checked_date = checked_on or date.today().isoformat()
    date.fromisoformat(checked_date)

    with zipfile.ZipFile(archive_path) as archive:
        names = set(archive.namelist())
        missing = EXPECTED_SOURCE_FILES - names
        if missing or "kcet_ai_ready.csv" not in names:
            raise ValueError(f"KCET archive is missing expected data files: {sorted(missing)}")

        quota_by_record = defaultdict(set)
        for row in _csv_rows(archive, "kcet_ai_ready.csv"):
            try:
                year = str(int(float(row["Year"])))
                rank = str(int(float(row["Cutoff_Rank"])))
                key = (row["CollegeID"], row["Category"], year, rank)
                quota_by_record[key].add((row["Quota"].strip(), row["Region"].strip()))
            except (KeyError, TypeError, ValueError, OverflowError) as exc:
                raise ValueError("KCET quota reference file contains an invalid row.") from exc

        seen = set()
        for name in sorted(names):
            match = SOURCE_FILE_PATTERN.fullmatch(Path(name).name)
            if not match:
                continue
            year, round_number, hk_region = match.groups()
            for row in _csv_rows(archive, name):
                try:
                    closing_rank = int(float(row["Cutoff_Rank"]))
                    key = (row["CollegeID"], row["Category"], year, str(closing_rank))
                    quota_values = quota_by_record[key]
                    if closing_rank < 1 or len(quota_values) != 1:
                        raise ValueError
                    quota, region = next(iter(quota_values))
                    if bool(hk_region) != (region == "Hyderabad-Karnataka"):
                        raise ValueError
                    record = {
                        "exam": "KCET",
                        "year": int(year),
                        "college_name": row["CollegeName"].strip(),
                        "course": row["CourseName"].strip(),
                        "state": "Karnataka",
                        "category": row["Category"].strip(),
                        "quota": f"{quota} / {region}",
                        "round": round_number,
                        "closing_rank": closing_rank,
                        "source_url": DATASET_URL,
                        "source_checked_on": checked_date,
                    }
                    unique_key = (
                        record["year"], row["CollegeID"], record["course"].casefold(),
                        record["category"], record["quota"], record["round"],
                    )
                    if unique_key in seen:
                        raise ValueError
                    seen.add(unique_key)
                    yield record
                except (KeyError, TypeError, ValueError, OverflowError) as exc:
                    raise ValueError(f"KCET archive contains an invalid or ambiguous row in {name}.") from exc


def import_if_missing():
    if not ARCHIVE_PATH.is_file():
        raise FileNotFoundError(f"Bundled KCET data archive was not found: {ARCHIVE_PATH}")

    Base.metadata.create_all(bind=engine)
    session = SessionLocal()
    try:
        existing_count = session.scalar(
            select(func.count())
            .select_from(CollegeCutoff)
            .where(CollegeCutoff.source_url == DATASET_URL)
        ) or 0
        if existing_count:
            print(f"Skipped KCET seed import; {existing_count} source rows already exist.")
            return 0

        total = 0
        batch = []
        for record in iter_kcet_records():
            batch.append(record)
            if len(batch) == 1000:
                session.execute(CollegeCutoff.__table__.insert(), batch)
                total += len(batch)
                batch.clear()
        if batch:
            session.execute(CollegeCutoff.__table__.insert(), batch)
            total += len(batch)
        if total == 0:
            raise ValueError("KCET source archive contained no records.")
        session.commit()
        print(f"Imported {total} KCET rows (2023-2025) from the Kaggle source archive.")
        print("These third-party records are historical and have not been independently verified against KEA.")
        return total
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


if __name__ == "__main__":
    import_if_missing()
