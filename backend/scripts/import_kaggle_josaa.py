"""Import the bundled CC BY-SA 4.0 JoSAA historical rank compilation."""
import csv
import io
import re
import sys
import zipfile
from collections import Counter
from datetime import date
from decimal import Decimal, InvalidOperation
from pathlib import Path

from sqlalchemy import func, select

BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))

from app.database import Base, SessionLocal, engine
from app.models import CollegeCutoff


ARCHIVE_PATH = BACKEND_ROOT / "data" / "josaa_kaggle_2016_2026.zip"
DATASET_URL = "https://www.kaggle.com/datasets/gopikrishnan2005/josaa-opening-and-closing-ranks-dataset-20162026"
ROUND_COUNTS = {
    2016: 6,
    2017: 7,
    2018: 7,
    2019: 7,
    2020: 6,
    2021: 6,
    2022: 6,
    2023: 6,
    2024: 5,
    2025: 6,
    2026: 1,
}
EXPECTED_SOURCE_FILES = {
    f"{year}_round_{round_number}.csv"
    for year, round_count in ROUND_COUNTS.items()
    for round_number in range(1, round_count + 1)
}
SOURCE_FILE_PATTERN = re.compile(r"(201[6-9]|202[0-6])_round_([1-7])\.csv$")
REQUIRED_COLUMNS = {
    "Institute",
    "Academic Program Name",
    "Quota",
    "Seat Type",
    "Opening Rank",
    "Closing Rank",
}


def _parse_rank(raw_value):
    value = (raw_value or "").strip()
    preparatory = value.endswith("P")
    if preparatory:
        value = value[:-1]
    try:
        rank = Decimal(value)
    except InvalidOperation:
        return None, preparatory
    if not rank.is_finite() or rank <= 0 or rank != rank.to_integral_value():
        return None, preparatory
    return int(rank), preparatory


def _exam_for_institute(institute):
    normalized = institute.casefold()
    if normalized.startswith("indian institute of technology") or normalized.startswith("indian institute of science,"):
        return "JEE Advanced"
    return "JEE Main"


def iter_josaa_records(archive_path=ARCHIVE_PATH, checked_on=None, skipped=None):
    checked_date = checked_on or date.today().isoformat()
    date.fromisoformat(checked_date)
    skipped = skipped if skipped is not None else Counter()

    with zipfile.ZipFile(archive_path) as archive:
        names = set(archive.namelist())
        missing = EXPECTED_SOURCE_FILES - names
        if missing:
            raise ValueError(f"JoSAA archive is missing expected data files: {sorted(missing)}")

        for name in sorted(names):
            match = SOURCE_FILE_PATTERN.fullmatch(Path(name).name)
            if not match:
                continue
            year, round_number = (int(value) for value in match.groups())
            with archive.open(name) as source:
                reader = csv.DictReader(io.TextIOWrapper(source, encoding="utf-8-sig", newline=""))
                if not reader.fieldnames or not REQUIRED_COLUMNS.issubset(reader.fieldnames):
                    raise ValueError(f"JoSAA archive has an invalid header in {name}.")

                for row in reader:
                    if not any(str(value or "").strip() for value in row.values()):
                        skipped["empty_row"] += 1
                        continue
                    institute = (row.get("Institute") or "").strip()
                    course = (row.get("Academic Program Name") or "").strip()
                    quota = (row.get("Quota") or "").strip()
                    category = (row.get("Seat Type") or "").strip()
                    if not institute or not course or not quota or not category:
                        raise ValueError(f"JoSAA archive contains a row missing required cutoff fields in {name}.")

                    opening_rank, opening_preparatory = _parse_rank(row.get("Opening Rank"))
                    closing_rank, closing_preparatory = _parse_rank(row.get("Closing Rank"))
                    if opening_rank is None or closing_rank is None:
                        skipped["missing_or_non_integer_rank"] += 1
                        continue
                    if opening_preparatory or closing_preparatory:
                        skipped["preparatory_rank"] += 1
                        continue

                    gender = (row.get("Gender") or "").strip()
                    quota_details = gender or "Gender not specified in source"
                    yield {
                        "exam": _exam_for_institute(institute),
                        "year": year,
                        "college_name": institute,
                        "course": course,
                        "state": "All India",
                        "category": category,
                        "quota": f"{quota} / {quota_details}",
                        "round": str(round_number),
                        "closing_rank": closing_rank,
                        "source_url": DATASET_URL,
                        "source_checked_on": checked_date,
                    }


def import_if_missing():
    if not ARCHIVE_PATH.is_file():
        raise FileNotFoundError(f"Bundled JoSAA data archive was not found: {ARCHIVE_PATH}")

    Base.metadata.create_all(bind=engine)
    session = SessionLocal()
    try:
        existing_count = session.scalar(
            select(func.count())
            .select_from(CollegeCutoff)
            .where(CollegeCutoff.source_url == DATASET_URL)
        ) or 0
        if existing_count:
            print(f"Skipped JoSAA seed import; {existing_count} source rows already exist.")
            return 0

        skipped = Counter()
        total = 0
        batch = []
        for record in iter_josaa_records(skipped=skipped):
            batch.append(record)
            if len(batch) == 1000:
                session.execute(CollegeCutoff.__table__.insert(), batch)
                total += len(batch)
                batch.clear()
        if batch:
            session.execute(CollegeCutoff.__table__.insert(), batch)
            total += len(batch)
        if total == 0:
            raise ValueError("JoSAA source archive contained no usable records.")
        session.commit()
        print(f"Imported {total} JoSAA rows (2016-2026) from the Kaggle source archive.")
        print(
            "Excluded "
            f"{skipped['preparatory_rank']} preparatory-rank rows and "
            f"{skipped['missing_or_non_integer_rank']} rows with missing or non-integer ranks, "
            f"plus {skipped['empty_row']} empty rows."
        )
        print("These third-party records have not been independently reconciled against JoSAA.")
        return total
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


if __name__ == "__main__":
    import_if_missing()
