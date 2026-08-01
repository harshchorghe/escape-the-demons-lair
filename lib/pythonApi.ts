export interface PuzzleItem {
  id: string;
  title: string;
  description: string;
  type: 'puzzle' | 'riddle' | 'code' | 'cipher';
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
    name: "Room 1: Cursed Logic Puzzle",
    description: "An ancient spectral altar presents a logic sequence test. Solve the pattern to unlock the altar energy.",
    puzzle: {
      id: "l1_p1",
      title: "Rune Sequence Logic",
      description: "If 2 -> 4, 3 -> 9, 4 -> 16, what number completes 5 -> ?",
      type: "puzzle",
      targetAnswer: "25",
      options: ["20", "25", "30", "125"],
      hint: "Each number is squared (n * n)."
    }
  },
  {
    roomId: 2,
    name: "Room 2: Spectral Riddle",
    description: "Carved into the obsidian wall is a riddle that guards the door mechanism.",
    puzzle: {
      id: "l1_p2",
      title: "Riddle of the Void Flame",
      description: "I have no lungs, but I need air; I have no mouth, but water kills me. What am I?",
      type: "riddle",
      targetAnswer: "FIRE",
      options: ["FIRE", "SHADOW", "WIND", "ICE"],
      hint: "It consumes oxygen and dies when wet."
    }
  },
  {
    roomId: 3,
    name: "Room 3: Python Altar Code",
    description: "The altar requires the correct prime rune sequence written in Python to open the portal.",
    puzzle: {
      id: "l1_p3",
      title: "Prime Rune Calculator",
      description: "Write the logic to check if number 37 is a Prime Number.",
      type: "code",
      initialCode: "def is_prime(n):\n    if n <= 1: return False\n    for i in range(2, int(n**0.5) + 1):\n        if n % i == 0:\n            return False\n    return True\n# Result for 37:\nprint(is_prime(37))",
      targetAnswer: "TRUE",
      options: ["TRUE", "FALSE"],
      hint: "37 has no divisors other than 1 and itself."
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

  public async getLevel1Rooms(): Promise<Level1RoomData[]> {
    try {
      const res = await fetch(`${this.baseUrl}/api/puzzles/level1`, { signal: AbortSignal.timeout(500) });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) return data;
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
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) return data;
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
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) return data;
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
        return await res.json();
      }
    } catch {
      // Fallback checking
    }

    const cleanUser = answer.trim().toUpperCase();

    // Check L1
    for (const room of FALLBACK_L1_ROOMS) {
      if (room.puzzle.id === puzzleId) {
        const correct = cleanUser === room.puzzle.targetAnswer.toUpperCase() || cleanUser.includes(room.puzzle.targetAnswer.toUpperCase());
        return { success: correct, message: correct ? "Access Granted! Teleportation node illuminated." : "Incorrect rune code. Try again." };
      }
    }

    // Check L2
    for (const door of FALLBACK_L2_DOORS) {
      if (door.puzzle.id === puzzleId) {
        const correct = cleanUser === door.puzzle.targetAnswer.toUpperCase();
        return { success: correct, message: correct ? "Demon Door Seal Unlocked!" : "Incorrect cipher key! Demon trap triggered (-15s)." };
      }
    }

    // Check Final
    for (const crystal of FALLBACK_FINAL_CRYSTALS) {
      if (crystal.puzzle.id === puzzleId) {
        const correct = cleanUser === crystal.puzzle.targetAnswer.toUpperCase();
        return { success: correct, message: correct ? "Demon Crystal Shattered!" : "Incompatible element resonance. Try again." };
      }
    }

    return { success: true, message: "Accepted." };
  }
}

export const pythonApi = new PythonApiService();
