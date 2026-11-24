"""Small, source-labelled BM25 retrieval over the maintained product corpus."""
from collections import Counter
from math import log
import re


PRODUCT_DOCUMENTS = [
    {
        "title":"CareerCompass overview",
        "source_type":"CareerCompass maintained product guide",
        "source_id":"product-overview",
        "content":"CareerCompass AI helps students explore careers, reflect on interests, review historical college cutoff records when an administrator imports them, plan skills, prepare resumes, and explore jobs. It is an informational planning tool, not a decision-maker.",
    },
    {
        "title":"Assessment and recommendations",
        "source_type":"CareerCompass maintained product guide",
        "source_id":"assessment-limitations",
        "content":"The 24-item RIASEC-style reflection uses curated interest mappings. It has not been psychometrically validated and is not a diagnosis, a trained machine-learning prediction, or a guarantee of academic or employment outcomes.",
    },
    {
        "title":"College data availability",
        "source_type":"CareerCompass maintained product guide",
        "source_id":"college-data",
        "content":"College search compares historical closing ranks only when administrators import source-cited records. No verified cutoff dataset is bundled. Safe, Moderate, and Dream labels are rule-based comparisons, not admission probabilities or guarantees. Confirm current eligibility and counselling rules with official authorities.",
    },
    {
        "title":"Jobs and listing providers",
        "source_type":"CareerCompass maintained product guide",
        "source_id":"jobs-data",
        "content":"The jobs page searches remote jobs from Himalayas that are open to India and excludes internship listings. A Himalayas API key is optional and only raises the request limits. Every Himalayas result must link visibly to Himalayas and use the API's applicationLink unchanged; Remotive remote listings are used if the Himalayas API is unavailable.",
    },
    {
        "title":"Resume tools and privacy",
        "source_type":"CareerCompass maintained product guide",
        "source_id":"resume-tools",
        "content":"Resume content review and job-description keyword overlap are heuristics, not an employer ATS score or hiring prediction. Text-based PDF parsing is performed by the CareerCompass backend without storing the upload. Scanned-PDF OCR sends the PDF to Gemini only when the signed-in user explicitly consents and a backend Gemini API key is configured. A saved resume is stored in the user's account only after the user chooses Save.",
    },
    {
        "title":"Affu AI capabilities",
        "source_type":"CareerCompass maintained product guide",
        "source_id":"assistant-capabilities",
        "content":"Affu uses Gemini when the backend GEMINI_API_KEY is configured. Its local fallback retrieves only from CareerCompass's maintained product guide and starter career catalogue. Current admissions, fees, regulations, salaries, and job availability must be checked with official or reputable sources.",
    },
    {
        "title":"Language preferences",
        "source_type":"CareerCompass maintained product guide",
        "source_id":"language-status",
        "content":"The profile can store English, Kannada, or Hindi as a preferred language. A saved preference alone does not mean every page or answer has been translated.",
    },
]


def _tokens(text):
    return re.findall(r"[a-z0-9][a-z0-9+#.-]*|[\u0900-\u097f]+|[\u0c80-\u0cff]+", text.casefold())


def retrieve_documents(question, careers, limit=5):
    documents = [dict(document) for document in PRODUCT_DOCUMENTS]
    for career in careers:
        documents.append({
            "title":career["title"],
            "source_type":"CareerCompass curated starter catalogue",
            "source_id":career["id"],
            "content":f"{career['title']}. {career['summary']} Skills to explore: {', '.join(career['skills'])}.",
        })

    query = Counter(_tokens(question))
    if not query:
        return []
    tokenized = [_tokens(document["content"]) for document in documents]
    document_frequency = Counter(token for words in tokenized for token in set(words))
    average_length = sum(map(len, tokenized)) / max(1, len(tokenized))
    ranked = []
    for document, words in zip(documents, tokenized):
        counts = Counter(words)
        score = 0.0
        for token, query_frequency in query.items():
            frequency = counts[token]
            if not frequency:
                continue
            inverse_frequency = log(1 + (len(documents) - document_frequency[token] + 0.5) / (document_frequency[token] + 0.5))
            normalization = frequency + 1.5 * (1 - 0.75 + 0.75 * len(words) / max(1, average_length))
            score += query_frequency * inverse_frequency * frequency * 2.5 / normalization
        if score > 0:
            ranked.append((score, document))
    ranked.sort(key=lambda result: (-result[0], result[1]["title"].casefold()))
    return [document for _, document in ranked[:limit]]
