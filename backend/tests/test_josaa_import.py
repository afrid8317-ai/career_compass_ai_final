from collections import Counter

from scripts.import_kaggle_josaa import (
    ARCHIVE_PATH,
    _exam_for_institute,
    _parse_rank,
    iter_josaa_records,
)


def test_josaa_archive_import_preserves_round_category_and_provenance():
    assert ARCHIVE_PATH.is_file()
    skipped = Counter()
    records = iter_josaa_records(ARCHIVE_PATH, checked_on="2026-11-19", skipped=skipped)
    first = next(records)

    assert first["exam"] == "JEE Advanced"
    assert first["year"] == 2016
    assert first["state"] == "All India"
    assert first["round"] == "1"
    assert first["category"] == "OPEN"
    assert first["quota"].startswith("AI / ")
    assert first["closing_rank"] > 0
    assert "gopikrishnan2005" in first["source_url"]
    assert first["source_checked_on"] == "2026-11-19"


def test_josaa_archive_skips_unusable_and_preparatory_ranks():
    skipped = Counter()
    records = iter_josaa_records(ARCHIVE_PATH, checked_on="2026-11-19", skipped=skipped)

    assert sum(1 for _ in records) == 527_316
    assert skipped == Counter(
        {
            "preparatory_rank": 8_875,
            "missing_or_non_integer_rank": 488,
            "empty_row": 50,
        }
    )


def test_josaa_rank_parsing_and_exam_mapping_are_explicit():
    assert _parse_rank("2273.0") == (2273, False)
    assert _parse_rank("687P") == (687, True)
    assert _parse_rank("1469.1") == (None, False)
    assert _exam_for_institute("Indian Institute of Technology Madras") == "JEE Advanced"
    assert _exam_for_institute("Indian Institute of Science, Bangalore") == "JEE Advanced"
    assert _exam_for_institute("National Institute of Technology, Tiruchirappalli") == "JEE Main"
