# Implementation Plan - Escape the Demon's Lair

Develop a modern, dark-fantasy cooperative web application for "Escape the Demon's Lair" in Next.js with React UI, Three.js 3D visuals, Firebase database synchronization, Python API integration bridge, and complete rule enforcement.

## User Review Required

> [!NOTE]
> **Python API Integration Strategy**:
> Since your teammate is building the Python backend API for dynamic puzzles, riddles, coding challenges, and timers:
> - We are building a dedicated **Python API Bridge Service** with configurable server endpoints (`http://localhost:5000/api/...` or custom URL).
> - We will provide built-in mock fallback puzzles so the game UI is 100% playable out-of-the-box right now, and will seamlessly swap to the Python backend as soon as your teammate runs their Python server!

> [!IMPORTANT]
> **Firebase Configuration**:
> We will set up `lib/firebase.ts` with Firestore and Realtime DB hooks, complete with `.env.local.example` instructions. We will also include an automatic BroadcastChannel / LocalStorage sync engine so you can test 2-player multiplayer across two browser tabs on your computer without waiting for Firebase key setup!

---

## Game Architecture & Rules Alignment

1. **Team Formation & Lobby**:
   - Player 1 creates team -> Generates unique 6-character room code (e.g. `LAIR-7X9B`).
   - Player 2 joins room via code. Assigns Player 1 as "Lair Navigator" (Level 1 main) and Player 2 as "Door Decrypter" (Level 2 main), converging for Final Level Co-op.
2. **Level 1: Haunted Rooms (Player 1 Focus - 2 Min Limit)**:
   - 3 Haunted 3D Rooms with interactive puzzles, riddles, and coding tasks.
   - Completing room 3 activates the ancient Teleportation Portal.
3. **Level 2: Demon Doors (Player 2 Focus - 3 Min Limit)**:
   - 3 Demon Doors with code decoding challenges.
   - Wrong door selections incur a configurable time penalty (-15 sec).
4. **Final Level: Demon's Throne Room (Co-op - 5 Min Limit)**:
   - Synchronized 3D Demon Throne Room environment.
   - 4 glowing Demon Crystals must be destroyed in sequence/cooperation.
   - Collect 4 Seal Fragments.
   - Ancient Seal selection puzzle (select correct Seal out of 4 to permanently trap/defeat Demon Lord).
5. **Winning Criteria & Leaderboard**:
   - Total elapsed time tracked & synced.
   - Victory screen with shortest time ranking stored in Firebase Firestore/DB.

---

## Proposed Changes

### Configuration & Dependencies
#### [MODIFY] [package.json](file:///e:/PROJECTS/College-game/escape-the-demons-lair/package.json)
- Add `three`, `@types/three`, `firebase`, `lucide-react`, `canvas-confetti`, `@types/canvas-confetti`.

#### [NEW] [.env.local.example](file:///e:/PROJECTS/College-game/escape-the-demons-lair/.env.local.example)
- Document Firebase API keys & Python Backend URL configuration.

---

### Core Data & Services Layer
#### [NEW] [lib/firebase.ts](file:///e:/PROJECTS/College-game/escape-the-demons-lair/lib/firebase.ts)
- Firebase app, Firestore, and Realtime Database initialization with fallback safety.

#### [NEW] [lib/pythonApi.ts](file:///e:/PROJECTS/College-game/escape-the-demons-lair/lib/pythonApi.ts)
- API client to communicate with the teammate's Python backend (endpoints: `/health`, `/puzzles/level1`, `/puzzles/level2`, `/puzzles/final`, `/verify`).

#### [NEW] [lib/gameStore.ts](file:///e:/PROJECTS/College-game/escape-the-demons-lair/lib/gameStore.ts)
- State management & real-time sync wrapper (Firebase + BroadcastChannel fallback for multi-tab testing).

---

### 3D Visuals & Canvas Components (Three.js)
#### [NEW] [components/3d/HauntedRoomCanvas.tsx](file:///e:/PROJECTS/College-game/escape-the-demons-lair/components/3d/HauntedRoomCanvas.tsx)
- Immersive dark fantasy 3D Haunted Room atmosphere with torch lights, eerie fog, floating ruins, and puzzle triggers.

#### [NEW] [components/3d/DemonDoorCanvas.tsx](file:///e:/PROJECTS/College-game/escape-the-demons-lair/components/3d/DemonDoorCanvas.tsx)
- 3D glowing Demon Doors with rune animations, dark portal effects, and interactive click targets.

#### [NEW] [components/3d/ThroneRoomCanvas.tsx](file:///e:/PROJECTS/College-game/escape-the-demons-lair/components/3d/ThroneRoomCanvas.tsx)
- 3D Demon Throne Room featuring 4 destructible glowing Demon Crystals, particle surges, and Demon Lord seal pedestal.

---

### UI Components & Screens
#### [NEW] [components/ui/HeaderHUD.tsx](file:///e:/PROJECTS/College-game/escape-the-demons-lair/components/ui/HeaderHUD.tsx)
- Game HUD showing Team Code, Player Role, Level Status, Realtime Countdown Timers, and Python API connectivity indicator.

#### [NEW] [components/screens/LobbyScreen.tsx](file:///e:/PROJECTS/College-game/escape-the-demons-lair/components/screens/LobbyScreen.tsx)
- Team creation, code generation, code joining, player readiness, and role assignment.

#### [NEW] [components/screens/Level1Screen.tsx](file:///e:/PROJECTS/College-game/escape-the-demons-lair/components/screens/Level1Screen.tsx)
- Level 1 Haunted Rooms UI with riddle solver, code challenge editor, room progression indicators, and portal activation.

#### [NEW] [components/screens/Level2Screen.tsx](file:///e:/PROJECTS/College-game/escape-the-demons-lair/components/screens/Level2Screen.tsx)
- Level 2 Demon Doors UI with cipher decrypter, door selection system, time penalty alerts, and rune unlock mechanisms.

#### [NEW] [components/screens/FinalLevelScreen.tsx](file:///e:/PROJECTS/College-game/escape-the-demons-lair/components/screens/FinalLevelScreen.tsx)
- Final Level Throne Room UI with crystal health tracking, fragment inventory, seal selection menu, and final boss sealing sequence.

#### [NEW] [components/screens/VictoryScreen.tsx](file:///e:/PROJECTS/College-game/escape-the-demons-lair/components/screens/VictoryScreen.tsx)
- Escape celebration, summary stats (completion time, penalties, accuracy), and Firebase Leaderboard.

#### [NEW] [components/ui/PythonConfigModal.tsx](file:///e:/PROJECTS/College-game/escape-the-demons-lair/components/ui/PythonConfigModal.tsx)
- Modal dialog allowing live setting/testing of the Python Backend URL (e.g. `http://localhost:5000`).

---

### API Routes & Pages
#### [NEW] [app/api/python-bridge/route.ts](file:///e:/PROJECTS/College-game/escape-the-demons-lair/app/api/python-bridge/route.ts)
- Next.js proxy route to cleanly bridge client requests to the Python server while bypassing CORS issues.

#### [MODIFY] [app/page.tsx](file:///e:/PROJECTS/College-game/escape-the-demons-lair/app/page.tsx)
- Main application shell orchestrating Lobby, Level 1, Level 2, Final Level, and Victory screen transitions.

---

## Verification Plan

### Automated / Build Verification
- Run `npm run build` or `npx next build` to verify standard TypeScript compilation.

### Manual / Interactive Verification
1. **Multi-Tab Co-op Test**:
   - Open Tab A (Player 1): Click "Create Team", note 6-digit code.
   - Open Tab B (Player 2): Click "Join Team", enter code.
   - Verify both tabs transition to Team Lobby and sync readiness.
2. **Level 1 Progression Test**:
   - Complete 3 haunted room puzzles under 2 minutes limit. Verify portal activation.
3. **Level 2 Progression Test**:
   - Verify Level 2 unlocks for Player 2. Solve 3 Demon Door cipher challenges, verify door penalty logic on incorrect selection.
4. **Final Level Co-op & Seal Test**:
   - Synchronize into Throne Room (5-minute timer).
   - Destroy 4 crystals to gather 4 Seal Fragments.
   - Select correct seal out of 4 to trigger Victory escape sequence.
5. **Python API Bridge Test**:
   - Toggle Python API settings modal, verify health check & fallback fallback mechanism.
