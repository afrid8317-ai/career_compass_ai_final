from app.knowledge import retrieve_documents


def test_retrieval_prioritizes_relevant_product_facts():
    results = retrieve_documents("Does a Safe college result guarantee admission?", [])

    assert results
    assert results[0]["source_id"] == "college-data"
    assert results[0]["source_type"] == "CareerCompass maintained product guide"


def test_retrieval_returns_matching_career_with_source_metadata():
    careers = [{
        "id":"software-engineer",
        "title":"Software Engineer",
        "summary":"Designs and builds software applications.",
        "skills":["Python", "APIs"],
    }]

    results = retrieve_documents("How can I explore Python software engineering?", careers)

    assert results
    assert results[0]["source_id"] == "software-engineer"
    assert results[0]["source_type"] == "CareerCompass curated starter catalogue"
    assert "Python" in results[0]["content"]
