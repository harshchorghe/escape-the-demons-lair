"""
Escape the Demon's Lair — Python Backend API Server
Provides dynamic puzzle generation, riddle verification, timer configuration, and session time sync.

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
        # Fallback response if session hasn't been initialized
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

# ── PUZZLE ENDPOINTS ──────────────────────────────────────────────────
@app.route('/api/puzzles/level1', methods=['GET'])
def get_level1_puzzles():
    return jsonify([
        {
            "roomId": 1,
            "name": "Room 1: Cursed Logic Puzzle",
            "description": "An ancient spectral altar presents a logic sequence test. Solve the pattern to unlock the altar energy.",
            "puzzle": {
                "id": "l1_p1",
                "title": "Rune Sequence Logic",
                "description": "If 2 -> 4, 3 -> 9, 4 -> 16, what number completes 5 -> ?",
                "type": "puzzle",
                "targetAnswer": "25",
                "options": ["20", "25", "30", "125"],
                "hint": "Each number is squared (n * n)."
            }
        },
        {
            "roomId": 2,
            "name": "Room 2: Spectral Riddle",
            "description": "Carved into the obsidian wall is a riddle that guards the door mechanism.",
            "puzzle": {
                "id": "l1_p2",
                "title": "Riddle of the Void Flame",
                "description": "I have no lungs, but I need air; I have no mouth, but water kills me. What am I?",
                "type": "riddle",
                "targetAnswer": "FIRE",
                "options": ["FIRE", "SHADOW", "WIND", "ICE"],
                "hint": "It consumes oxygen and dies when wet."
            }
        },
        {
            "roomId": 3,
            "name": "Room 3: Python Altar Code",
            "description": "The altar requires the correct prime rune sequence written in Python to open the portal.",
            "puzzle": {
                "id": "l1_p3",
                "title": "Prime Rune Calculator",
                "description": "Write the logic to check if number 37 is a Prime Number.",
                "type": "code",
                "initialCode": "def is_prime(n):\n    if n <= 1: return False\n    for i in range(2, int(n**0.5) + 1):\n        if n % i == 0:\n            return False\n    return True\n# Result for 37:\nprint(is_prime(37))",
                "targetAnswer": "TRUE",
                "options": ["TRUE", "FALSE"],
                "hint": "37 has no divisors other than 1 and itself."
            }
        }
    ]), 200

@app.route('/api/puzzles/level2', methods=['GET'])
def get_level2_puzzles():
    return jsonify([
        {
            "doorId": 1,
            "name": "Door of Blood Moon",
            "symbol": "🩸",
            "codeLength": 4,
            "puzzle": {
                "id": "l2_d1",
                "title": "Caesar Cipher Glyph",
                "description": "Shift 'DEMON' backwards by 3 letters in the alphabet. What is the code?",
                "type": "cipher",
                "targetAnswer": "ABJLI",
                "hint": "D->A, E->B, M->J, O->L, N->I."
            }
        },
        {
            "doorId": 2,
            "name": "Door of Soul Chains",
            "symbol": "⛓️",
            "codeLength": 4,
            "puzzle": {
                "id": "l2_d2",
                "title": "Binary Soul Key",
                "description": "Convert decimal 42 into 6-bit binary representation.",
                "type": "cipher",
                "targetAnswer": "101010",
                "hint": "32 + 8 + 2 = 42 -> 101010"
            }
        },
        {
            "doorId": 3,
            "name": "Door of Abyssal Gate",
            "symbol": "🌀",
            "codeLength": 5,
            "puzzle": {
                "id": "l2_d3",
                "title": "Hexadecimal Gatekeeper",
                "description": "Convert hex '1F' into decimal.",
                "type": "cipher",
                "targetAnswer": "31",
                "hint": "1*16 + 15 = 31"
            }
        }
    ]), 200

@app.route('/api/puzzles/final', methods=['GET'])
def get_final_puzzles():
    return jsonify([
        {
            "crystalId": 1,
            "name": "Inferno Crystal",
            "color": "#ff2200",
            "rune": "🔥",
            "puzzle": {
                "id": "fc_1",
                "title": "Flame Glyph Synthesis",
                "description": "What element neutralizes the Inferno Crystal energy? (FIRE, WATER, EARTH, AIR)",
                "type": "puzzle",
                "targetAnswer": "WATER",
                "options": ["FIRE", "WATER", "EARTH", "AIR"]
            }
        },
        {
            "crystalId": 2,
            "name": "Shadow Crystal",
            "color": "#8800ff",
            "rune": "👁️",
            "puzzle": {
                "id": "fc_2",
                "title": "Light Prism Alignment",
                "description": "Complete the Python logic: return light intensity for shadow level 0.",
                "type": "code",
                "initialCode": "def destroy_shadow(level):\n    return 100 - (level * 20)\n\nprint(destroy_shadow(0))",
                "targetAnswer": "100",
                "options": ["100", "0", "80", "50"]
            }
        },
        {
            "crystalId": 3,
            "name": "Thunder Crystal",
            "color": "#00ccff",
            "rune": "⚡",
            "puzzle": {
                "id": "fc_3",
                "title": "Voltage Resonator",
                "description": "If resistance R = 5 and current I = 10, what is voltage V?",
                "type": "puzzle",
                "targetAnswer": "50",
                "hint": "Ohm's Law: V = I * R"
            }
        },
        {
            "crystalId": 4,
            "name": "Void Crystal",
            "color": "#ff0066",
            "rune": "💀",
            "puzzle": {
                "id": "fc_4",
                "title": "Void Core Sequence",
                "description": "Solve the sequence: 2, 4, 8, 16, __",
                "type": "puzzle",
                "targetAnswer": "32",
                "hint": "Powers of 2."
            }
        }
    ]), 200

# ── ANSWER VERIFICATION ───────────────────────────────────────────────
@app.route('/api/verify', methods=['POST'])
def verify_answer():
    data = request.json or {}
    puzzle_id = data.get("puzzleId", "")
    user_answer = str(data.get("answer", "")).strip().upper()

    # Master answers mapping
    ANSWERS = {
        "l1_p1": "25",
        "l1_p2": "FIRE",
        "l1_p3": "TRUE",
        "l2_d1": "ABJLI",
        "l2_d2": "101010",
        "l2_d3": "31",
        "fc_1": "WATER",
        "fc_2": "100",
        "fc_3": "50",
        "fc_4": "32"
    }

    target = ANSWERS.get(puzzle_id)

    if target and (user_answer == target or target in user_answer):
        return jsonify({
            "success": True,
            "message": "Access Granted! Altar node verified."
        }), 200
    
    # Check by literal answer match across master dictionary
    for k, v in ANSWERS.items():
        if user_answer == v:
            return jsonify({
                "success": True,
                "message": "Access Granted! Solution verified."
            }), 200

    return jsonify({
        "success": False,
        "message": "Incorrect answer. Demonic rune rejected!"
    }), 200

if __name__ == '__main__':
    print("Starting Escape the Demon's Lair Python Backend API on http://localhost:5000...")
    app.run(host='0.0.0.0', port=5000, debug=True)
