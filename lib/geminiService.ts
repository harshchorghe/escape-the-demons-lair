import { Level1RoomData, Level2DoorData, FinalCrystalData } from './pythonApi';

export class GeminiService {
  private getApiKey(): string {
    return process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '';
  }

  private async callGemini(prompt: string): Promise<string | null> {
    const apiKey = this.getApiKey();
    if (!apiKey) return null;

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json"
          }
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        return text || null;
      }
    } catch (e) {
      console.warn("Gemini API call failed, using template engine:", e);
    }
    return null;
  }

  // ── LEVEL 1 PUZZLE SET GENERATOR (10 Sets) ──────────────────────────
  public async generateLevel1Sets(count: number = 10): Promise<Array<{ setId: string; rooms: Level1RoomData[] }>> {
    const prompt = `Generate a JSON array of ${count} distinct Level 1 question sets for a horror escape game. 
Each set MUST have an "setId" like "set_1", "set_2"... up to "set_${count}", and a "rooms" array of 3 rooms:
Room 1: Logic puzzle with numerical targetAnswer and 4 options.
Room 2: Horror riddle with single-word upper-case targetAnswer and 4 options.
Room 3: Python code puzzle checking a property (like prime, factorial, fibonacci) with options ["TRUE", "FALSE"].
Return strict JSON matching format: [{ "setId": "set_1", "rooms": [...] }]`;

    const raw = await this.callGemini(prompt);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {
        // Fallback to generator pool
      }
    }

    return this.generateFallbackLevel1Sets(count);
  }

  // ── LEVEL 2 DOOR CIPHER GENERATOR (10 Sets) ────────────────────────
  public async generateLevel2Sets(count: number = 10): Promise<Array<{ setId: string; doors: Level2DoorData[] }>> {
    const prompt = `Generate a JSON array of ${count} distinct Level 2 door cipher sets.
Each set MUST have an "setId" like "set_1", "set_2"... up to "set_${count}", and a "doors" array of 3 doors:
Door 1: Caesar cipher shift (uppercase code targetAnswer).
Door 2: Binary conversion (e.g. decimal to 6-bit binary string targetAnswer like "101010").
Door 3: Hexadecimal conversion (e.g. hex to decimal targetAnswer like "31").
Return strict JSON matching format: [{ "setId": "set_1", "doors": [...] }]`;

    const raw = await this.callGemini(prompt);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {
        // Fallback to generator pool
      }
    }

    return this.generateFallbackLevel2Sets(count);
  }

  // ── LEVEL 3 CRYSTAL GENERATOR (10 Sets) ────────────────────────────
  public async generateLevel3Sets(count: number = 10): Promise<Array<{ setId: string; crystals: FinalCrystalData[] }>> {
    const prompt = `Generate a JSON array of ${count} distinct Level 3 Throne Room crystal sets.
Each set MUST have an "setId" like "set_1", "set_2"... up to "set_${count}", and a "crystals" array of 4 crystals (Inferno, Shadow, Thunder, Void) with unique puzzles.
Return strict JSON matching format: [{ "setId": "set_1", "crystals": [...] }]`;

    const raw = await this.callGemini(prompt);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {
        // Fallback to generator pool
      }
    }

    return this.generateFallbackLevel3Sets(count);
  }

  // ── FALLBACK SET GENERATORS ─────────────────────────────────────────
  private generateFallbackLevel1Sets(count: number): Array<{ setId: string; rooms: Level1RoomData[] }> {
    const templates = [
      { sq: 5, ansSq: "25", rid: "FIRE", isPrimeNum: 37, isPrimeAns: "TRUE" },
      { sq: 6, ansSq: "36", rid: "SHADOW", isPrimeNum: 29, isPrimeAns: "TRUE" },
      { sq: 7, ansSq: "49", rid: "BLOOD", isPrimeNum: 15, isPrimeAns: "FALSE" },
      { sq: 8, ansSq: "64", rid: "MIRROR", isPrimeNum: 41, isPrimeAns: "TRUE" },
      { sq: 9, ansSq: "81", rid: "SILENCE", isPrimeNum: 49, isPrimeAns: "FALSE" },
      { sq: 10, ansSq: "100", rid: "COFFIN", isPrimeNum: 53, isPrimeAns: "TRUE" },
      { sq: 11, ansSq: "121", rid: "SKULL", isPrimeNum: 63, isPrimeAns: "FALSE" },
      { sq: 12, ansSq: "144", rid: "GRAVE", isPrimeNum: 67, isPrimeAns: "TRUE" },
      { sq: 13, ansSq: "169", rid: "PHANTOM", isPrimeNum: 77, isPrimeAns: "FALSE" },
      { sq: 14, ansSq: "196", rid: "ABYSS", isPrimeNum: 79, isPrimeAns: "TRUE" },
    ];

    return Array.from({ length: count }, (_, idx) => {
      const t = templates[idx % templates.length];
      const setNum = idx + 1;
      return {
        setId: `set_${setNum}`,
        rooms: [
          {
            roomId: 1,
            name: `Room 1: Cursed Logic (Set ${setNum})`,
            description: "Solve the spectral number altar sequence to break the seal.",
            puzzle: {
              id: `l1_s${setNum}_r1`,
              title: `Rune Pattern #${setNum}`,
              description: `If 2 -> 4, 3 -> 9, 4 -> 16, what number completes ${t.sq} -> ?`,
              type: "puzzle",
              targetAnswer: t.ansSq,
              options: [t.ansSq, (Number(t.ansSq) - 5).toString(), (Number(t.ansSq) + 10).toString(), (Number(t.ansSq) * 2).toString()].sort(),
              hint: `The input number is squared (${t.sq} * ${t.sq}).`
            }
          },
          {
            roomId: 2,
            name: `Room 2: Spectral Riddle (Set ${setNum})`,
            description: "Carved into the obsidian sanctuary wall is a dark enigma.",
            puzzle: {
              id: `l1_s${setNum}_r2`,
              title: `Cryptic Riddle #${setNum}`,
              description: `I dwell in darkness, follow your steps, yet disappear in total shadow. What am I?`,
              type: "riddle",
              targetAnswer: t.rid,
              options: [t.rid, "FIRE", "WIND", "ICE"],
              hint: `Answer is: ${t.rid}`
            }
          },
          {
            roomId: 3,
            name: `Room 3: Python Altar (Set ${setNum})`,
            description: "Write the logic to verify prime runes for portal teleportation.",
            puzzle: {
              id: `l1_s${setNum}_r3`,
              title: `Prime Evaluator #${setNum}`,
              description: `Evaluate Python code: Is ${t.isPrimeNum} a Prime Number?`,
              type: "code",
              initialCode: `def is_prime(n):\n    if n <= 1: return False\n    for i in range(2, int(n**0.5) + 1):\n        if n % i == 0:\n            return False\n    return True\nprint(is_prime(${t.isPrimeNum}))`,
              targetAnswer: t.isPrimeAns,
              options: ["TRUE", "FALSE"],
              hint: `${t.isPrimeNum} prime test evaluated.`
            }
          }
        ]
      };
    });
  }

  private generateFallbackLevel2Sets(count: number): Array<{ setId: string; doors: Level2DoorData[] }> {
    const templates = [
      { cipherText: "DEMON (-3)", ansCipher: "ABJLI", decVal: 42, ansBin: "101010", hexVal: "1F", ansHex: "31" },
      { cipherText: "HELL (-2)", ansCipher: "FCJJ", decVal: 27, ansBin: "011011", hexVal: "2A", ansHex: "42" },
      { cipherText: "LAIR (-1)", ansCipher: "KZHQ", decVal: 35, ansBin: "100011", hexVal: "3C", ansHex: "60" },
      { cipherText: "DARK (-3)", ansCipher: "AXOH", decVal: 50, ansBin: "110010", hexVal: "4D", ansHex: "77" },
      { cipherText: "SOUL (-2)", ansCipher: "QMSJ", decVal: 63, ansBin: "111111", hexVal: "5F", ansHex: "95" },
      { cipherText: "FIRE (-1)", ansCipher: "EHQD", decVal: 19, ansBin: "010011", hexVal: "15", ansHex: "21" },
      { cipherText: "GATE (-3)", ansCipher: "DXQB", decVal: 45, ansBin: "101101", hexVal: "2E", ansHex: "46" },
      { cipherText: "RUNE (-2)", ansCipher: "PSLC", decVal: 33, ansBin: "100001", hexVal: "38", ansHex: "56" },
      { cipherText: "BONE (-1)", ansCipher: "ANMD", decVal: 55, ansBin: "110111", hexVal: "40", ansHex: "64" },
      { cipherText: "LICH (-3)", ansCipher: "IFZE", decVal: 60, ansBin: "111100", hexVal: "50", ansHex: "80" },
    ];

    return Array.from({ length: count }, (_, idx) => {
      const t = templates[idx % templates.length];
      const setNum = idx + 1;
      return {
        setId: `set_${setNum}`,
        doors: [
          {
            doorId: 1,
            name: `Blood Moon Gate (Set ${setNum})`,
            symbol: "🩸",
            codeLength: 5,
            puzzle: {
              id: `l2_s${setNum}_d1`,
              title: `Caesar Shift #${setNum}`,
              description: `Shift '${t.cipherText}' backwards. What is the code?`,
              type: "cipher",
              targetAnswer: t.ansCipher,
              hint: `Result code is ${t.ansCipher}`
            }
          },
          {
            doorId: 2,
            name: `Soul Chains Gate (Set ${setNum})`,
            symbol: "⛓️",
            codeLength: 6,
            puzzle: {
              id: `l2_s${setNum}_d2`,
              title: `Binary Conversion #${setNum}`,
              description: `Convert decimal ${t.decVal} into 6-bit binary representation.`,
              type: "cipher",
              targetAnswer: t.ansBin,
              hint: `${t.decVal} -> ${t.ansBin}`
            }
          },
          {
            doorId: 3,
            name: `Abyssal Portal (Set ${setNum})`,
            symbol: "🌀",
            codeLength: 2,
            puzzle: {
              id: `l2_s${setNum}_d3`,
              title: `Hexadecimal Key #${setNum}`,
              description: `Convert hex '${t.hexVal}' into decimal.`,
              type: "cipher",
              targetAnswer: t.ansHex,
              hint: `Hex ${t.hexVal} = ${t.ansHex}`
            }
          }
        ]
      };
    });
  }

  private generateFallbackLevel3Sets(count: number): Array<{ setId: string; crystals: FinalCrystalData[] }> {
    return Array.from({ length: count }, (_, idx) => {
      const setNum = idx + 1;
      const val1 = 5 * setNum;
      const val2 = 10 * setNum;
      return {
        setId: `set_${setNum}`,
        crystals: [
          {
            crystalId: 1,
            name: `Inferno Crystal (Set ${setNum})`,
            color: "#ff2200",
            rune: "🔥",
            puzzle: {
              id: `fc_s${setNum}_1`,
              title: `Flame Synthesis #${setNum}`,
              description: "What element neutralizes Inferno Crystal energy? (FIRE, WATER, EARTH, AIR)",
              type: "puzzle",
              targetAnswer: "WATER",
              options: ["FIRE", "WATER", "EARTH", "AIR"]
            }
          },
          {
            crystalId: 2,
            name: `Shadow Crystal (Set ${setNum})`,
            color: "#8800ff",
            rune: "👁️",
            puzzle: {
              id: `fc_s${setNum}_2`,
              title: `Prism Alignment #${setNum}`,
              description: `Evaluate Python code: return shadow intensity for level ${setNum}.`,
              type: "code",
              initialCode: `def destroy_shadow(level):\n    return 100 - (level * ${setNum})\nprint(destroy_shadow(0))`,
              targetAnswer: "100",
              options: ["100", "0", "80", "50"]
            }
          },
          {
            crystalId: 3,
            name: `Thunder Crystal (Set ${setNum})`,
            color: "#00ccff",
            rune: "⚡",
            puzzle: {
              id: `fc_s${setNum}_3`,
              title: `Voltage Resonator #${setNum}`,
              description: `If resistance R = 5 and current I = ${val1}, what is voltage V?`,
              type: "puzzle",
              targetAnswer: (5 * val1).toString(),
              hint: `Ohm's Law: V = ${val1} * 5`
            }
          },
          {
            crystalId: 4,
            name: `Void Crystal (Set ${setNum})`,
            color: "#ff0066",
            rune: "💀",
            puzzle: {
              id: `fc_s${setNum}_4`,
              title: `Void Sequence #${setNum}`,
              description: `Solve sequence: ${val2}, ${val2 * 2}, ${val2 * 4}, __`,
              type: "puzzle",
              targetAnswer: (val2 * 8).toString(),
              hint: `Multiply by 2.`
            }
          }
        ]
      };
    });
  }
}

export const geminiService = new GeminiService();
