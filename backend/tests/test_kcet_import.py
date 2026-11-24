from pathlib import Path

from sqlalchemy import func, select, create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base
from app.models import CollegeCutoff
from scripts import import_kaggle_kcet
from scripts.import_kaggle_kcet import ARCHIVE_PATH, iter_kcet_records


def test_bundled_kcet_rows_keep_round_quota_and_kaggle_provenance():
    assert ARCHIVE_PATH.is_file()
    first = next(iter_kcet_records(ARCHIVE_PATH, checked_on="2026-11-19"))

    assert first["exam"] == "KCET"
    assert first["year"] in {2023, 2024, 2025}
    assert first["state"] == "Karnataka"
    assert first["round"] in {"1", "2", "3"}
    assert first["closing_rank"] > 0
    assert "kaggle.com" in first["source_url"]
    assert first["source_checked_on"] == "2026-11-19"
    assert " / " in first["quota"]


def test_bundled_kcet_dataset_contains_expected_record_count():
    records = iter_kcet_records(ARCHIVE_PATH, checked_on="2026-11-19")
    assert sum(1 for _ in records) == 151_974


def test_kcet_seed_is_source_scoped_and_preserves_other_sources(monkeypatch):
    test_engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=test_engine)
    test_session_factory = sessionmaker(bind=test_engine, autoflush=False, autocommit=False)
    with test_session_factory() as session:
        session.add(
            CollegeCutoff(
                exam="JEE Main",
                year=2025,
                college_name="JoSAA Test Institute",
                course="Computer Science",
                state="All India",
                category="OPEN",
                quota="AI",
                round="1",
                closing_rank=1000,
                source_url="https://example.org/josaa",
                source_checked_on="2026-11-19",
            )
        )
        session.commit()

    record = {
        "exam": "KCET",
        "year": 2025,
        "college_name": "KEA Test College",
        "course": "Computer Science",
        "state": "Karnataka",
        "category": "GM",
        "quota": "Government",
        "round": "1",
        "closing_rank": 1000,
        "source_url": import_kaggle_kcet.DATASET_URL,
        "source_checked_on": "2026-11-19",
    }
    monkeypatch.setattr(import_kaggle_kcet, "engine", test_engine)
    monkeypatch.setattr(import_kaggle_kcet, "SessionLocal", test_session_factory)
    monkeypatch.setattr(import_kaggle_kcet, "iter_kcet_records", lambda: iter([record]))

    assert import_kaggle_kcet.import_if_missing() == 1
    assert import_kaggle_kcet.import_if_missing() == 0
    with test_session_factory() as session:
        counts = dict(session.execute(select(CollegeCutoff.exam, func.count()).group_by(CollegeCutoff.exam)).all())
    assert counts == {"JEE Main": 1, "KCET": 1}
    test_engine.dispose()


