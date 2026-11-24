"""API smoke and account-isolation tests; run with `pytest -q` from backend/."""
import json
from urllib.parse import parse_qs, urlparse

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import main as main_module
from app.database import Base, get_db
from app.main import app
from app.models import CollegeCutoff


@pytest.fixture()
def client():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSession = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    Base.metadata.create_all(bind=engine)

    def override_get_db():
        db = TestingSession()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


def register(client, email="student@example.com"):
    response = client.post("/api/auth/register", json={"name": "Test Student", "email": email, "password": "StrongPass123!"})
    assert response.status_code == 201, response.text
    return response.json()


class OAuthResponse:
    def __init__(self, payload):
        self.payload = json.dumps(payload).encode()

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def read(self):
        return self.payload


def test_local_frontend_origins_can_register_across_loopback_ports(client):
    if main_module.settings.environment == "production":
        pytest.skip("Development loopback origins are intentionally disabled in production.")
    for origin in ("http://localhost:5173", "http://127.0.0.1:5173", "http://127.0.0.1:5174"):
        response = client.options(
            "/api/v1/auth/register",
            headers={
                "Origin": origin,
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "content-type",
            },
        )
        assert response.status_code == 200
        assert response.headers["access-control-allow-origin"] == origin
    response = client.post(
        "/api/v1/auth/register",
        headers={"Origin": "http://127.0.0.1:5173"},
        json={"name": "Loopback Student", "email": "loopback-student@example.com", "password": "StrongPass123!"},
    )
    assert response.status_code == 201, response.text
    assert response.headers["access-control-allow-origin"] == "http://127.0.0.1:5173"


def test_google_oauth_status_and_start_require_client_credentials(client, monkeypatch):
    monkeypatch.setattr(main_module.settings, "google_client_id", "google-client")
    monkeypatch.setattr(main_module.settings, "google_client_secret", "")

    assert client.get("/api/v1/auth/oauth/providers").json() == {"google": False}
    assert client.get("/api/v1/auth/oauth/google").status_code == 503
    assert client.get("/api/v1/auth/oauth/github").status_code == 404
    assert client.get("/api/v1/auth/oauth/github/callback").status_code == 404


def test_google_oauth_callback_creates_account_from_verified_profile(client, monkeypatch):
    monkeypatch.setattr(main_module.settings, "google_client_id", "google-client")
    monkeypatch.setattr(main_module.settings, "google_client_secret", "google-secret")

    def fake_urlopen(request, data=None, timeout=None):
        url = request if isinstance(request, str) else request.full_url
        if "oauth2.googleapis.com/token" in url:
            return OAuthResponse({"access_token": "google-access"})
        if "openidconnect.googleapis.com/v1/userinfo" in url:
            return OAuthResponse({
                "sub": "google-subject",
                "email": "google-user@example.com",
                "email_verified": True,
                "name": "Google User",
            })
        raise AssertionError(f"Unexpected Google URL: {url}")

    monkeypatch.setattr(main_module.urllib.request, "urlopen", fake_urlopen)
    state = main_module.create_purpose_token("oauth-google", "oauth-state", 10)
    response = client.get(
        "/api/v1/auth/oauth/google/callback",
        params={"code": "authorization-code", "state": state},
        follow_redirects=False,
    )

    assert response.status_code == 307
    token = parse_qs(urlparse(response.headers["location"]).query)["token"][0]
    account = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert account.status_code == 200
    assert account.json()["email"] == "google-user@example.com"


def test_health_and_career_search(client):
    assert client.get("/api/health").json()["status"] == "ok"
    assert client.get("/api/v1/health/live").json()["status"] == "alive"
    ready = client.get("/api/v1/health/ready")
    assert ready.json() == {"status":"ready","database":"ok"}
    assert ready.headers["x-request-id"]
    response = client.get("/api/careers?q=software")
    assert response.status_code == 200
    assert any("Software" in career["title"] for career in response.json())

def test_login_rate_limit_is_persistent_and_returns_retry_after(client):
    payload = {"email":"limited@example.com","password":"WrongPassword123!"}
    for _ in range(6):
        assert client.post("/api/v1/auth/login", json=payload).status_code == 401
    limited = client.post("/api/v1/auth/login", json=payload)
    assert limited.status_code == 429
    assert int(limited.headers["retry-after"]) > 0


def test_registration_duplicate_and_login(client):
    register(client)
    duplicate = client.post("/api/auth/register", json={"name": "Another Student", "email": "STUDENT@example.com", "password": "StrongPass123!"})
    assert duplicate.status_code == 409
    login = client.post("/api/auth/login", json={"email": "student@example.com", "password": "StrongPass123!"})
    assert login.status_code == 200
    assert login.json()["user"]["email"] == "student@example.com"
    assert client.get("/api/auth/me", headers={"Authorization": f"Bearer {login.json()['access_token']}"}).status_code == 200


def test_assessment_and_roadmap_are_account_scoped(client):
    first = register(client, "first@example.com")
    second = register(client, "second@example.com")
    first_headers = {"Authorization": f"Bearer {first['access_token']}"}
    second_headers = {"Authorization": f"Bearer {second['access_token']}"}
    assessment = client.post("/api/assessments", headers=first_headers, json={"answers": [0, 0, 1, 2, 0]})
    assert assessment.status_code == 201
    assert client.get("/api/assessments", headers=first_headers).json()[0]["result_title"] == "Analytical problem-solver"
    assert client.get("/api/assessments", headers=second_headers).json() == []
    task = client.post("/api/roadmap/tasks", headers=first_headers, json={"title": "Practise Python"})
    assert task.status_code == 201
    task_id = task.json()["id"]
    assert client.patch(f"/api/roadmap/tasks/{task_id}", headers=second_headers, json={"completed": True}).status_code == 404
    assert client.patch(f"/api/roadmap/tasks/{task_id}", headers=first_headers, json={"completed": True}).json()["completed"] is True


def test_college_endpoint_does_not_fabricate_results(client):
    response = client.post("/api/colleges/search", json={"exam": "KCET", "rank": "12000", "region": "Karnataka", "year": 2026})
    assert response.status_code == 200
    assert response.json()["status"] == "dataset_required"


def test_jee_seed_guidance_and_neet_demo_are_explicit_and_rank_limited(client):
    jee = client.post(
        "/api/v1/colleges/search",
        json={"exam":"JEE Main","rank":"12000","region":"All India","year":2025},
    )
    assert jee.status_code == 200
    assert jee.json()["status"] == "dataset_required"
    assert "kaggle" in jee.json()["message"].lower()

    first_rank = client.post(
        "/api/v1/colleges/search",
        json={"exam":"NEET UG","rank":"1","region":"All India","year":2026,"category":"General","course":"MBBS","quota":"AIQ"},
    )
    assert first_rank.json()["status"] == "demo_matches"
    assert all(1 <= match["demo_rank_reference"] <= 10_000 for match in first_rank.json()["matches"])
    assert all(match["historical_closing_rank"] is None for match in first_rank.json()["matches"])

    neet = client.post(
        "/api/v1/colleges/search",
        json={"exam":"NEET UG","rank":"10000","region":"All India","year":2026,"category":"SC","course":"BDS","quota":"AIQ"},
    )
    assert neet.status_code == 200
    result = neet.json()
    assert result["status"] == "demo_matches"
    assert "synthetic" in result["message"].lower()
    assert "not mcc" in result["message"].lower()
    assert result["matches"]
    assert all(match["is_demo"] is True for match in result["matches"])
    assert all(match["source_url"] == "" for match in result["matches"])
    assert all(match["category"] == "SC" and match["course"] == "BDS" for match in result["matches"])
    assert all(1 <= match["demo_rank_reference"] <= 10_000 for match in result["matches"])
    assert all(match["historical_closing_rank"] is None for match in result["matches"])

    for category in ("General", "OBC", "EWS", "SC", "ST"):
        categorized = client.post(
            "/api/v1/colleges/search",
            json={"exam":"NEET UG","rank":"5000","region":"All India","year":2026,"category":category},
        )
        assert categorized.json()["status"] == "demo_matches"
        assert {match["category"] for match in categorized.json()["matches"]} == {category}

    outside_demo_range = client.post(
        "/api/v1/colleges/search",
        json={"exam":"NEET UG","rank":"10001","region":"All India","year":2026},
    )
    assert outside_demo_range.json()["status"] == "demo_range_exceeded"
    assert outside_demo_range.json()["matches"] == []


def test_jee_search_filters_bundled_quota_and_round_values(client):
    session_generator = app.dependency_overrides[get_db]()
    db = next(session_generator)
    try:
        db.add(
            CollegeCutoff(
                exam="JEE Main",
                year=2025,
                college_name="National Institute of Technology Test",
                course="Civil Engineering",
                state="All India",
                category="OPEN",
                quota="AI / Gender-Neutral",
                round="6",
                closing_rank=12500,
                source_url="https://www.kaggle.com/datasets/gopikrishnan2005/josaa-opening-and-closing-ranks-dataset-20162026",
                source_checked_on="2026-11-19",
            )
        )
        db.commit()
    finally:
        session_generator.close()

    response = client.post(
        "/api/v1/colleges/search",
        json={
            "exam":"JEE Main",
            "rank":"10000",
            "region":"All India",
            "year":2025,
            "category":"OPEN",
            "quota":"AI",
            "round":"Round 6",
            "course":"Civil Engineering",
        },
    )
    assert response.status_code == 200
    result = response.json()
    assert result["status"] == "historical_matches"
    assert len(result["matches"]) == 1
    assert result["matches"][0]["quota"] == "AI / Gender-Neutral"

def test_versioned_riasec_assessment_returns_explainable_scores(client):
    account = register(client, "riasec@example.com")
    headers = {"Authorization": f"Bearer {account['access_token']}"}
    answers = [0] * 24
    answers[0] = 3  # Question 1 belongs to the Realistic dimension in riasec-24-v1.
    response = client.post("/api/v1/assessments", headers=headers, json={"answers": answers, "version": "riasec-24-v1"})
    assert response.status_code == 201, response.text
    result = response.json()
    assert result["version"] == "riasec-24-v1"
    assert set(result["scores"]) == {"Realistic", "Investigative", "Artistic", "Social", "Enterprising", "Conventional"}
    assert all(0 <= score <= 12 for score in result["scores"].values())
    assert result["scores"]["Realistic"] == 3
    assert result["scores"]["Investigative"] == 0


def test_versioned_resume_and_bookmarks_are_account_scoped(client):
    first = register(client, "resume-first@example.com")
    second = register(client, "resume-second@example.com")
    h1 = {"Authorization": f"Bearer {first['access_token']}"}
    h2 = {"Authorization": f"Bearer {second['access_token']}"}
    created = client.post("/api/v1/resumes", headers=h1, json={"title":"Graduate resume","content":{"full_name":"Example Student","skills":"Python, SQL"}})
    assert created.status_code == 201, created.text
    assert client.get("/api/v1/resumes", headers=h1).json()[0]["title"] == "Graduate resume"
    assert client.get("/api/v1/resumes", headers=h2).json() == []
    saved = client.post("/api/v1/bookmarks", headers=h1, json={"item_type":"career","item_id":"software-engineer"})
    assert saved.status_code == 201
    assert client.get("/api/v1/bookmarks", headers=h1).json()[0]["item_id"] == "software-engineer"
    assert client.get("/api/v1/bookmarks", headers=h2).json() == []


def test_resume_parser_extracts_text_without_persisting_upload(client):
    from io import BytesIO
    from pypdf import PdfWriter
    from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject

    writer = PdfWriter()
    page = writer.add_blank_page(width=400, height=400)
    font = DictionaryObject({
        NameObject("/Type"): NameObject("/Font"),
        NameObject("/Subtype"): NameObject("/Type1"),
        NameObject("/BaseFont"): NameObject("/Helvetica"),
    })
    font_ref = writer._add_object(font)
    page[NameObject("/Resources")] = DictionaryObject({
        NameObject("/Font"): DictionaryObject({NameObject("/F1"): font_ref})
    })
    stream = DecodedStreamObject()
    stream.set_data(b"BT /F1 12 Tf 50 350 Td (Asha Example aasha@example.com) Tj ET")
    page[NameObject("/Contents")] = writer._add_object(stream)
    pdf = BytesIO()
    writer.write(pdf)

    account = register(client, "resume-parser@example.com")
    headers = {"Authorization": f"Bearer {account['access_token']}"}
    response = client.post(
        "/api/v1/resumes/parse",
        headers=headers,
        files={"file": ("resume.pdf", pdf.getvalue(), "application/pdf")},
    )
    assert response.status_code == 200, response.text
    result = response.json()
    assert "Asha Example" in result["extracted_text"]
    assert result["fields"]["email"] == "aasha@example.com"
    assert result["storage"] == "not_saved"
    assert result["pages_processed"] == 1
    unsupported = client.post(
        "/api/v1/resumes/parse",
        headers=headers,
        files={"file": ("resume.txt", b"plain text", "text/plain")},
    )
    assert unsupported.status_code == 415
    malformed = client.post(
        "/api/v1/resumes/parse",
        headers=headers,
        files={"file": ("resume.pdf", b"%PDF-1.4 invalid", "application/pdf")},
    )
    assert malformed.status_code == 422


def test_scanned_resume_ocr_requires_consent_and_uses_gemini_only_when_needed(client, monkeypatch):
    import json
    from io import BytesIO
    from pypdf import PdfWriter
    from app import main as main_module

    writer = PdfWriter()
    writer.add_blank_page(width=400, height=400)
    pdf = BytesIO()
    writer.write(pdf)
    account = register(client, "resume-ocr@example.com")
    headers = {"Authorization": f"Bearer {account['access_token']}"}

    consent_missing = client.post(
        "/api/v1/resumes/parse-scanned",
        headers=headers,
        files={"file":("scan.pdf",pdf.getvalue(),"application/pdf")},
        data={"consent_to_external_processing":"false"},
    )
    assert consent_missing.status_code == 400

    monkeypatch.setenv("GEMINI_API_KEY", "")
    unconfigured = client.post(
        "/api/v1/resumes/parse-scanned",
        headers=headers,
        files={"file":("scan.pdf",pdf.getvalue(),"application/pdf")},
        data={"consent_to_external_processing":"true"},
    )
    assert unconfigured.status_code == 503

    class FakeResponse:
        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return False

        def read(self):
            result = {"candidates":[{"content":{"parts":[{"text":json.dumps({"extracted_text":"Asha Example\naasha@example.com\nSkills\nPython"})}]}}]}
            return json.dumps(result).encode()

    def fake_urlopen(request, timeout):
        body = json.loads(request.data)
        assert body["contents"][0]["parts"][1]["inlineData"]["mimeType"] == "application/pdf"
        assert body["generationConfig"]["responseMimeType"] == "application/json"
        assert timeout == 30
        return FakeResponse()

    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    monkeypatch.setattr(main_module.urllib.request, "urlopen", fake_urlopen)
    parsed = client.post(
        "/api/v1/resumes/parse-scanned",
        headers=headers,
        files={"file":("scan.pdf",pdf.getvalue(),"application/pdf")},
        data={"consent_to_external_processing":"true"},
    )
    assert parsed.status_code == 200, parsed.text
    assert parsed.json()["ocr_provider"] == "gemini_ocr"
    assert parsed.json()["fields"]["email"] == "aasha@example.com"
    assert parsed.json()["storage"] == "not_saved"


def test_resume_analysis_compares_keywords_without_claiming_ats_score(client):
    response = client.post("/api/v1/resumes/analyze", json={
        "content": {"skills":"Python, FastAPI"},
        "job_description":"Python FastAPI SQL REST API communication",
    })
    assert response.status_code == 200, response.text
    result = response.json()
    assert {"python", "fastapi"}.issubset(set(result["keyword_match"]["matched_keywords"]))
    assert "sql" in result["keyword_match"]["missing_keywords"]
    assert "not an employer ATS score" in result["keyword_match"]["note"]


def test_resume_pdf_export_is_authenticated_bounded_and_not_persisted(client):
    from io import BytesIO
    from pypdf import PdfReader

    payload = {"title":"Graduate Resume","content":{
        "full_name":"Asha Example",
        "headline":"Junior Data Analyst",
        "email":"asha@example.com",
        "skills":"Python, SQL, spreadsheets",
        "projects":"Built a survey dashboard",
    }}
    assert client.post("/api/v1/resumes/export-pdf", json=payload).status_code == 401
    account = register(client, "resume-pdf@example.com")
    headers = {"Authorization":f"Bearer {account['access_token']}"}
    response = client.post("/api/v1/resumes/export-pdf", headers=headers, json=payload)
    assert response.status_code == 200, response.text
    assert response.headers["content-type"] == "application/pdf"
    assert response.headers["cache-control"] == "no-store"
    extracted = "\n".join(page.extract_text() or "" for page in PdfReader(BytesIO(response.content)).pages)
    assert "Asha Example" in extracted
    assert "Junior Data Analyst" in extracted

    unsupported_script = client.post(
        "/api/v1/resumes/export-pdf",
        headers=headers,
        json={"title":"Kannada","content":{"full_name":"ಅಫ್ರಿದ್"}},
    )
    assert unsupported_script.status_code == 422


def test_assistant_and_skill_gap_are_transparent(client, monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "")
    account = register(client, "guide@example.com")
    headers = {"Authorization": f"Bearer {account['access_token']}"}
    response = client.post("/api/v1/assistant/chat", headers=headers, json={"question":"What skills should I explore for software engineering?"})
    assert response.status_code == 200
    assert response.json()["provider"] in {"local-guidance", "gemini-configured"}
    assert any(source["source_id"] == "software-engineer" for source in response.json()["sources"])
    assert "guarantee" in response.json()["disclaimer"].lower() or "verify" in response.json()["disclaimer"].lower()
    gap = client.post("/api/v1/skills/gap", json={"career_id":"software-engineer","current_skills":["Python"]})
    assert gap.status_code == 200
    assert "Python" in gap.json()["matched_skills"]
    assert gap.json()["skills_to_explore"]


def test_assistant_supports_general_questions_and_careercompass_context(client, monkeypatch):
    import json
    from app import main as main_module

    captured = {}

    class FakeResponse:
        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return False

        def read(self):
            return json.dumps({"candidates":[{"content":{"parts":[{"text":"CareerCompass supports career exploration and general questions."}]}}]}).encode()

    def fake_urlopen(request, timeout):
        captured["payload"] = json.loads(request.data)
        return FakeResponse()

    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    monkeypatch.setenv("HIMALAYAS_API_KEY", "")
    monkeypatch.setattr(main_module.urllib.request, "urlopen", fake_urlopen)
    account = register(client, "affu-context@example.com")
    headers = {"Authorization": f"Bearer {account['access_token']}"}
    question = "What does CareerCompass AI do, and can it answer questions beyond careers?"
    response = client.post("/api/v1/assistant/chat", headers=headers, json={"question":question})

    assert response.status_code == 200
    assert response.json()["provider"] == "gemini-configured"
    assert response.json()["answer"] == "CareerCompass supports career exploration and general questions."
    assert any(source["source_id"] == "product-overview" for source in response.json()["sources"])
    history = client.get("/api/v1/assistant/history", headers=headers)
    assert history.status_code == 200
    assert history.json()[0]["provider"] == "gemini-configured"
    payload = captured["payload"]
    instructions = payload["systemInstruction"]["parts"][0]["text"].casefold()
    user_content = payload["contents"][0]["parts"][0]["text"]
    assert "do not refuse just because a topic is not in the catalogue" in instructions
    assert "RETRIEVED SOURCES:" in user_content
    assert "[product-overview]" in user_content
    assert "24-item" in user_content
    assert "Remotive" in user_content
    assert question in user_content


def test_admin_template_and_report_summary_are_available(client, monkeypatch):
    monkeypatch.setenv("ADMIN_EMAILS", "template-admin@example.com")
    admin = register(client, "template-admin@example.com")
    headers = {"Authorization": f"Bearer {admin['access_token']}"}

    template = client.get("/api/v1/admin/college-import-template", headers=headers)
    assert template.status_code == 200, template.text
    payload = template.json()
    assert payload["filename"] == "college_cutoffs_template.csv"
    assert "source_url" in payload["columns"]
    assert "KCET" in payload["example_csv"]
    assert payload["source_coverage"]["manual_verification_required"] is True

    providers = client.get("/api/v1/admin/external-providers", headers=headers)
    assert providers.status_code == 200, providers.text
    assert any(item["name"] == "KEA" for item in providers.json()["official_college_cutoff_providers"])
    assert any(item["name"] == "OpenStreetMap + Leaflet" for item in providers.json()["map_providers"])

    summary = client.post("/api/v1/reports/summary", headers=headers)
    assert summary.status_code == 200, summary.text
    assert summary.json()["student"]["email"] == "template-admin@example.com"
    assert "disclaimer" in summary.json()


def test_jobs_use_remotive_fallback_and_admin_routes_are_protected(client, monkeypatch):
    import json
    from app import main as main_module

    monkeypatch.setenv("HIMALAYAS_API_KEY", "")
    monkeypatch.setattr(main_module, "_HIMALAYAS_CACHE", {})
    monkeypatch.setattr(main_module, "_REMOTIVE_CACHE", {"date": None, "fetched_at": None, "items": [], "requests_today": 0})
    captured = {"calls": 0, "remotive_calls": 0, "remotive_url": ""}

    class FakeResponse:
        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return False

        def read(self):
            return json.dumps({"jobs":[
                {
                    "id": 101,
                    "title": "Remote Python Developer",
                    "company_name": "Example Studio",
                    "candidate_required_location": "Worldwide",
                    "job_type": "full_time",
                    "category": "Software Development",
                    "tags": ["Python", "API"],
                    "url": "https://remotive.com/remote-jobs/software-dev/remote-python-developer-101",
                    "publication_date": "2026-11-15T10:00:00",
                },
                {
                    "id": 102,
                    "title": "Product Designer",
                    "company_name": "Design Example",
                    "candidate_required_location": "Europe",
                    "job_type": "contract",
                    "category": "Design",
                    "tags": ["Figma", "Research"],
                    "url": "https://remotive.com/remote-jobs/design/product-designer-102",
                    "publication_date": "2026-11-14T10:00:00",
                },
                {
                    "id": 103,
                    "title": "Python Developer Intern",
                    "company_name": "Example Studio",
                    "candidate_required_location": "Worldwide",
                    "job_type": "internship",
                    "category": "Software Development",
                    "tags": ["Python", "API"],
                    "url": "https://remotive.com/remote-jobs/software-dev/python-developer-intern-103",
                    "publication_date": "2026-11-13T10:00:00",
                },
            ]}).encode()

    def fake_urlopen(request, timeout):
        captured["calls"] += 1
        if request.full_url.startswith("https://himalayas.app/jobs/api/search?"):
            raise main_module.urllib.error.HTTPError(request.full_url, 429, "quota", {}, None)
        captured["remotive_calls"] += 1
        captured["remotive_url"] = request.full_url
        return FakeResponse()

    monkeypatch.setattr(main_module.urllib.request, "urlopen", fake_urlopen)
    jobs = client.get("/api/v1/jobs?q=Python&skills=Python%2CAPI")
    assert jobs.status_code == 200
    result = jobs.json()
    assert result["status"] == "live"
    assert result["provider"] == "Remotive"
    assert result["items"][0]["title"] == "Remote Python Developer"
    assert len(result["items"]) == 1
    assert result["items"][0]["source"] == "Remotive"
    assert result["items"][0]["is_demo"] is False
    assert result["items"][0]["match_score"] == 100
    assert result["items"][0]["matched_skills"] == ["Python", "API"]
    assert "Himalayas is temporarily unavailable" in result["message"]
    assert "Remotive" in result["message"]

    cached = client.get("/api/v1/jobs?q=Designer&category=Design&skills=Python%2CAPI")
    assert cached.status_code == 200
    assert [item["title"] for item in cached.json()["items"]] == ["Product Designer"]
    assert captured["calls"] == 3
    assert captured["remotive_calls"] == 1
    assert "limit=100" in captured["remotive_url"]

    account = register(client, "not-admin@example.com")
    headers = {"Authorization": f"Bearer {account['access_token']}"}
    response = client.post("/api/v1/admin/validate-college-csv", headers=headers, json={"csv_text":"a,b\n1,2"})
    assert response.status_code == 403


def test_jobs_surface_remotive_provider_failure(client, monkeypatch):
    from app import main as main_module

    monkeypatch.setenv("HIMALAYAS_API_KEY", "")
    monkeypatch.setattr(main_module, "_HIMALAYAS_CACHE", {})
    monkeypatch.setattr(main_module, "_REMOTIVE_CACHE", {"date": None, "fetched_at": None, "items": [], "requests_today": 0})

    def offline_urlopen(_request, timeout):
        raise main_module.urllib.error.URLError("offline")

    monkeypatch.setattr(main_module.urllib.request, "urlopen", offline_urlopen)
    response = client.get("/api/v1/jobs")
    assert response.status_code == 502
    assert "could not be reached" in response.json()["detail"].lower()


def test_jobs_use_himalayas_remote_api_with_optional_key(client, monkeypatch):
    import json
    from urllib.parse import parse_qs, urlparse
    from app import main as main_module

    captured = {"calls": 0, "authorization": None}

    class FakeResponse:
        def __init__(self, payload):
            self.payload = payload

        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return False

        def read(self):
            return json.dumps(self.payload).encode()

    def fake_urlopen(request, timeout):
        captured["calls"] += 1
        captured["url"] = request.full_url
        captured["authorization"] = request.get_header("Authorization")
        return FakeResponse({"totalCount": 3, "jobs":[
            {
                "guid":"/companies/example/jobs/junior-java-developer",
                "title":"Junior Java Developer",
                "companyName":"Example Company",
                "locationRestrictions":["India"],
                "employmentType":"Full Time",
                "categories":["Engineering"],
                "excerpt":"Build Java services.",
                "applicationLink":"https://himalayas.app/companies/example/jobs/junior-java-developer?source=api",
                "pubDate":1795000000,
                "expiryDate":4102444800,
            },
            {
                "guid":"/companies/example/jobs/software-engineering-intern",
                "title":"Software Engineering Intern",
                "companyName":"Example Company",
                "locationRestrictions":["India"],
                "employmentType":"Intern",
                "applicationLink":"https://himalayas.app/companies/example/jobs/software-engineering-intern",
                "expiryDate":4102444800,
            },
            {
                "guid":"/companies/example/jobs/expired-java-role",
                "title":"Expired Java Developer",
                "companyName":"Example Company",
                "locationRestrictions":["India"],
                "employmentType":"Full Time",
                "applicationLink":"https://himalayas.app/companies/example/jobs/expired-java-role",
                "expiryDate":1,
            },
            {
                "guid":"/companies/example/jobs/frontend-developer-internships",
                "title":"Frontend Developer Internships",
                "companyName":"Example Company",
                "locationRestrictions":["India"],
                "employmentType":"Full Time",
                "applicationLink":"https://himalayas.app/companies/example/jobs/frontend-developer-internships",
                "expiryDate":4102444800,
            },
        ]})

    monkeypatch.setenv("HIMALAYAS_API_KEY", "test-himalayas-key")
    monkeypatch.setattr(main_module, "_HIMALAYAS_CACHE", {})
    monkeypatch.setattr(main_module.urllib.request, "urlopen", fake_urlopen)
    response = client.get("/api/v1/jobs?q=Java%20developer&skills=Java")

    assert response.status_code == 200
    result = response.json()
    assert result["status"] == "live"
    assert result["provider"] == "Himalayas"
    assert len(result["items"]) == 1
    assert result["items"][0]["source"] == "Himalayas"
    assert result["items"][0]["is_demo"] is False
    assert result["items"][0]["location"] == "India"
    assert result["items"][0]["match_score"] == 100
    assert result["items"][0]["matched_skills"] == ["Java"]
    assert result["items"][0]["source_url"] == "https://himalayas.app/jobs"
    assert result["items"][0]["url"] == "https://himalayas.app/companies/example/jobs/junior-java-developer?source=api"
    assert captured["url"].startswith("https://himalayas.app/jobs/api/search?")
    query = parse_qs(urlparse(captured["url"]).query)
    assert query["q"] == ["Java developer"]
    assert query["country"] == ["IN"]
    assert query["sort"] == ["recent"]
    assert "Intern" not in query["employment_type"][0]
    assert captured["authorization"] == "Bearer test-himalayas-key"

    cached = client.get("/api/v1/jobs?q=Java%20developer&skills=Developer")
    assert cached.status_code == 200
    assert captured["calls"] == 1


def test_himalayas_public_api_works_without_a_key(client, monkeypatch):
    import json
    from app import main as main_module

    class FakeResponse:
        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return False

        def read(self):
            return json.dumps({"jobs":[]}).encode()

    captured = {}

    def fake_urlopen(request, timeout):
        captured["authorization"] = request.get_header("Authorization")
        return FakeResponse()

    monkeypatch.setenv("HIMALAYAS_API_KEY", "")
    monkeypatch.setattr(main_module, "_HIMALAYAS_CACHE", {})
    monkeypatch.setattr(main_module.urllib.request, "urlopen", fake_urlopen)
    response = client.get("/api/v1/jobs")

    assert response.status_code == 200
    assert response.json()["provider"] == "Himalayas"
    assert captured["authorization"] is None


def test_himalayas_quota_uses_remotive_fallback(client, monkeypatch):
    import json
    from app import main as main_module

    monkeypatch.setenv("HIMALAYAS_API_KEY", "")
    monkeypatch.setattr(main_module, "_HIMALAYAS_CACHE", {})
    monkeypatch.setattr(main_module, "_REMOTIVE_CACHE", {"date": None, "fetched_at": None, "items": [], "requests_today": 0})

    class FakeResponse:
        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return False

        def read(self):
            return json.dumps({"jobs":[]}).encode()

    def quota_urlopen(request, timeout):
        if request.full_url.startswith("https://himalayas.app/jobs/api/search?"):
            raise main_module.urllib.error.HTTPError(request.full_url, 429, "quota", {}, None)
        return FakeResponse()

    monkeypatch.setattr(main_module.urllib.request, "urlopen", quota_urlopen)
    response = client.get("/api/v1/jobs?q=Developer")
    assert response.status_code == 200
    assert response.json()["provider"] == "Remotive"
    assert "temporarily unavailable" in response.json()["message"].lower()


def test_account_deletion_removes_owned_records(client):
    account = register(client, "delete-me@example.com")
    headers = {"Authorization": f"Bearer {account['access_token']}"}
    assert client.post("/api/v1/resumes", headers=headers, json={"title":"Temporary","content":{"skills":"Python"}}).status_code == 201
    response = client.delete("/api/v1/account", headers=headers)
    assert response.status_code == 204
    assert client.get("/api/v1/auth/me", headers=headers).status_code == 401


def test_admin_import_rejects_bad_data_without_importing(client, monkeypatch):
    monkeypatch.setenv("ADMIN_EMAILS", "admin@example.com")
    account = register(client, "admin@example.com")
    headers = {"Authorization": f"Bearer {account['access_token']}"}
    raw = "exam,year,college_name,course,state,category,quota,round,closing_rank,source_url,source_checked_on\nKCET,2026,Example College,CSE,Karnataka,GM,Government,1,not-a-rank,https://example.org/source,2026-10-24"
    response = client.post("/api/v1/admin/import-college-csv", headers=headers, json={"csv_text":raw})
    assert response.status_code == 200
    assert response.json()["imported"] is False
    assert response.json()["errors"]

def test_admin_import_and_historical_advisory_bands(client, monkeypatch, tmp_path):
    from app import main as main_module
    monkeypatch.setenv("ADMIN_EMAILS", "data-admin@example.com")
    monkeypatch.setattr(main_module, "COLLEGE_DATA_PATH", tmp_path / "college_cutoffs.csv")
    account = register(client, "data-admin@example.com")
    headers = {"Authorization": f"Bearer {account['access_token']}"}
    raw = "exam,year,college_name,course,state,category,quota,round,closing_rank,source_url,source_checked_on\n" \
          "KCET,2026,Alpha College,CSE,Karnataka,GM,Government,1,1000,https://example.org/alpha,2026-10-24\n" \
          "KCET,2026,Beta College,CSE,Karnataka,GM,Government,1,600,https://example.org/beta,2026-10-24\n" \
          "KCET,2026,Gamma College,CSE,Karnataka,GM,Government,1,400,https://example.org/gamma,2026-10-24\n"
    imported = client.post("/api/v1/admin/import-college-csv", headers=headers, json={"csv_text":raw})
    assert imported.status_code == 200 and imported.json()["imported"] is True
    found = client.post("/api/v1/colleges/search", json={"exam":"KCET","rank":"500","region":"Karnataka","year":2026})
    assert found.status_code == 200
    bands = {item["college_name"]:item["advisory_band"] for item in found.json()["matches"]}
    assert bands == {"Alpha College":"Safe", "Beta College":"Moderate", "Gamma College":"Dream"}

def test_recommendations_are_explainable_and_validate_scores(client):
    scores = {"Realistic":0,"Investigative":12,"Artistic":0,"Social":0,"Enterprising":0,"Conventional":0}
    response = client.post("/api/v1/recommendations", json={"scores":scores})
    assert response.status_code == 200
    body = response.json()
    assert body["version"] == "career-map-v1"
    assert "not a trained model" in body["method"]
    assert body["results"][0]["title"] in {"Software Engineer","Data Analyst","Cybersecurity Analyst","Mechanical Engineer","Sports Data Analyst"}
    invalid = client.post("/api/v1/recommendations", json={"scores":{"Investigative":999}})
    assert invalid.status_code == 422


def test_purpose_tokens_support_email_verification_and_password_reset():
    from app.security import create_purpose_token, purpose_token_subject

    verification = create_purpose_token("42", "email-verification", 60)
    reset = create_purpose_token("42", "password-reset", 30)
    assert purpose_token_subject(verification, "email-verification") == "42"
    assert purpose_token_subject(verification, "password-reset") is None
    assert purpose_token_subject(reset, "password-reset") == "42"


def test_password_reset_request_and_confirmation_are_bounded(client):
    register(client, "reset@example.com")
    requested = client.post("/api/v1/auth/password/reset/request", json={"email":"reset@example.com"})
    assert requested.status_code == 200
    invalid = client.post("/api/v1/auth/password/reset/confirm", json={"token":"a" * 20,"new_password":"NewStrongPass123!"})
    assert invalid.status_code == 400


def test_college_straight_line_distance_and_coordinate_validation(client):
    response = client.post("/api/v1/colleges/distance", json={
        "from_lat":12.9716,
        "from_lon":77.5946,
        "to_lat":12.2958,
        "to_lon":76.6394,
    })
    assert response.status_code == 200
    assert 100 < response.json()["distance_km"] < 150
    assert response.json()["not_road_distance"] is True
    assert "not a road route" in response.json()["disclaimer"].lower()

    invalid = client.post("/api/v1/colleges/distance", json={
        "from_lat":999,
        "from_lon":0,
        "to_lat":0,
        "to_lon":0,
    })
    assert invalid.status_code == 422


def test_business_idea_catalog_has_at_least_six_ideas_per_interest(client):
    assert len(main_module.BUSINESS_IDEA_FIELDS) >= 10
    for interest in main_module.BUSINESS_IDEA_FIELDS:
        response = client.get(f"/api/v1/business-ideas?interest={interest}")
        assert response.status_code == 200, response.text
        items = response.json()["items"]
        field_items = [item for item in items if item["interest"] == interest]
        assert len(field_items) >= 6, interest
        assert len({item["id"] for item in items}) == len(items)
