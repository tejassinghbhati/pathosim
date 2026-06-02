import os
import json
import requests as http_requests
from flask import Flask, render_template, request, jsonify
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
CLAUDE_MODEL      = "claude-sonnet-4-20250514"

# ── ML model (trained once at startup, ~0.3s) ─────────────────────────────────
_ml = None
def get_ml():
    global _ml
    if _ml is None:
        try:
            import ml_model
            _ml = ml_model
            print("[PATHOSIM] ML model trained and ready.")
        except Exception as e:
            print(f"[PATHOSIM] ML model unavailable: {e}")
    return _ml


# ── Routes ────────────────────────────────────────────────────────────────────

@app.route("/")
def landing():
    return render_template("index.html")


@app.route("/simulate")
def simulate():
    return render_template("simulate.html")


@app.route("/analytics")
def analytics():
    return render_template("analytics.html")


# ── ML inference endpoint ─────────────────────────────────────────────────────

@app.route("/api/ml-params", methods=["POST"])
def ml_params():
    """
    Accepts the city list and returns per-city ML predictions.
    Body: { cities: [{name, iso, pop, hub}, ...] }
    Returns: { city_params: [{beta_mult, cfr_mult, beds, density, haq}, ...],
               feature_importance: {...} }
    """
    ml = get_ml()
    if ml is None:
        return jsonify({"error": "ML model not available — install scikit-learn"}), 503

    data   = request.get_json(force=True) or {}
    cities = data.get("cities", [])
    if not cities:
        return jsonify({"error": "No cities provided"}), 400

    try:
        city_params = ml.predict_all_cities(cities)
        importance  = ml.feature_importance()
        return jsonify({"city_params": city_params, "feature_importance": importance})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── Headline endpoint ─────────────────────────────────────────────────────────

@app.route("/api/headline", methods=["POST"])
def headline():
    data    = request.get_json(force=True) or {}
    api_key = ANTHROPIC_API_KEY or data.get("api_key", "")

    if not api_key:
        return jsonify({"error": "No API key configured."}), 400

    prompt = (
        f'You are writing a realistic breaking-news headline for a pandemic simulation.\n'
        f'Milestone: "{data.get("milestone_id","")}" | Origin: {data.get("origin_name","Unknown")}\n'
        f'Day {data.get("day",0)} | Deaths: {int(data.get("total_deaths",0)):,} | '
        f'Countries affected: {data.get("countries_affected",0)}\n\n'
        f'Write ONE concise, vivid headline (12-18 words). '
        f'Pick a source from: Reuters, BBC World, AP News, Bloomberg, The Guardian, CNN, Al Jazeera.\n'
        f'Respond with ONLY valid JSON on one line: {{"source":"...","text":"..."}}'
    )

    try:
        resp = http_requests.post(
            "https://api.anthropic.com/v1/messages",
            headers={"x-api-key": api_key, "anthropic-version": "2023-06-01",
                     "content-type": "application/json"},
            json={"model": CLAUDE_MODEL, "max_tokens": 150,
                  "messages": [{"role": "user", "content": prompt}]},
            timeout=20,
        )
    except http_requests.exceptions.RequestException as e:
        return jsonify({"error": str(e)}), 502

    if not resp.ok:
        return jsonify({"error": f"Anthropic {resp.status_code}"}), 502

    try:
        raw = resp.json()["content"][0]["text"].strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1].lstrip("json").strip()
        parsed = json.loads(raw)
        return jsonify({"source": str(parsed["source"]), "text": str(parsed["text"])})
    except Exception as e:
        return jsonify({"error": f"Parse error: {e}"}), 500


if __name__ == "__main__":
    get_ml()   # pre-train at startup so first request is instant
    app.run(debug=True, port=5000)
