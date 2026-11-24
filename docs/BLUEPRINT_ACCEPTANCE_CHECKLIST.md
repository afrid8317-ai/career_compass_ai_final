# CareerCompass AI — Blueprint acceptance checklist

This checklist maps the master implementation prompt to the current package. “Implemented” means a working code path exists; it does not imply independent security, scientific, or production certification.

## Product and design

- [x] CareerCompass-specific responsive landing page with hero, pathway strip, comparison/benefits, feature showcase, workflow, student use cases, FAQ, CTA and footer patterns.
- [x] Responsive shared header/footer and reusable visual primitives in CSS.
- [ ] Pixel-identical FintechX reproduction. The project recreates observable design patterns but does not include editable Framer source assets or an independently verified pixel-by-pixel comparison.
- [x] Honest demo labels; no fabricated placement numbers, user counts, university partnerships, model accuracy or testimonials.
- [x] Source transparency, privacy and terms summary pages.

## Routes and user flows

- [x] `/`, `/features`, `/login`, `/register`, `/app`, `/assessment`, `/assessment/results`, `/careers`, `/careers/:id`, `/colleges`, `/roadmap`, `/assistant`, `/jobs`, `/resume`, `/progress`, `/settings`, `/admin` and supporting `/career-graph`, `/ideas`, `/sources`, `/privacy`, `/terms` paths.
- [x] Account registration/login, signed bearer tokens, user-scoped tasks, assessments, resumes, bookmarks, assistant history and profile preferences.
- [x] Assessment draft auto-save/resume in browser storage; account-backed results when signed in.
- [x] Account deletion endpoint and settings action deletes account-backed data.
- [x] Email verification, password reset and Google/GitHub OAuth application flows. SMTP and provider credentials are deployment configuration requirements.

## Assessment and career exploration

- [x] Versioned 24-item `riasec-24-v1` self-reflection, 0–3 answers, six reproducible scores, result visualization, history persistence and explicit limitation notices.
- [x] Legacy five-answer API compatibility for the earlier prototype.
- [x] Curated career catalogue, detail profiles, sports-career profiles and entrepreneurship starter profile.
- [x] Skill-gap comparison with self-reported current levels (0–5) and configurable target levels.
- [x] Prerequisite-ordered starter roadmap milestones with evidence to collect.
- [x] Accessible 2D career-to-skill relationship view.
- [ ] Psychometric validation and trained/evaluated ML prediction model. No labelled dataset or qualified validation study was supplied, so no accuracy claim is made.
- [ ] Fully operational English/Kannada/Hindi translation. Preferences can be saved, but all UI content is not translated yet.

## Colleges and data governance

- [x] KCET/JEE/NEET-style search form, year/exam/course/category/quota/round/location filters and historical rank comparisons.
- [x] Safe/Moderate/Dream advisory bands based on documented rank-to-closing-rank rules; not admission probabilities.
- [x] Admin-only CSV validation/import, HTTPS source URL and ISO date checks, audit records and import history.
- [x] College cutoff CSV template with required provenance columns.
- [x] Clearly marked synthetic NEET demo rank references for 1–10,000 across MBBS/BDS and common category labels; not official allotment data or admission predictions.
- [ ] Official verified dataset. Third-party KCET and JoSAA historical compilations are bundled under CC BY-SA 4.0, but neither has been independently reconciled against KEA/JoSAA. Official NEET allotment data are not bundled. Fees, placements, addresses, seat rules and admission history need sourced data before display.
- [x] User-triggered campus maps with OpenStreetMap/Leaflet, Nominatim geocoding, visible attribution, approximate-location caveat, per-tab request spacing and in-memory caching.
- [ ] Verified campus addresses and college comparisons. The map results are approximate geocoder matches; a verified institution-location dataset is not bundled.

## AI, jobs and resume

- [x] Affu assistant with local keyword retrieval over the starter career catalogue, internal source labels, abstention-style fallback, account history, optional backend-only Gemini integration, timeout handling and basic per-user rate limiting.
- [ ] Production-grade RAG/vector index and authoritative external source registry. The current retrieval layer is a small local catalogue, not a complete external knowledge base.
- [x] Editable resume sections, account save, checklist-style review, and browser print-to-PDF.
- [x] Authenticated text-based PDF extraction (5 MB / 20-page limits), editable extraction review, and optional resume-to-job-description keyword overlap; uploads are not persisted by the parser.
- [x] OCR for scanned PDFs and server-generated PDF templates. Checklist and keyword overlap remain heuristics, not an employer ATS score or hiring prediction.
- [x] Live remote-job search through the Remotive public API when the Himalayas API is temporarily unavailable or rate-limited, with source attribution, original links, six-hour caching, and a four-refresh-per-UTC-day process limit.
- [x] Himalayas remote jobs open to India. A key is optional; results are cached and use the required source attribution and application links. Anonymous live API verification returned HTTP 200 with the expected jobs response shape.
- [x] Field-specific role discovery with 39 role ideas and city-selected annual INR salary estimates, clearly marked illustrative rather than live.
- [ ] Live, source-verified salary data by role and city. Current ranges are illustrative planning estimates, not a city-level salary survey.
- [x] Business/project idea exploration filtered by interest, budget and time.

## Backend and operations

- [x] FastAPI modular routes, versioned `/api/v1` core aliases, Pydantic request validation, SQLAlchemy models, SQLite local mode, PostgreSQL support, environment examples, account-scoped access checks, security headers, and Alembic initial migration.
- [x] Password hashing with PBKDF2-HMAC-SHA256 and expiring signed HS256 tokens. Existing bcrypt hashes from the prior prototype are checked when bcrypt is available.
- [x] 35 backend regression tests pass in the current workspace.
- [x] `npm run build` completes TypeScript checking and the Vite production bundle in the current workspace.
- [x] Playwright browser E2E suite passes four smoke tests. Live-provider behavior still requires provider credentials and live service verification.
- [ ] Production security review, external rate-limiting, backup/restore rehearsal, monitoring, retention/legal review and live deployment smoke tests.

## External prerequisites before calling this production-ready

1. Run the real frontend build and browser tests on a network-enabled machine.
2. Configure a unique production secret, database, allowed frontend origins, HTTPS and backups.
3. Supply official, source-cited college data; verify the counselling rules and imported records.
4. Add provider credentials only for the external capabilities the project actually needs.
5. Complete localization, accessibility review, privacy/legal review, and security testing.
