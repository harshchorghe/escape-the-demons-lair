import * as THREE from 'three';
import { DemonSlayerCharacter } from './DemonSlayerCharacter';
import { EffectsEngine } from './EffectsEngine';
import { DemonModel } from './DemonModel';
import { sound } from './SoundSynthesizer';
import { gameSync } from '@/lib/gameStore';

export interface DemonTarget {
  id: string;
  group: THREE.Group;
  torso: THREE.Object3D;
  head: THREE.Object3D;
  leftArm: THREE.Object3D;
  rightArm: THREE.Object3D;
  position: THREE.Vector3;
  model: DemonModel;
  hp: number;
  maxHp: number;
  state: 'spawn' | 'idle' | 'patrol' | 'attack' | 'hurt' | 'dead';
  animTime: number;
  attackCooldown: number;
  currentTargetPlayer: 'p1' | 'p2';
  patrolTarget: THREE.Vector3;
  patrolTimer: number;
  /** For stuck detection: last sampled position */
  lastSampledPos: THREE.Vector3;
  /** Time accumulator for stuck detection */
  stuckTimer: number;
  deathTimer?: NodeJS.Timeout | null;
}

export interface CombatStats {
  playerHp: number;
  playerMaxHp: number;
  demonHp: number;
  demonMaxHp: number;
  combo: number;
  announcement: string;
  isDemonDefeated: boolean;
  demonsDefeated: number;
  totalDemons: number;
}

export interface CombatCallbacks {
  onStatsChange?: (stats: CombatStats) => void;
  onAnnouncement?: (text: string) => void;
  onDemonDefeated?: (count: number) => void;
  onAllDemonsDefeated?: () => void;
}

// Minimum distance a new patrol target must be from the current demon position
const MIN_PATROL_DIST = 3.5;
// Arena boundary radius
const ARENA_RADIUS = 11.5;
// Dash cooldown in seconds
const DASH_COOLDOWN = 0.8;
// Melee attack range threshold accounting for 3.6h demon and 2.0h player GLB model radii
const MELEE_ATTACK_RANGE = 4.2;

export class CombatEngine {
  public scene: THREE.Scene;
  public character: DemonSlayerCharacter;
  public effects: EffectsEngine;
  public callbacks: CombatCallbacks;

  // Player Stats
  public playerHp: number = 100;
  public playerMaxHp: number = 100;

  // Single hit registration per attack press
  public attackHitRegistered: boolean = false;

  // Demons Defeated Counter (Goal: 75)
  public demonsDefeated: number = 0;
  public totalDemons: number = 75;

  public combo: number = 0;
  public comboTimer: NodeJS.Timeout | null = null;

  // Dash cooldown state
  private dashCooldownRemaining: number = 0;

  // Partner Character & Multi-Demon State
  public partnerCharacter?: DemonSlayerCharacter;
  public currentTargetPlayer: 'p1' | 'p2' = 'p1';

  public demons: DemonTarget[] = [];
  public MAX_CONCURRENT_DEMONS: number = 3;

  /** Legacy / single-demon backward compatibility getters */
  get demon(): DemonTarget | null {
    return this.demons.find((d) => d.hp > 0 && d.state !== 'dead') || this.demons[0] || null;
  }
  get demonHp(): number {
    const active = this.demon;
    return active ? active.hp : 0;
  }
  get demonMaxHp(): number {
    const active = this.demon;
    return active ? active.maxHp : 1;
  }

  get demonState(): string {
    const active = this.demon;
    return active ? active.state : 'idle';
  }

  public announcement: string = '';
  public announcementTimer: NodeJS.Timeout | null = null;

  public myRole: 'player1' | 'player2' = 'player1';

  constructor(
    scene: THREE.Scene,
    character: DemonSlayerCharacter,
    effectsEngine: EffectsEngine,
    callbacks: CombatCallbacks = {},
    initialDemonsDefeated: number = 0,
    partnerCharacter?: DemonSlayerCharacter,
    myRole: 'player1' | 'player2' = 'player1'
  ) {
    this.scene = scene;
    this.character = character;
    this.partnerCharacter = partnerCharacter;
    this.effects = effectsEngine;
    this.callbacks = callbacks;
    this.demonsDefeated = initialDemonsDefeated;
    this.myRole = myRole;

    // Spawn initial 3 demons simultaneously
    for (let i = 0; i < this.MAX_CONCURRENT_DEMONS; i++) {
      this.spawnDemonTarget();
    }
  }

  notifyStats() {
    if (this.callbacks.onStatsChange) {
      this.callbacks.onStatsChange({
        playerHp: Math.round(this.playerHp),
        playerMaxHp: this.playerMaxHp,
        demonHp: Math.round(this.demonHp),
        demonMaxHp: this.demonMaxHp,
        combo: this.combo,
        announcement: this.announcement,
        isDemonDefeated: this.demonsDefeated >= this.totalDemons,
        demonsDefeated: this.demonsDefeated,
        totalDemons: this.totalDemons,
      });
    }

    // Direct DOM elements update — player HP only
    if (typeof document === 'undefined') return;

    const hpFill = document.getElementById('hp-fill');
    const hpValue = document.getElementById('hp-value');
    if (hpFill) hpFill.style.width = `${(this.playerHp / this.playerMaxHp) * 100}%`;
    if (hpValue) hpValue.innerText = `${Math.round(this.playerHp)} / ${this.playerMaxHp}`;

    const comboCountEl = document.getElementById('combo-count');
    if (comboCountEl) comboCountEl.innerText = `${this.combo}`;
  }

  /** Pick a new valid patrol target that is at least MIN_PATROL_DIST away from currentPos and within arena */
  private pickPatrolTarget(currentPos: THREE.Vector3): THREE.Vector3 {
    const target = new THREE.Vector3();
    let attempts = 0;
    do {
      const angle = Math.random() * Math.PI * 2;
      const radius = 2.0 + Math.random() * (ARENA_RADIUS - 2.5);
      target.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
      attempts++;
    } while (currentPos.distanceTo(target) < MIN_PATROL_DIST && attempts < 20);
    return target;
  }

  /** Spawn an individual DemonTarget into the arena */
  spawnDemonTarget() {
    const activeCount = this.demons.filter((d) => d.hp > 0 && d.state !== 'dead').length;
    if (this.demonsDefeated + activeCount >= this.totalDemons) return;

    const demonModel = new DemonModel(this.scene);

    // Random spawn position in ring around arena
    const angle = Math.random() * Math.PI * 2;
    const radius = 3.0 + Math.random() * 5.5;
    demonModel.group.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);

    const dummy = new THREE.Object3D();
    dummy.position.y = 1.8;

    const spawnPos = demonModel.group.position.clone();
    const patrolTarget = this.pickPatrolTarget(spawnPos);

    const newDemon: DemonTarget = {
      id: 'demon_' + Math.random().toString(36).substr(2, 9),
      group: demonModel.group,
      torso: dummy,
      head: dummy,
      leftArm: dummy,
      rightArm: dummy,
      position: demonModel.group.position,
      model: demonModel,
      hp: 1,
      maxHp: 1,
      state: 'spawn',
      animTime: 0,
      attackCooldown: 0.5 + Math.random() * 1.5,
      currentTargetPlayer: 'p1',
      patrolTarget,
      patrolTimer: 4.0 + Math.random() * 3.0,
      lastSampledPos: spawnPos.clone(),
      stuckTimer: 0,
    };

    demonModel.load('/models/demon.glb');
    this.demons.push(newDemon);
    this.notifyStats();
  }

  /** Helper to find nearest active demon within range */
  getNearestDemon(charPos: THREE.Vector3, maxDist: number = 10.0): DemonTarget | null {
    let nearest: DemonTarget | null = null;
    let minDist = maxDist;
    for (const d of this.demons) {
      if (d.hp > 0 && d.state !== 'dead') {
        const dist = charPos.distanceTo(d.position);
        if (dist < minDist) {
          minDist = dist;
          nearest = d;
        }
      }
    }
    return nearest;
  }

  /**
   * Normal melee attack — deterministic distance & angle check with single hit registration.
   */
  playerMeleeAttack() {
    if (this.playerHp <= 0 || this.character.state === 'die') return;

    // Reset single-hit registration flag for this attack press
    this.attackHitRegistered = false;

    // Select nearest active alive demon within melee attack range
    const nearest = this.getNearestDemon(this.character.group.position, MELEE_ATTACK_RANGE);

    if (nearest) {
      // Smoothly/immediately rotate player toward target demon
      this.character.faceTarget(nearest.position);
    }

    this.character.setState('slash');
    sound.playSlashSound();

    // Perform damage check
    this.checkHitOnDemon(nearest);
    this.registerCombo();
  }

  /**
   * Dash — forward movement using cooldown timing (no stamina dependency).
   */
  playerDash() {
    if (this.playerHp <= 0 || this.character.state === 'die') return;
    if (this.dashCooldownRemaining > 0) return;

    sound.playDashSound();
    const charDir = new THREE.Vector3(0, 0, 1).applyQuaternion(this.character.group.quaternion);
    this.character.group.position.addScaledVector(charDir, 3.0);
    this.dashCooldownRemaining = DASH_COOLDOWN;
  }

  /**
   * Melee attack hit detection — defeats demon on a successful melee strike in range.
   * Guarantees 1 attack press = at most 1 damage event via attackHitRegistered flag.
   */
  checkHitOnDemon(targetDemon?: DemonTarget | null) {
    if (this.playerHp <= 0 || this.character.state === 'die') return;
    if (this.attackHitRegistered) return; // Prevent double hits from single attack press

    const charPos = this.character.group.position;
    const demon = targetDemon || this.getNearestDemon(charPos, MELEE_ATTACK_RANGE);
    if (!demon || demon.hp <= 0 || demon.state === 'dead') return;

    const dist = charPos.distanceTo(demon.position);
    if (dist > MELEE_ATTACK_RANGE) return;

    // Forgiving frontal attack cone check
    const charDir = new THREE.Vector3(0, 0, 1).applyQuaternion(this.character.group.quaternion);
    const dirToDemon = demon.position.clone().sub(charPos).normalize();
    const dot = charDir.dot(dirToDemon);
    if (dot < -0.2) return; // Wide 180°+ frontal cone allowance

    // Single damage event registered
    this.attackHitRegistered = true;

    const demonPos = demon.position;
    demon.hp = 0;
    this.notifyStats();

    sound.playImpactSound();
    this.effects.spawnDamageNumber(100, demonPos, true);

    demon.state = 'hurt';
    demon.animTime = 0;

    const pushDir = demonPos.clone().sub(charPos).normalize();
    demonPos.addScaledVector(pushDir, 0.8);

    if (demon.hp <= 0) {
      demon.state = 'dead';
      demon.model.playAnimation('death', false);

      const deathDurationMs = Math.round(demon.model.getDeathDuration() * 1000);

      gameSync.updateState((prev) => {
        const nextCount = (prev.l3DemonsDefeated || 0) + 1;
        this.demonsDefeated = nextCount;
        return { l3DemonsDefeated: nextCount };
      });

      this.effects.spawnBreathingEffect('flame', demonPos, new THREE.Vector3(0, 1, 0));
      this.effects.spawnBreathingEffect('thunder', demonPos, new THREE.Vector3(0, 1, 0));

      if (this.callbacks.onDemonDefeated) {
        this.callbacks.onDemonDefeated(this.demonsDefeated);
      }

      if (this.demonsDefeated >= this.totalDemons) {
        this.showAnnouncement('🎉 VICTORY! ALL 75 DEMONS ELIMINATED!');
        if (this.callbacks.onAllDemonsDefeated) {
          this.callbacks.onAllDemonsDefeated();
        }
        demon.deathTimer = setTimeout(() => {
          demon.model.dispose();
          this.demons = this.demons.filter((d) => d.id !== demon.id);
        }, deathDurationMs);
      } else {
        this.showAnnouncement(`💥 DEMON DEFEATED! (${this.demonsDefeated}/${this.totalDemons})`);
        demon.deathTimer = setTimeout(() => {
          demon.model.dispose();
          this.demons = this.demons.filter((d) => d.id !== demon.id);
          this.spawnDemonTarget();
        }, deathDurationMs);
      }
    }
  }

  demonAttackPlayer(targetDemon: DemonTarget) {
    if (this.playerHp <= 0 || this.character.state === 'die') return;

    const damage = 15;
    const isTargetingMe =
      (this.myRole === 'player1' && targetDemon.currentTargetPlayer === 'p1') ||
      (this.myRole === 'player2' && targetDemon.currentTargetPlayer === 'p2');

    const targetPos = isTargetingMe
      ? this.character.group.position
      : (this.partnerCharacter ? this.partnerCharacter.group.position : this.character.group.position);

    if (isTargetingMe) {
      this.playerHp = Math.max(0, this.playerHp - damage);
      sound.playImpactSound();
      this.character.setState('hurt');

      this.triggerDamageFlash();
      this.effects.spawnDamageNumber(damage, targetPos, true);

      if (this.playerHp <= 0) {
        this.playerHp = 0;
        this.character.setState('die');
        this.showAnnouncement('YOU WERE DEFEATED!');

        // Authoritative player death broadcast
        const posData = {
          x: this.character.group.position.x,
          z: this.character.group.position.z,
          rot: this.character.group.rotation.y,
          state: 'die',
          alive: false,
          hp: 0,
        };
        if (this.myRole === 'player1') {
          gameSync.updateState({ p1Pos: posData });
        } else {
          gameSync.updateState({ p2Pos: posData });
        }
      } else {
        // Immediate HP-only Firestore write so partner's HP bar updates in real-time.
        const hpData = {
          x: this.character.group.position.x,
          z: this.character.group.position.z,
          rot: this.character.group.rotation.y,
          state: this.character.state,
          alive: true,
          hp: this.playerHp,
        };
        if (this.myRole === 'player1') {
          gameSync.updateState({ p1Pos: hpData });
        } else {
          gameSync.updateState({ p2Pos: hpData });
        }
      }
    } else {
      // Attacking partner
      sound.playImpactSound();
      this.effects.spawnDamageNumber(damage, targetPos, true);
    }

    this.notifyStats();
  }

  registerCombo() {
    this.combo++;
    if (typeof document !== 'undefined') {
      const comboCountEl = document.getElementById('combo-count');
      const comboContainer = document.getElementById('combo-container');
      if (comboCountEl) comboCountEl.innerText = `${this.combo}`;
      if (comboContainer) comboContainer.classList.add('active');
    }

    if (this.comboTimer) clearTimeout(this.comboTimer);
    this.comboTimer = setTimeout(() => {
      this.combo = 0;
      if (typeof document !== 'undefined') {
        const comboContainer = document.getElementById('combo-container');
        if (comboContainer) comboContainer.classList.remove('active');
      }
      this.notifyStats();
    }, 2500);
    this.notifyStats();
  }

  triggerDamageFlash() {
    if (typeof document === 'undefined') return;
    const damageFlashEl = document.getElementById('damage-flash');
    if (damageFlashEl) {
      damageFlashEl.classList.add('active');
      setTimeout(() => {
        damageFlashEl.classList.remove('active');
      }, 200);
    }
  }

  showAnnouncement(text: string) {
    this.announcement = text;
    if (this.callbacks.onAnnouncement) {
      this.callbacks.onAnnouncement(text);
    }

    if (typeof document !== 'undefined') {
      const announcementEl = document.getElementById('announcement');
      if (announcementEl) {
        announcementEl.innerText = text;
        announcementEl.classList.add('show');
        if (this.announcementTimer) clearTimeout(this.announcementTimer);
        this.announcementTimer = setTimeout(() => {
          announcementEl.classList.remove('show');
        }, 1800);
      }
    }
  }



  /** Main update loop per frame */
  update(deltaTime: number) {
    // Tick dash cooldown
    if (this.dashCooldownRemaining > 0) {
      this.dashCooldownRemaining = Math.max(0, this.dashCooldownRemaining - deltaTime);
    }

    const p1Pos = this.character.group.position;
    const p2Pos = this.partnerCharacter ? this.partnerCharacter.group.position : null;

    // Loop through all active demons
    for (const demon of this.demons) {
      // Tick GLB AnimationMixer
      demon.model.update(deltaTime);

      // Dead demon: sink and skip logic
      if (demon.state === 'dead' || demon.hp <= 0) {
        demon.group.position.y = Math.max(-2.5, demon.group.position.y - deltaTime * 0.8);
        continue;
      }

      demon.animTime += deltaTime;

      // Spawning initial delay
      if (demon.state === 'spawn') {
        demon.model.playAnimation('idle');
        if (demon.animTime >= 0.5) {
          demon.state = 'patrol';
          demon.animTime = 0;
        }
        continue;
      }

      // Target selection: determine closest LIVING player
      const isLocalAlive = this.playerHp > 0 && this.character.state !== 'die';
      const isPartnerAlive =
        this.partnerCharacter &&
        this.partnerCharacter.state !== 'die' &&
        this.partnerCharacter.group.visible;

      let closestPos: THREE.Vector3 | null = null;
      let closestDist = Infinity;
      let targetPlayer: 'p1' | 'p2' = 'p1';

      if (isLocalAlive) {
        closestPos = p1Pos;
        closestDist = demon.position.distanceTo(p1Pos);
        targetPlayer = 'p1';
      }

      if (isPartnerAlive && p2Pos) {
        const p2Dist = demon.position.distanceTo(p2Pos);
        if (p2Dist < closestDist) {
          closestPos = p2Pos;
          closestDist = p2Dist;
          targetPlayer = 'p2';
        }
      }

      demon.currentTargetPlayer = targetPlayer;

      const ATTACK_RADIUS = 2.5;

      // ── 1. PLAYER WITHIN ATTACK RADIUS ──
      if (closestPos && closestDist <= ATTACK_RADIUS) {
        demon.state = 'attack';

        // Rotate demon to face closest player
        const dx = closestPos.x - demon.position.x;
        const dz = closestPos.z - demon.position.z;
        if (dx * dx + dz * dz > 0.001) {
          const targetAngle = Math.atan2(dx, dz);
          let diff = targetAngle - demon.group.rotation.y;
          while (diff < -Math.PI) diff += Math.PI * 2;
          while (diff > Math.PI) diff -= Math.PI * 2;

          const turnSpeed = 12.0;
          demon.group.rotation.y += diff * Math.min(1.0, deltaTime * turnSpeed);
        }

        demon.attackCooldown -= deltaTime;
        if (demon.attackCooldown <= 0) {
          demon.model.playAnimation('attack', false);
          this.demonAttackPlayer(demon);
          demon.attackCooldown = 1.8;
        } else if (!demon.model.isAttacking()) {
          demon.model.playAnimation('idle');
        }

        // Reset stuck timer while attacking
        demon.stuckTimer = 0;
        demon.lastSampledPos.copy(demon.position);
      } else {
        // ── 2. RANDOM PATROL / WANDER AI ──
        if (demon.state === 'hurt') {
          if (demon.animTime > 0.35) {
            demon.state = 'patrol';
            demon.animTime = 0;
            if (!demon.model.isAttacking()) {
              demon.model.playAnimation('idle');
            }
          }
          // Skip movement during hurt recovery
          continue;
        }

        demon.state = 'patrol';

        // Decrement patrol timer
        demon.patrolTimer -= deltaTime;

        // Choose new target when timer expires OR demon has reached its current target
        const distToTarget = demon.position.distanceTo(demon.patrolTarget);
        if (demon.patrolTimer <= 0 || distToTarget < 0.6) {
          demon.patrolTarget = this.pickPatrolTarget(demon.position);
          demon.patrolTimer = 4.0 + Math.random() * 4.0;
          // Reset stuck detection on deliberate target change
          demon.stuckTimer = 0;
          demon.lastSampledPos.copy(demon.position);
        }

        // ── Stuck detection: if demon barely moved in 2s, pick a new target ──
        demon.stuckTimer += deltaTime;
        if (demon.stuckTimer >= 2.0) {
          const movedDist = demon.position.distanceTo(demon.lastSampledPos);
          if (movedDist < 0.25) {
            // Stuck — force a new patrol target
            demon.patrolTarget = this.pickPatrolTarget(demon.position);
            demon.patrolTimer = 4.0 + Math.random() * 3.0;
          }
          demon.stuckTimer = 0;
          demon.lastSampledPos.copy(demon.position);
        }

        // ── Move demon toward patrol target every frame ──
        const moveDir = demon.patrolTarget.clone().sub(demon.position);
        const distLeft = moveDir.length();

        if (distLeft > 0.05) {
          moveDir.normalize();
          demon.position.addScaledVector(moveDir, deltaTime * 1.5);

          // Clamp within arena boundary
          if (demon.position.length() > ARENA_RADIUS) {
            demon.position.setLength(ARENA_RADIUS);
            // Bounce: pick a new target away from boundary
            demon.patrolTarget = this.pickPatrolTarget(demon.position);
            demon.patrolTimer = 4.0 + Math.random() * 3.0;
          }

          // Smooth rotation toward movement direction
          const patrolAngle = Math.atan2(moveDir.x, moveDir.z);
          let diff = patrolAngle - demon.group.rotation.y;
          while (diff < -Math.PI) diff += Math.PI * 2;
          while (diff > Math.PI) diff -= Math.PI * 2;
          demon.group.rotation.y += diff * Math.min(1.0, deltaTime * 6.0);

          if (!demon.model.isAttacking()) {
            demon.model.playAnimation('walk');
          }
        } else {
          // Very close to target — play idle until next target is picked
          if (!demon.model.isAttacking()) {
            demon.model.playAnimation('idle');
          }
        }
      }
    }
  }
}
