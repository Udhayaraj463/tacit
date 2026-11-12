from flask import Flask, request, jsonify

app = Flask(__name__)

@app.route("/", methods=["GET"])
def home():
    return jsonify({"status": "Tacit backend is running successfully!"})

@app.route("/api/transcribe", methods=["POST"])
def transcribe():
    # Add your speech transcription & translation logic here
    return jsonify({"transcript": "Sample transcript", "translation": "Sample translation"})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
# --- Mochi (看得見的對話) Cloud Sync Endpoints ---
import os, json, time
from flask import request, jsonify

SYNC_FILE = os.path.join(os.path.dirname(__file__), 'cloud_state.json')
cloud_state = {
    "venues": None,
    "cards": None,
    "wallpapers": {},
    "carrierCode": "/ABC1234",
    "updatedAt": int(time.time() * 1000)
}

if os.path.exists(SYNC_FILE):
    try:
        with open(SYNC_FILE, 'r', encoding='utf-8') as f:
            cloud_state.update(json.load(f))
    except Exception:
        pass

@app.route('/api/sync', methods=['GET', 'POST', 'OPTIONS'])
def mochi_cloud_sync():
    if request.method == 'OPTIONS':
        res = jsonify({"ok": True})
        res.headers.add('Access-Control-Allow-Origin', '*')
        res.headers.add('Access-Control-Allow-Headers', 'Content-Type')
        res.headers.add('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        return res

    if request.method == 'POST':
        data = request.get_json(silent=True) or {}
        if isinstance(data.get('venues'), list) and len(data['venues']) > 0:
            cloud_state['venues'] = data['venues']
        if isinstance(data.get('cards'), list) and len(data['cards']) > 0:
            cloud_state['cards'] = data['cards']
        if isinstance(data.get('wallpapers'), dict):
            cloud_state['wallpapers'].update(data['wallpapers'])
        if isinstance(data.get('carrierCode'), str):
            cloud_state['carrierCode'] = data['carrierCode']
        cloud_state['updatedAt'] = int(time.time() * 1000)
        try:
            with open(SYNC_FILE, 'w', encoding='utf-8') as f:
                json.dump(cloud_state, f, ensure_ascii=False, indent=2)
        except Exception:
            pass
        res = jsonify({"ok": True, "state": cloud_state})
        res.headers.add('Access-Control-Allow-Origin', '*')
        return res

    res = jsonify(cloud_state)
    res.headers.add('Access-Control-Allow-Origin', '*')
    return res
