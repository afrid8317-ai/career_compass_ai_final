from __future__ import annotations

from typing import Any

from .schemas import CollegeSearchIn


_CATEGORY_MULTIPLIERS = {
    "General": 1.0,
    "OBC": 1.25,
    "EWS": 1.2,
    "SC": 4.0,
    "ST": 7.5,
}

_CATEGORY_ALIASES = {
    "general": "General",
    "gen": "General",
    "open": "General",
    "obc": "OBC",
    "obc-ncl": "OBC",
    "ews": "EWS",
    "sc": "SC",
    "st": "ST",
}

# These are representative institution names with deliberately synthetic rank references.
_COLLEGES = (
    ("MBBS", "AIIMS New Delhi", "Delhi", 30),
    ("MBBS", "Vardhman Mahavir Medical College and Safdarjung Hospital", "Delhi", 180),
    ("MBBS", "JIPMER Puducherry", "Puducherry", 250),
    ("MBBS", "AIIMS Jodhpur", "Rajasthan", 350),
    ("MBBS", "Institute of Medical Sciences, BHU", "Uttar Pradesh", 450),
    ("MBBS", "AIIMS Rishikesh", "Uttarakhand", 600),
    ("MBBS", "AIIMS Bhubaneswar", "Odisha", 700),
    ("MBBS", "AIIMS Bhopal", "Madhya Pradesh", 800),
    ("MBBS", "King George's Medical University", "Uttar Pradesh", 1000),
    ("MBBS", "Madras Medical College", "Tamil Nadu", 1250),
    ("MBBS", "Seth GS Medical College", "Maharashtra", 1500),
    ("MBBS", "AIIMS Patna", "Bihar", 2200),
    ("MBBS", "Government Medical College Thiruvananthapuram", "Kerala", 2500),
    ("MBBS", "B. J. Government Medical College Pune", "Maharashtra", 3200),
    ("MBBS", "AIIMS Raipur", "Chhattisgarh", 4000),
    ("MBBS", "AIIMS Deoghar", "Jharkhand", 7000),
    ("MBBS", "AIIMS Guwahati", "Assam", 8500),
    ("BDS", "Maulana Azad Institute of Dental Sciences", "Delhi", 700),
    ("BDS", "Faculty of Dental Sciences, IMS BHU", "Uttar Pradesh", 1800),
    ("BDS", "Government Dental College and Hospital Mumbai", "Maharashtra", 3000),
    ("BDS", "Tamil Nadu Government Dental College", "Tamil Nadu", 4200),
    ("BDS", "Government Dental College and Research Institute Bengaluru", "Karnataka", 4800),
    ("BDS", "Dr. R. Ahmed Dental College and Hospital", "West Bengal", 6200),
    ("BDS", "Government Dental College Thiruvananthapuram", "Kerala", 7500),
    ("BDS", "Government Dental College Jaipur", "Rajasthan", 8200),
)

_DEMO_MESSAGE = (
    "Illustrative NEET demo only: rank references are synthetic, are not MCC allotment or historical cutoff data, "
    "and do not indicate eligibility or admission chances. The sample covers ranks 1–10,000, AIQ-style demo "
    "entries, and General/OBC/EWS/SC/ST labels. The selected year and counselling round are not represented. "
    "Verify real counselling information with MCC."
)


def _no_matches(status: str, message: str, filters: dict[str, Any]) -> dict[str, Any]:
    return {"status": status, "message": message, "received_filters": filters, "matches": []}


def search_neet_demo(payload: CollegeSearchIn) -> dict[str, Any]:
    filters = payload.model_dump()
    if not payload.rank or not payload.rank.strip().isdigit() or int(payload.rank.strip()) < 1:
        return _no_matches(
            "rank_required",
            "Enter a positive numeric NEET rank to view illustrative demo examples.",
            filters,
        )

    rank = int(payload.rank.strip())
    if rank > 10_000:
        return _no_matches(
            "demo_range_exceeded",
            "The illustrative NEET demo set covers ranks 1–10,000 only. This is not a real cutoff boundary.",
            filters,
        )

    requested_category = (payload.category or "").strip().casefold()
    category = _CATEGORY_ALIASES.get(requested_category, "General" if not requested_category else None)
    if category is None:
        return _no_matches(
            "unsupported_demo_category",
            "NEET demo categories are General, OBC/OBC-NCL, EWS, SC, and ST. These labels do not model official seat rules.",
            filters,
        )

    requested_courses = [course.strip().casefold() for course in payload.courses if course.strip()]
    if payload.course and payload.course.strip():
        requested_courses.append(payload.course.strip().casefold())
    courses = [
        course for course in ("MBBS", "BDS")
        if not requested_courses or any(
            course.casefold() in requested
            or requested in course.casefold()
            for requested in requested_courses
        )
    ]
    if not courses:
        return _no_matches(
            "unsupported_demo_course",
            "The NEET demo examples include MBBS and BDS only.",
            filters,
        )

    requested_quota = (payload.quota or "").casefold().replace("/", " ").replace("-", " ").split()
    if payload.quota and not any(token in {"ai", "aiq", "all", "india"} for token in requested_quota):
        return _no_matches(
            "unsupported_demo_quota",
            "The NEET demo set represents an illustrative all-India pool only; it does not reproduce MCC quotas.",
            filters,
        )

    requested_region = payload.region.strip().casefold()
    rows = []
    for course, college_name, state, general_rank in _COLLEGES:
        if course not in courses:
            continue
        if requested_region not in {"all", "all india"} and requested_region not in state.casefold():
            continue
        closing_rank = min(10_000, max(1, round(general_rank * _CATEGORY_MULTIPLIERS[category])))
        rows.append({
            "college_name": college_name,
            "course": course,
            "state": state,
            "year": None,
            "category": category,
            "quota": "AIQ-style demo",
            "round": "Illustrative demo",
            "historical_closing_rank": None,
            "demo_rank_reference": closing_rank,
            "advisory_band": "Demo",
            "source_url": "",
            "source_checked_on": None,
            "is_demo": True,
        })

    if payload.round:
        return _no_matches(
            "unsupported_demo_round",
            "Counselling-round filters do not apply to the illustrative NEET demo set.",
            filters,
        )
    if not rows:
        return _no_matches(
            "no_demo_matches",
            "No illustrative NEET examples matched those course and region filters.",
            filters,
        )

    rows.sort(key=lambda row: (abs(row["demo_rank_reference"] - rank), row["demo_rank_reference"], row["college_name"]))
    return {
        "status": "demo_matches",
        "message": _DEMO_MESSAGE,
        "received_filters": filters,
        "matches": rows[:20],
    }
