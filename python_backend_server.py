"""
Escape the Demon's Lair — Python Backend API Server
Provides dynamic level configurations, room level timer tracking, and session sync.

To run:
    pip install flask flask-cors
    python python_backend_server.py
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import time

app = Flask(__name__)
CORS(app)  # Enable Cross-Origin Resource Sharing for Next.js frontend

# ── DEFAULT TIMER CONFIGURATION ───────────────────────────────────────
# Default level durations in seconds (Level 1: 60s, Level 2: 120s, Level 3: 300s)
TIMER_CONFIG = {
    "level1Seconds": 60,
    "level2Seconds": 120,
    "level3Seconds": 300
}

# Level 2 Gameplay Configuration (Target Pillars, Speed, Gap, Lives)
LEVEL2_CONFIG = {
    "targetScore": 18,
    "pipeSpeed": 4.5,
    "pipeSpeedBoost": 6.5,
    "gravity": 0.24,
    "jumpStrength": -5.2,
    "maxFallSpeed": 7.0,
    "pipeGap": 200,
    "pipeSpawnInterval": 85,
    "speedBoostThreshold": 15,
    "timePenalty": 15,
    "maxLives": 3
}

# In-memory room session timer tracking
ACTIVE_ROOM_TIMERS = {}

# ── HEALTH CHECK ──────────────────────────────────────────────────────
@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({
        "status": "online",
        "message": "Python Backend API Engine is online & operational!",
        "serverTime": int(time.time() * 1000)
    }), 200

# ── LEVEL 2 CONFIG ENDPOINT ───────────────────────────────────────────
@app.route('/api/level2/config', methods=['GET'])
def get_level2_config():
    """Returns Level 2 gameplay configuration (targetScore: 18 pillars)."""
    return jsonify(LEVEL2_CONFIG), 200

# ── TIMER API ENDPOINTS ───────────────────────────────────────────────
@app.route('/api/timer/config', methods=['GET'])
def get_timer_config():
    """Returns default level timer durations."""
    return jsonify(TIMER_CONFIG), 200

@app.route('/api/timer/start', methods=['POST'])
def start_room_timer():
    """Registers or advances a room level timer on the server."""
    data = request.json or {}
    team_code = data.get("teamCode", "").strip().upper()
    level = data.get("level", 1)

    if not team_code:
        return jsonify({"error": "teamCode is required"}), 400

    now_ms = int(time.time() * 1000)
    duration = TIMER_CONFIG.get(f"level{level}Seconds", 120)

    if team_code not in ACTIVE_ROOM_TIMERS:
        ACTIVE_ROOM_TIMERS[team_code] = {
            "missionStartTime": now_ms,
            "currentLevel": level,
            "levelStartTime": now_ms,
            "levelDuration": duration,
            "penalties": 0
        }
    else:
        ACTIVE_ROOM_TIMERS[team_code]["currentLevel"] = level
        ACTIVE_ROOM_TIMERS[team_code]["levelStartTime"] = now_ms
        ACTIVE_ROOM_TIMERS[team_code]["levelDuration"] = duration

    return jsonify({
        "status": "started",
        "teamCode": team_code,
        "level": level,
        "levelDuration": duration,
        "levelStartTime": now_ms,
        "missionStartTime": ACTIVE_ROOM_TIMERS[team_code]["missionStartTime"]
    }), 200

@app.route('/api/timer/sync', methods=['POST'])
def sync_room_timer():
    """Returns official remaining level time and total mission time taken."""
    data = request.json or {}
    team_code = data.get("teamCode", "").strip().upper()
    penalties = data.get("penalties", 0)

    if not team_code or team_code not in ACTIVE_ROOM_TIMERS:
        now_ms = int(time.time() * 1000)
        return jsonify({
            "timeRemaining": 120,
            "totalTimeElapsed": 0,
            "serverTime": now_ms
        }), 200

    session = ACTIVE_ROOM_TIMERS[team_code]
    now_ms = int(time.time() * 1000)

    elapsed_level_sec = int((now_ms - session["levelStartTime"]) / 1000)
    total_mission_sec = int((now_ms - session["missionStartTime"]) / 1000)

    time_remaining = max(0, session["levelDuration"] - elapsed_level_sec - penalties)

    return jsonify({
        "teamCode": team_code,
        "currentLevel": session["currentLevel"],
        "timeRemaining": time_remaining,
        "totalTimeElapsed": total_mission_sec,
        "serverTime": now_ms
    }), 200

if __name__ == '__main__':
    print("Starting Escape the Demon's Lair Python Backend API on http://localhost:5000...")
    app.run(host='0.0.0.0', port=5000, debug=True)
