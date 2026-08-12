export interface PuzzleItem {
  id: string;
  title: string;
  description: string;
  type: 'puzzle' | 'riddle' | 'code' | 'cipher' | 'gravity';
  initialCode?: string;
  targetAnswer: string;
  hint?: string;
  options?: string[];
}

export interface Level1RoomData {
  roomId: number;
  name: string;
  description: string;
  puzzle: PuzzleItem;
}

export interface Level2DoorData {
  doorId: number;
  name: string;
  symbol: string;
  codeLength: number;
  puzzle: PuzzleItem;
}

export interface FinalCrystalData {
  crystalId: number;
  name: string;
  color: string;
  rune: string;
  puzzle: PuzzleItem;
}

export const FALLBACK_L1_ROOMS: Level1RoomData[] = [
  {
    roomId: 1,
    name: "Chamber of the Abyssal Labyrinth",
    description: "Navigate demonic spike corridors, collect all 4 rune keys, and unseal the exit portal. Beware — spikes reset your progress!",
    puzzle: {
      id: "l1_p1",
      title: "Gravity Shift Vault — Moderate",
      description: "Collect all 4 rune keys by shifting gravity, then reach the exit portal.",
      type: "gravity",
      targetAnswer: "GRAVITY_SOLVED",
      hint: "Plan each gravity shift carefully. Spikes will reset your position and you'll lose keys collected in that slide."
    }
  }
];

export const FALLBACK_L2_DOORS: Level2DoorData[] = [
  {
    doorId: 1,
    name: "Door of Blood Moon",
    symbol: "🩸",
    codeLength: 4,
    puzzle: {
      id: "l2_d1",
      title: "Caesar Cipher Glyph",
      description: "Shift 'DEMON' backwards by 3 letters in the alphabet. What is the code?",
      type: "cipher",
      targetAnswer: "ABJLI",
      hint: "D->A, E->B, M->J, O->L, N->I."
    }
  },
  {
    doorId: 2,
    name: "Door of Soul Chains",
    symbol: "⛓️",
    codeLength: 4,
    puzzle: {
      id: "l2_d2",
      title: "Binary Soul Key",
      description: "Convert decimal 42 into 6-bit binary representation.",
      type: "cipher",
      targetAnswer: "101010",
      hint: "32 + 8 + 2 = 42 -> 101010"
    }
  },
  {
    doorId: 3,
    name: "Door of Abyssal Gate",
    symbol: "🌀",
    codeLength: 5,
    puzzle: {
      id: "l2_d3",
      title: "Hexadecimal Gatekeeper",
      description: "Convert hex '1F' into decimal.",
      type: "cipher",
      targetAnswer: "31",
      hint: "1*16 + 15 = 31"
    }
  }
];

export const FALLBACK_FINAL_CRYSTALS: FinalCrystalData[] = [
  {
    crystalId: 1,
    name: "Inferno Crystal",
    color: "#ff2200",
    rune: "🔥",
    puzzle: {
      id: "fc_1",
      title: "Flame Glyph Synthesis",
      description: "What element neutralizes the Inferno Crystal energy? (FIRE, WATER, EARTH, AIR)",
      type: "puzzle",
      targetAnswer: "WATER",
      options: ["FIRE", "WATER", "EARTH", "AIR"]
    }
  },
  {
    crystalId: 2,
    name: "Shadow Crystal",
    color: "#8800ff",
    rune: "👁️",
    puzzle: {
      id: "fc_2",
      title: "Light Prism Alignment",
      description: "Complete the Python logic: return light intensity for shadow level 0.",
      type: "code",
      initialCode: "def destroy_shadow(level):\n    return 100 - (level * 20)\n\nprint(destroy_shadow(0))",
      targetAnswer: "100",
      options: ["100", "0", "80", "50"]
    }
  },
  {
    crystalId: 3,
    name: "Thunder Crystal",
    color: "#00ccff",
    rune: "⚡",
    puzzle: {
      id: "fc_3",
      title: "Voltage Resonator",
      description: "If resistance R = 5 and current I = 10, what is voltage V?",
      type: "puzzle",
      targetAnswer: "50",
      hint: "Ohm's Law: V = I * R"
    }
  },
  {
    crystalId: 4,
    name: "Void Crystal",
    color: "#ff0066",
    rune: "💀",
    puzzle: {
      id: "fc_4",
      title: "Void Core Sequence",
      description: "Solve the sequence: 2, 4, 8, 16, __",
      type: "puzzle",
      targetAnswer: "32",
      hint: "Powers of 2."
    }
  }
];

export class PythonApiService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = typeof window !== 'undefined' 
      ? (localStorage.getItem('python_backend_url') || process.env.NEXT_PUBLIC_PYTHON_BACKEND_URL || 'http://localhost:5000')
      : 'http://localhost:5000';
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  public setBaseUrl(url: string) {
    this.baseUrl = url;
    if (typeof window !== 'undefined') {
      localStorage.setItem('python_backend_url', url);
    }
  }

  public async checkHealth(): Promise<{ status: 'online' | 'offline'; message: string }> {
    try {
      const res = await fetch(`${this.baseUrl}/api/health`, { method: 'GET', signal: AbortSignal.timeout(500) });
      if (res.ok) {
        return { status: 'online', message: 'Python Backend Connected!' };
      }
      return { status: 'offline', message: 'Python server returned status ' + res.status };
    } catch {
      return { status: 'offline', message: 'Python Backend Offline (Using Local Puzzle Engine)' };
    }
  }

  public async getTimerConfig(): Promise<{ level1Seconds?: number; level2Seconds?: number; level3Seconds?: number } | null> {
    try {
      const res = await fetch(`${this.baseUrl}/api/timer/config`, { signal: AbortSignal.timeout(500) });
      if (res.ok) {
        const text = await res.text();
        if (text && text.trim()) return JSON.parse(text);
      }
    } catch {
      // Python API is offline
    }
    return null;
  }

  public async startRoomTimer(teamCode: string, level: number): Promise<any> {
    try {
      const res = await fetch(`${this.baseUrl}/api/timer/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamCode, level }),
        signal: AbortSignal.timeout(500)
      });
      if (res.ok) {
        const text = await res.text();
        if (text && text.trim()) return JSON.parse(text);
      }
    } catch {
      // Fallback
    }
    return null;
  }

  public async syncRoomTimer(teamCode: string, penalties: number = 0): Promise<{ timeRemaining?: number; totalTimeElapsed?: number } | null> {
    try {
      const res = await fetch(`${this.baseUrl}/api/timer/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamCode, penalties }),
        signal: AbortSignal.timeout(500)
      });
      if (res.ok) {
        const text = await res.text();
        if (text && text.trim()) return JSON.parse(text);
      }
    } catch {
      // Fallback
    }
    return null;
  }

  public async getLevel2Config(): Promise<any> {
    try {
      const res = await fetch(`${this.baseUrl}/api/level2/config`, { signal: AbortSignal.timeout(500) });
      if (res.ok) {
        const text = await res.text();
        if (text && text.trim()) return JSON.parse(text);
      }
    } catch {
      // Fallback
    }
    return { targetScore: 18 };
  }

  public async getLevel1Rooms(): Promise<Level1RoomData[]> {
    try {
      const res = await fetch(`${this.baseUrl}/api/puzzles/level1`, { signal: AbortSignal.timeout(500) });
      if (res.ok) {
        const text = await res.text();
        if (text && text.trim()) {
          const data = JSON.parse(text);
          if (Array.isArray(data) && data.length > 0) return data;
        }
      }
    } catch {
      // Fallback
    }
    return FALLBACK_L1_ROOMS;
  }

  public async getLevel2Doors(): Promise<Level2DoorData[]> {
    try {
      const res = await fetch(`${this.baseUrl}/api/puzzles/level2`, { signal: AbortSignal.timeout(500) });
      if (res.ok) {
        const text = await res.text();
        if (text && text.trim()) {
          const data = JSON.parse(text);
          if (Array.isArray(data) && data.length > 0) return data;
        }
      }
    } catch {
      // Fallback
    }
    return FALLBACK_L2_DOORS;
  }

  public async getFinalCrystals(): Promise<FinalCrystalData[]> {
    try {
      const res = await fetch(`${this.baseUrl}/api/puzzles/final`, { signal: AbortSignal.timeout(500) });
      if (res.ok) {
        const text = await res.text();
        if (text && text.trim()) {
          const data = JSON.parse(text);
          if (Array.isArray(data) && data.length > 0) return data;
        }
      }
    } catch {
      // Fallback
    }
    return FALLBACK_FINAL_CRYSTALS;
  }

  public async verifyAnswer(puzzleId: string, answer: string): Promise<{ success: boolean; message: string }> {
    try {
      const res = await fetch(`${this.baseUrl}/api/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ puzzleId, answer }),
        signal: AbortSignal.timeout(500)
      });
      if (res.ok) {
        const text = await res.text();
        if (text && text.trim()) return JSON.parse(text);
      }
    } catch {
      // Fallback checking
    }

    const cleanUser = answer.trim().toUpperCase();

    // Check Gravity Shift completion code
    if (cleanUser === "GRAVITY_SOLVED" || cleanUser.includes("GRAVITY")) {
      return { success: true, message: "Access Granted! Gravity Vault unsealed." };
    }

    // Check L1
    for (const room of FALLBACK_L1_ROOMS) {
      const target = room.puzzle.targetAnswer.toUpperCase();
      if (room.puzzle.id === puzzleId || cleanUser === target || cleanUser.includes(target)) {
        const correct = cleanUser === target || cleanUser.includes(target);
        if (correct || room.puzzle.id === puzzleId) {
          return { success: correct, message: correct ? "Access Granted! Altar node illuminated." : "Incorrect rune code. Try again." };
        }
      }
    }

    // Check L2
    for (const door of FALLBACK_L2_DOORS) {
      const target = door.puzzle.targetAnswer.toUpperCase();
      if (door.puzzle.id === puzzleId || cleanUser === target) {
        const correct = cleanUser === target;
        if (correct || door.puzzle.id === puzzleId) {
          return { success: correct, message: correct ? "Demon Door Seal Unlocked!" : "Incorrect cipher key! Demon trap triggered (-15s)." };
        }
      }
    }

    // Check Final
    for (const crystal of FALLBACK_FINAL_CRYSTALS) {
      const target = crystal.puzzle.targetAnswer.toUpperCase();
      if (crystal.puzzle.id === puzzleId || cleanUser === target) {
        const correct = cleanUser === target;
        if (correct || crystal.puzzle.id === puzzleId) {
          return { success: correct, message: correct ? "Demon Crystal Shattered!" : "Incompatible element resonance. Try again." };
        }
      }
    }

    return { success: true, message: "Accepted." };
  }

  public async attackDemonLord(
    playerRole: 'player1' | 'player2',
    gesture: 'FIST' | 'PALM' | 'PEACE',
    currentHp: number,
    partnerGesture?: 'FIST' | 'PALM' | 'PEACE' | null
  ): Promise<{ success: boolean; damage: number; newHp: number; isDefeated: boolean; isCombo: boolean; message: string }> {
    try {
      const res = await fetch(`${this.baseUrl}/api/boss/attack`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerRole, gesture, currentHp, partnerGesture }),
        signal: AbortSignal.timeout(600)
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Offline fallback
    }

    // Local damage calculation fallback
    const DAMAGE_TABLE = { FIST: 45, PALM: 25, PEACE: 35 };
    const baseDamage = DAMAGE_TABLE[gesture] || 30;
    let isCombo = false;
    let comboBonus = 0;

    if (partnerGesture) {
      if (partnerGesture === gesture) {
        isCombo = true;
        comboBonus = 40;
      } else if (
        (gesture === 'FIST' && partnerGesture === 'PEACE') ||
        (gesture === 'PEACE' && partnerGesture === 'FIST')
      ) {
        isCombo = true;
        comboBonus = 50;
      }
    }

    const totalDamage = baseDamage + comboBonus;
    const newHp = Math.max(0, currentHp - totalDamage);
    const isDefeated = newHp <= 0;

    const spellName = playerRole === 'player1'
      ? (gesture === 'FIST' ? 'Inferno Strike ✊' : gesture === 'PALM' ? 'Aegis Shield ✋' : 'Arcane Blast ✌️')
      : (gesture === 'FIST' ? 'Holy Smite ✊' : gesture === 'PALM' ? 'Divine Barrier ✋' : 'Light Surge ✌️');

    let message = `${playerRole.toUpperCase()} cast ${spellName}! Dealt ${totalDamage} damage.`;
    if (isCombo) message += ' ✨ CRITICAL SYNERGY COMBO!';

    return {
      success: true,
      damage: totalDamage,
      newHp,
      isDefeated,
      isCombo,
      message
    };
  }
}

export const pythonApi = new PythonApiService();
