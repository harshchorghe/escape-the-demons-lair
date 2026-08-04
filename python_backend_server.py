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
# Default level durations in seconds (Level 1: 60s, Level 2: 120s, Level 3: 210s)
TIMER_CONFIG = {
    "level1Seconds": 60,
    "level2Seconds": 120,
    "level3Seconds": 210
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
            "name": "Chamber 1: The Gravity Well",
            "description": "Shift room gravity UP, DOWN, LEFT, or RIGHT to slide across the floor, collect the rune key, and reach the exit.",
            "puzzle": {
                "id": "l1_p1",
                "title": "Gravity Shift Vault 1",
                "description": "Shift gravity direction to reach the exit portal.",
                "type": "gravity",
                "targetAnswer": "GRAVITY_SOLVED",
                "hint": "Use Arrow keys, WASD, or control buttons to change gravity."
            }
        },
        {
            "roomId": 2,
            "name": "Chamber 2: Spike Vault Matrix",
            "description": "Demonic spikes litter the floor. Carefully tilt gravity to avoid traps, collect all keys, and enter the exit portal.",
            "puzzle": {
                "id": "l1_p2",
                "title": "Gravity Shift Vault 2",
                "description": "Avoid spike traps while shifting gravity.",
                "type": "gravity",
                "targetAnswer": "GRAVITY_SOLVED",
                "hint": "Watch out for spike tiles that reset your position!"
            }
        },
        {
            "roomId": 3,
            "name": "Chamber 3: Abyssal Gravity Core",
            "description": "Navigate narrow spike corridors and collect multiple keys before unsealing the final portal.",
            "puzzle": {
                "id": "l1_p3",
                "title": "Gravity Shift Vault 3",
                "description": "Collect all rune keys in the abyssal gravity maze.",
                "type": "gravity",
                "targetAnswer": "GRAVITY_SOLVED",
                "hint": "Collect all keys to unseal the exit portal."
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

    # Interactive Gravity puzzle token
    if "GRAVITY" in user_answer:
        return jsonify({
            "success": True,
            "message": "Access Granted! Gravity Vault unsealed."
        }), 200

    # Master answers mapping
    ANSWERS = {
        "l1_p1": "GRAVITY_SOLVED",
        "l1_p2": "GRAVITY_SOLVED",
        "l1_p3": "GRAVITY_SOLVED",
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
            "message": "Access Granted! Gravity Vault unsealed."
        }), 200

    return jsonify({
        "success": False,
        "message": "Incorrect answer. Demonic rune rejected!"
    }), 200

# ── LEVEL 3 DEMON LORD BOSS ATTACK ENDPOINT ───────────────────────────
@app.route('/api/boss/attack', methods=['POST'])
def process_boss_attack():
    """Processes player hand gesture attack and calculates damage against Demon Lord."""
    data = request.json or {}
    player_role = data.get("playerRole", "player1")
    gesture = data.get("gesture", "FIST").upper()
    current_hp = data.get("currentHp", 500)
    partner_gesture = data.get("partnerGesture")

    DAMAGE_TABLE = {
        "FIST": 45,    # Heavy Strike (Fireball / Holy Hammer)
        "PALM": 25,    # Barrier Strike / Holy Aura
        "PEACE": 35    # Arcane Blast / Light Surge
    }

    base_damage = DAMAGE_TABLE.get(gesture, 30)
    is_combo = False
    combo_bonus = 0

    # If both players executed synergistic or matching gestures
    if partner_gesture:
        partner_g = str(partner_gesture).upper()
        if partner_g == gesture:
            is_combo = True
            combo_bonus = 40  # Same gesture resonance combo!
        elif {gesture, partner_g} == {"FIST", "PEACE"}:
            is_combo = True
            combo_bonus = 50  # Elemental Overload combo!

    total_damage = base_damage + combo_bonus
    new_hp = max(0, current_hp - total_damage)
    is_defeated = (new_hp <= 0)

    spell_name = "Inferno Strike" if gesture == "FIST" else "Shield Surge" if gesture == "PALM" else "Arcane Beam"
    if player_role == "player2":
        spell_name = "Holy Smite" if gesture == "FIST" else "Divine Protection" if gesture == "PALM" else "Sunfire Burst"

    message = f"{player_role.upper()} cast {spell_name}! Dealt {total_damage} damage."
    if is_combo:
        message += " ✨ CRITICAL SYNERGY COMBO!"

    return jsonify({
        "success": True,
        "damage": total_damage,
        "newHp": new_hp,
        "isDefeated": is_defeated,
        "isCombo": is_combo,
        "message": message
    }), 200

if __name__ == '__main__':
    print("Starting Escape the Demon's Lair Python Backend API on http://localhost:5000...")
    app.run(host='0.0.0.0', port=5000, debug=True)
