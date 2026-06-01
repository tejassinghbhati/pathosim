import os
import requests
from flask import Flask, render_template, request, jsonify
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/headline", methods=["POST"])
def headline():
    data = request.get_json(force=True)
    api_key = ANTHROPIC_API_KEY or data.get("api_key", "")

    if not api_key:
        return jsonify({"error": "No API key configured"}), 400

    milestone_id  = data.get("milestone_id", "")
    origin_name   = data.get("origin_name", "Unknown")
    day           = data.get("day", 0)
    total_deaths  = data.get("total_deaths", 0)
    countries_hit = data.get("countries_affected", 0)

    prompt = (
        f'You are generating a realistic news headline for a pandemic simulation.\n'
        f'Milestone: "{milestone_id}"\n'
        f'Origin country: {origin_name}\n'
        f'Day: {day}\n'
        f'Global deaths: {int(total_deaths):,}\n'
        f'Countries affected: {countries_hit}\n\n'
        f'Generate ONE realistic news headline (max 18 words) with a fake publication '
        f'from: Reuters, BBC World, AP News, Bloomberg, The Guardian, CNN, Al Jazeera.\n'
        f'Output ONLY valid JSON: {{"source":"...","text":"..."}}'
    )

    resp = requests.post(
        "https://api.anthropic.com/v1/messages",
        headers={
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
        json={
            "model": "claude-sonnet-4-20250514",
            "max_tokens": 120,
            "messages": [{"role": "user", "content": prompt}],
        },
        timeout=15,
    )

    if not resp.ok:
        return jsonify({"error": "Anthropic API error", "status": resp.status_code}), 502

    try:
        raw = resp.json()["content"][0]["text"].strip()
        import json
        parsed = json.loads(raw)
        return jsonify(parsed)
    except Exception as e:
        return jsonify({"error": f"Parse error: {e}"}), 500


if __name__ == "__main__":
    app.run(debug=True, port=5000)
