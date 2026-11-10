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