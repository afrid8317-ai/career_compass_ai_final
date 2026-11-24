# CareerCompass AI — full-stack development package

CareerCompass AI is a student career exploration and planning application. It combines an educational landing page, a 24-item explainable RIASEC-style self-reflection, career profiles, historical college-cutoff comparison, personal roadmap tasks, a resume editor with text-PDF parsing and role-keyword comparison, Affu AI guidance, live job search, a career/skill relationship view, business-idea exploration across ten interest areas with at least six starter ideas per area, progress summaries, profile preferences, and an admin CSV import workflow.

**Important:** this is a substantial development build, not a certified production service. The assessment has not been psychometrically validated; career profiles are starter content; no official cutoff dataset ships with the package; live remote-job search open to India uses the Himalayas API, which works without a key; external OAuth, email verification/password reset, and live maps are not configured. English, Kannada, and Hindi can be selected, and broad interface translation is provided; some dynamic or specialized content may remain in English. The FintechX-inspired visual direction has been recreated from observable patterns; it is not a pixel-perfect export of the original Framer source.

## Stack

- Frontend: React, TypeScript, Vite, Lucide icons, responsive CSS.
- Backend: Python, FastAPI, Pydantic, SQLAlchemy.
- Local database: SQLite by default. PostgreSQL is supported.
- Authentication: PBKDF2-HMAC-SHA256 password hashes and signed, expiring HS256 bearer tokens.
- AI: general Q&A and CareerCompass product guidance through server-side Gemini (`GEMINI_API_KEY`), augmented with source-labelled retrieval over a maintained product guide and starter career catalogue; local retrieval fallback when Gemini is unavailable.
- Jobs: Himalayas remote jobs filtered for India eligibility; a server-side `HIMALAYAS_API_KEY` is optional and raises rate limits. Internship listings are excluded. Remotive is used as a fallback if Himalayas is temporarily unavailable or rate-limited.
- Resume tools: authenticated, in-memory text-PDF extraction (maximum 5 MB / 20 pages), optional scanned-PDF OCR through Gemini after explicit consent, heuristic resume review, and authenticated server PDF export for Latin-script content. Uploaded PDFs are not stored by the parser.
- Tests: pytest + FastAPI TestClient.
- Migrations: Alembic schema migrations, including persistent request-rate buckets.

## Design imagery

The interface uses locally stored, resized illustrative stock photos in `public/images/` from [Pexels](https://www.pexels.com/). They are decorative examples, not endorsements or images of specific recommended colleges. Pexels attribution is not required under its [license](https://www.pexels.com/license/).

## Start on Windows

You need Node.js 20+ and Python 3.11+.

1. Extract the ZIP and open the `careercompass-ai-fullstack` folder in VS Code.
2. Double-click `run-frontend.bat`.
3. Double-click `run-backend.bat` in a second window.
4. Open the Vite URL printed by the frontend terminal, normally `http://localhost:5173`.
5. API docs are at `http://127.0.0.1:8000/docs` and health is at `http://127.0.0.1:8000/api/v1/health`.

The launch scripts install dependencies on first run, so an internet connection is needed on your computer. For manual commands, see below.

### Frontend manually

```bash
npm install
npm run dev
```

Production bundle and TypeScript checks:

```bash
npm run build
npm run typecheck
```

### Backend manually

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
python scripts/import_kaggle_kcet.py
python scripts/import_kaggle_josaa.py
python -m uvicorn app.main:app --reload
```

On macOS/Linux, use `python3 -m venv .venv`, `source .venv/bin/activate`, and `cp .env.example .env`.

The local default is SQLite and development startup creates missing tables automatically. The seed importers add their bundled source records once without replacing records from other sources. For a production deployment, set `ENVIRONMENT=production` and run migrations before starting the server:

```bash
cd backend
alembic -c alembic.ini upgrade head
```

The API exposes `/api/v1/health/live` for process liveness and `/api/v1/health/ready` for a database readiness check. Each response includes an `X-Request-ID`; backend request logs omit query strings and request bodies. Registration, login, assistant, resume parsing, and resume analysis limits are stored in the application database, so they are shared across API workers and expire automatically.

### Database backups and restore

Run these commands from `backend/`:

```powershell
.\.venv\Scripts\python.exe scripts\database_maintenance.py backup --directory ..\backups --retention-days 30
.\.venv\Scripts\python.exe scripts\database_maintenance.py restore ..\backups\careercompass-YYYYMMDDTHHMMSSZ.sqlite3 --confirm-overwrite
```

The SQLite backup uses the online backup API and runs an integrity check. PostgreSQL backup/restore uses `pg_dump` and `pg_restore`, which must be installed and available on `PATH`. Restore overwrites the active database and requires explicit confirmation. Schedule backups in the hosting environment, protect them with encrypted storage and access controls, and periodically rehearse restore into a separate test database. Account deletion from the live database does not erase retained backup copies; set and disclose an appropriate backup-retention period.

### Deploying with Render and Vercel

The included [render.yaml](./render.yaml) creates the FastAPI service and PostgreSQL database. Connect the repository to Render and deploy the blueprint, then set the backend environment values in Render:

- `FRONTEND_ORIGINS`: the exact Vercel site origin, such as `https://your-project.vercel.app`.
- `GEMINI_API_KEY`: optional Gemini key, stored only on the backend.
- `HIMALAYAS_API_KEY`: optional free key for higher Himalayas API limits; the public endpoint works without a key.
- `ADMIN_EMAILS`: comma-separated admin accounts, if needed.

On Vercel, import the same repository as a Vite frontend, use the root directory, `npm run build`, and `dist` as the output directory. Set `VITE_API_BASE_URL` to the deployed Render API origin (for example `https://your-api.onrender.com`) and redeploy. This frontend URL is configuration, not a secret. Do not put backend API keys in Vercel `VITE_` variables.

You need your own Render and Vercel accounts to deploy. A free Himalayas developer key is optional; do not commit it.

## PostgreSQL

Run the included database service:

```bash
docker compose up -d db
```

Set `DATABASE_URL` in `backend/.env` to a URL similar to:

```env
DATABASE_URL=postgresql+psycopg://careercompass:change_me_locally@localhost:5432/careercompass
SECRET_KEY=replace-with-a-long-random-secret
ENVIRONMENT=development
FRONTEND_ORIGINS=http://localhost:5173
ACCESS_TOKEN_EXPIRE_MINUTES=60
GEMINI_API_KEY=
ADMIN_EMAILS=
```

Never use the example password or a placeholder secret for a public deployment. Set `FRONTEND_ORIGINS` to a comma-separated allowlist of the exact frontend origins. A production configuration with the default secret is rejected.

## Administrator access and college data

To provision an administrator account, set `ADMIN_EMAILS=your-address@example.com` in `backend/.env` **before registering that email**. If an account already exists, sign in again after adding its email to the allowlist; login reconciles the stored role against the configured list.

The template is `backend/data/college_cutoffs_template.csv`. An administrator can paste CSV rows into `/admin`, validate them, and import only after structural checks pass. Each successful import replaces the active cutoff dataset in the database, so upload a complete consolidated dataset rather than a partial slice. Required columns:

`exam, year, college_name, course, state, category, quota, round, closing_rank, source_url, source_checked_on`

Source URLs must be HTTPS and dates must use ISO format (`YYYY-MM-DD`). Imported records are compared against the entered rank and grouped by explicit advisory rules: **Safe** when entered rank is at most 70% of historical closing rank; **Moderate** when it is at or below the historical closing rank; **Dream** when it is above that closing rank. These labels are not admission probabilities or guarantees. CSV validation does not independently prove source truth, currentness, or completeness. Confirm all current rules with official counselling authorities.

The local package includes KCET engineering historical records for 2023–2025 from the Kaggle dataset [KCET College Admission & Cutoff Trends](https://www.kaggle.com/datasets/sowmithns/kcet-college-admission-and-cutoff-trends-2023-2024), credited to Sowmith Shetty under **CC BY-SA 4.0**. The uploader says the records were compiled from KEA reports; CareerCompass has not independently reconciled the rows with KEA. The bundled records and any adaptations must retain attribution and the CC BY-SA 4.0 terms. They are historical third-party data, not official or current admission advice.

JEE Main and JEE Advanced engineering records for 2016–2026 are bundled from the Kaggle dataset [JoSAA Opening & Closing Ranks Dataset](https://www.kaggle.com/datasets/gopikrishnan2005/josaa-opening-and-closing-ranks-dataset-20162026) by Gopi Krishnan R under **CC BY-SA 4.0**. The author says the records were compiled from the official JoSAA archive; CareerCompass has not independently reconciled the rows. The importer maps IIT/IISc entries to JEE Advanced and other JoSAA institutes to JEE Main, keeps quota/category/round and gender distinctions, and imports 527,316 standard integer-rank rows. It excludes preparatory ranks marked `P`, missing/non-integer ranks, and one empty source row because the predictor compares only ordinary numeric ranks. Source and license notices are in `backend/data/josaa_dataset_notice.txt`.

`run-backend.bat` imports each bundled source once without replacing records from other sources. To run the importers manually from `backend/`, use `python scripts/import_kaggle_kcet.py` and `python scripts/import_kaggle_josaa.py`. Each importer is idempotent for its own source. For official counselling calendars, rules, and current information, consult the [KEA UGCET portal](https://cetonline.karnataka.gov.in/kea/ugcet2026) and [JoSAA archive](https://josaa.admissions.nic.in/applicant/seatmatrix/openingclosingrankarchieve.aspx).

Official NEET college-allotment data are still not bundled. The local search flow includes clearly marked synthetic rank references for ranks 1–10,000, MBBS/BDS, and General/OBC/EWS/SC/ST labels in an AIQ-style sample. These examples are not MCC allotment results, historical/year-specific cutoffs, or admission estimates; they are only to demonstrate the interface. The app does not scrape CollegeKampus or present its estimates as official. Verify real counselling information through [MCC](https://mcc.nic.in/ug-medical-counselling/).

## Optional Affu AI

Set `GEMINI_API_KEY` only in `backend/.env` or the backend deployment secret store. Do not create a `VITE_GEMINI_API_KEY` and never expose the key in the browser. With Gemini configured, Affu can answer general questions and explain CareerCompass features using the most relevant source-labelled entries from the maintained product guide and starter career catalogue. Without the key, Affu uses BM25 retrieval against that same local content and returns the selected sources. This is a small curated corpus, not an external vector database or a registry of authoritative live sources. Current facts still need careful verification.

### Account sign-in and local OAuth setup

Email/password registration and login work with the local backend. For Google sign-in, create a Google OAuth app and put its client ID and secret in `backend/.env` as `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. Set `PUBLIC_API_URL` to the backend origin and `PUBLIC_APP_URL` to the frontend origin, then restart the backend.

Register these exact local callback URLs with the providers:

- Google: `http://127.0.0.1:8000/api/v1/auth/oauth/google/callback`

Google may also require adding the signing-in account as a test user in the OAuth consent screen. Never put provider secrets in frontend variables or commit them. For production, use HTTPS callback URLs and exact configured frontend origins.

### Optional live jobs

The [Himalayas Remote Jobs API](https://himalayas.app/api) is free and works without a key. For higher limits, create an optional free key at [Himalayas developer signup](https://himalayas.app/signup/developer) and store it as `HIMALAYAS_API_KEY` in `backend/.env` or the backend deployment secret store. Current docs specify up to 60 requests per minute and 10,000 per UTC day for keyed accounts; cached responses do not count. The backend filters for remote jobs open to India, excludes internships, and caches searches for six hours. Remotive is the fallback if Himalayas is unavailable or rate-limited.

Himalayas' API terms require a visible Himalayas source link and use of its `applicationLink` unchanged for applications. The app links the source on every listing and uses the API-provided application link. Remove expired postings and do not republish these listings to other job boards or aggregators. The page also contains 39 field-based career-role ideas and broad illustrative annual INR salary ranges for Bengaluru, Chennai (Tamil Nadu), and Hyderabad; these are not live salary data or guarantees. Remotive refreshes are limited to four per UTC day per process; its listings may be delayed and must link to the original listing with provider attribution.

## Implemented pages and paths

- `/` — landing page.
- `/features` — feature directory.
- `/login`, `/register` — account modal.
- `/app` and `/roadmap` — student roadmap dashboard.
- `/assessment` — resumable 24-item RIASEC-style self-reflection.
- `/assessment/results` and `/progress` — assessment/progress summary.
- `/careers` and `/careers/:id` — career catalogue and detail profile.
- `/colleges` — historical cutoff search interface.
- `/career-graph` — accessible 2D career-to-skill relationship map and skill-gap comparison.
- `/ideas` — illustrative business/project idea exploration.
- `/assistant` — Affu AI assistant.
- `/jobs` — field-specific career-role ideas and illustrative salary bands, plus Himalayas remote jobs open to India or attributed Remotive remote listings as fallback; internship listings are excluded.
- `/resume` — editable resume, text-PDF parsing, optional consented scanned-PDF OCR, job-description keyword comparison, account save, checklist review, server PDF export for Latin-script content, and browser print-to-PDF fallback.
- `/settings` — profile preferences, theme toggle, account deletion.
- `/sources` — data provenance and integration status.
- `/privacy`, `/terms` — implementation-specific prototype policy summaries.
- `/admin` — protected CSV validation/import and import history.

## API overview

Versioned endpoints use `/api/v1`; legacy `/api` aliases remain for compatibility.

- `GET /api/v1/health`, `GET /api/v1/health/live`, `GET /api/v1/health/ready`
- `POST /api/v1/auth/register`, `POST /api/v1/auth/login`, `GET /api/v1/auth/me`, `DELETE /api/v1/account`
- `GET /api/v1/careers`, `GET /api/v1/careers/{career_id}`, `POST /api/v1/recommendations`, `GET /api/v1/career-graph`
- `POST /api/v1/assessments`, `GET /api/v1/assessments`, `GET /api/v1/progress`, `POST /api/v1/reports/summary`
- `GET/POST /api/v1/roadmap/tasks`, `PATCH/DELETE /api/v1/roadmap/tasks/{task_id}`
- `POST /api/v1/skills/gap`, `GET /api/v1/skills/roadmap/{career_id}`
- `POST /api/v1/colleges/search`
- `GET/POST/PUT/DELETE /api/v1/resumes` (resume detail endpoints include an ID), `POST /api/v1/resumes/parse`, `POST /api/v1/resumes/parse-scanned` (explicit Gemini consent), `POST /api/v1/resumes/analyze`, `POST /api/v1/resumes/export-pdf`
- `GET/POST/DELETE /api/v1/bookmarks`
- `GET/PUT /api/v1/profile`
- `POST /api/v1/assistant/chat`, `GET /api/v1/assistant/history`
- `GET /api/v1/jobs` (Himalayas remote job results open to India; cached Remotive fallback if unavailable)
- Admin: `POST /api/v1/admin/validate-college-csv`, `POST /api/v1/admin/import-college-csv`, `GET /api/v1/admin/import-history`

## Tests and verification

Run backend tests from `backend/`:

```bash
python -m pytest -q
```

The regression suite covers registration/login and rate limits, account isolation, versioned RIASEC scoring, resume persistence, PDF parsing and export, consented OCR, resume keyword comparison, bookmarks, source-labelled assistant retrieval, skill-gap comparison, Remotive and Himalayas job providers, admin access controls, backup/restore behavior, readiness checks, and account deletion.

The backend regression suite currently has 39 passing tests. `npm run build` and a Chromium Playwright smoke test have been verified in this workspace. Live third-party provider checks and public production deployment still require a real deployed environment.

## Before real public use

1. Run browser end-to-end tests and verify the production deployment, database readiness, and trusted-proxy configuration.
2. Review and threat-model auth/session handling and persistent rate limits; add email verification, password reset, and OAuth only after provider credentials are available.
3. Configure external monitoring/alerting and scheduled encrypted backups; define retention, privacy, and recovery procedures, then rehearse PostgreSQL restore.
4. Have qualified career-guidance professionals review the questionnaire; validate it with appropriate research before making psychometric claims.
5. Confirm data-reuse permissions, then import official, year-specific cutoff data and verify the import/source process with the relevant counselling authority.
6. Verify Himalayas API behavior and review its attribution/application-link terms; add an approved learning-resource registry and maps provider, and review residual English in dynamic or specialized content if broader localization is required.
7. Review privacy/terms pages with the responsible institution before public or institutional deployment.

## Project layout

```text
src/                         React app and API client
backend/app/                 FastAPI routes, models, security and settings
backend/tests/                API regression tests
backend/migrations/           Alembic migration environment and schema versions
backend/data/                 College cutoff CSV template (no fake cutoff rows)
render.yaml                   Example API + PostgreSQL deployment blueprint
vercel.json                   SPA route fallback for frontend hosting
```
