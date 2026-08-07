import * as THREE from 'three';
import { DemonSlayerCharacter } from './DemonSlayerCharacter';
import { EffectsEngine } from './EffectsEngine';
import { DemonModel } from './DemonModel';
import { sound } from './SoundSynthesizer';
import { gameSync } from '@/lib/gameStore';

export interface CombatStats {
  playerHp: number;
  playerMaxHp: number;
  playerStamina: number;
  playerMaxStamina: number;
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

export class CombatEngine {
  public scene: THREE.Scene;
  public character: DemonSlayerCharacter;
  public effects: EffectsEngine;
  public callbacks: CombatCallbacks;

  // Player Stats
  public playerHp: number = 100;
  public playerMaxHp: number = 100;
  public playerStamina: number = 100;
  public playerMaxStamina: number = 100;

  // Demons Defeated Counter (Goal: 75)
  public demonsDefeated: number = 0;
  public totalDemons: number = 75;

  public combo: number = 0;
  public comboTimer: NodeJS.Timeout | null = null;
  public isBlocking: boolean = false;

  // Target Enemy State
  public partnerCharacter?: DemonSlayerCharacter;
  public currentTargetPlayer: 'p1' | 'p2' = 'p1';
  private demonDeathTimer: NodeJS.Timeout | null = null;

  public demon: {
    group: THREE.Group;
    torso: THREE.Object3D;   // dummy – kept for legacy bob animation compat
    head: THREE.Object3D;    // dummy – retained for type compat
    leftArm: THREE.Object3D; // dummy – retained for type compat
    rightArm: THREE.Object3D;// dummy – retained for type compat
    position: THREE.Vector3;
    model: DemonModel;       // the actual GLB model controller
  } | null = null;
  public demonHp: number = 150;
  public demonMaxHp: number = 150;
  public demonState: string = 'idle'; // 'idle', 'chase', 'attack', 'hurt', 'dead'
  public demonAnimTime: number = 0;
  public demonAttackCooldown: number = 0;

  public announcement: string = '';
  public announcementTimer: NodeJS.Timeout | null = null;

  constructor(
    scene: THREE.Scene,
    character: DemonSlayerCharacter,
    effectsEngine: EffectsEngine,
    callbacks: CombatCallbacks = {},
    initialDemonsDefeated: number = 0,
    partnerCharacter?: DemonSlayerCharacter
  ) {
    this.scene = scene;
    this.character = character;
    this.partnerCharacter = partnerCharacter;
    this.effects = effectsEngine;
    this.callbacks = callbacks;
    this.demonsDefeated = initialDemonsDefeated;

    this.spawnDemonTarget();
  }

  notifyStats() {
    if (this.callbacks.onStatsChange) {
      this.callbacks.onStatsChange({
        playerHp: Math.round(this.playerHp),
        playerMaxHp: this.playerMaxHp,
        playerStamina: Math.round(this.playerStamina),
        playerMaxStamina: this.playerMaxStamina,
        demonHp: Math.round(this.demonHp),
        demonMaxHp: this.demonMaxHp,
        combo: this.combo,
        announcement: this.announcement,
        isDemonDefeated: this.demonHp <= 0,
        demonsDefeated: this.demonsDefeated,
        totalDemons: this.totalDemons,
      });
    }

    // Also update direct DOM elements if present
    if (typeof document === 'undefined') return;

    const hpFill = document.getElementById('hp-fill');
    const hpValue = document.getElementById('hp-value');
    if (hpFill) hpFill.style.width = `${(this.playerHp / this.playerMaxHp) * 100}%`;
    if (hpValue) hpValue.innerText = `${Math.round(this.playerHp)} / ${this.playerMaxHp}`;

    const staminaFill = document.getElementById('stamina-fill');
    const staminaValue = document.getElementById('stamina-value');
    if (staminaFill) staminaFill.style.width = `${(this.playerStamina / this.playerMaxStamina) * 100}%`;
    if (staminaValue) staminaValue.innerText = `${Math.round(this.playerStamina)} / ${this.playerMaxStamina}`;

    const demonHpFill = document.getElementById('demon-hp-fill');
    const demonHpValue = document.getElementById('demon-hp-value');
    if (demonHpFill) demonHpFill.style.width = `${Math.max(0, (this.demonHp / this.demonMaxHp) * 100)}%`;
    if (demonHpValue) demonHpValue.innerText = `${Math.round(Math.max(0, this.demonHp))} / ${this.demonMaxHp}`;

    const comboCountEl = document.getElementById('combo-count');
    if (comboCountEl) comboCountEl.innerText = `${this.combo}`;
  }

  // --- DEMON ENEMY TARGET CREATION ---
  spawnDemonTarget() {
    // Clear pending death timer if any
    if (this.demonDeathTimer) {
      clearTimeout(this.demonDeathTimer);
      this.demonDeathTimer = null;
    }

    // Dispose previous demon if any
    if (this.demon) {
      this.demon.model.dispose();
      this.demon = null;
    }

    this.demonHp = 150;
    this.demonState = 'idle';
    this.currentTargetPlayer = 'p1';

    // Create a DemonModel (GLB loader + AnimationMixer wrapper)
    const demonModel = new DemonModel(this.scene);

    // Randomise spawn position in a ring around the arena centre
    const angle = Math.random() * Math.PI * 2;
    const radius = 3.5 + Math.random() * 4.5;
    demonModel.group.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);

    // Dummy Object3D nodes — kept for backward-compat
    const dummy = new THREE.Object3D();
    dummy.position.y = 1.8;

    this.demon = {
      group:    demonModel.group,
      torso:    dummy,
      head:     dummy,
      leftArm:  dummy,
      rightArm: dummy,
      position: demonModel.group.position,
      model:    demonModel,
    };

    // Load the GLB; scene.add is called inside DemonModel.load() on success
    demonModel.load('/models/demon.glb');

    this.notifyStats();
    this.showAnnouncement(`DEMON #${this.demonsDefeated + 1} SPAWNED!`);
  }

  // Perform Light Katana Slash
  playerLightSlash() {
    if (this.playerHp <= 0) return;
    this.character.setState('slash');
    sound.playSlashSound();

    this.checkHitOnDemon(50, false);
    this.registerCombo();
  }

  // Perform Special Breathing Technique
  playerSpecialAttack(style: string) {
    if (this.playerHp <= 0) return;
    if (!this.useStamina(30)) {
      this.showAnnouncement("NOT ENOUGH STAMINA!");
      return;
    }

    const tipPos = this.character.getKatanaTipPosition();
    const charDir = new THREE.Vector3(0, 0, 1).applyQuaternion(this.character.group.quaternion);

    if (style === 'water') {
      this.character.setState('waterSlash');
      sound.playWaterSound();
      this.effects.spawnBreathingEffect('water', tipPos, charDir);
      this.showAnnouncement("WATER BREATHING: FIRST FORM!");
      this.checkHitOnDemon(45, true);

    } else if (style === 'flame') {
      this.character.setState('flameDash');
      sound.playFlameSound();
      this.effects.spawnBreathingEffect('flame', tipPos, charDir);
      this.showAnnouncement("FLAME BREATHING: UNKNOWING FIRE!");
      
      this.character.group.position.addScaledVector(charDir, 3.5);
      this.checkHitOnDemon(60, true);

    } else if (style === 'thunder') {
      this.character.setState('thunderFlash');
      sound.playThunderSound();
      this.effects.spawnBreathingEffect('thunder', tipPos, charDir);
      this.showAnnouncement("THUNDER BREATHING: THUNDERCLAP!");

      this.character.group.position.addScaledVector(charDir, 5.0);
      this.checkHitOnDemon(75, true);
    }

    this.registerCombo();
  }

  // ⚔️ INSTANT DEFEAT DEMON EXECUTION FINISHER BUTTON ⚔️
  playerExecutionFinisher() {
    if (this.playerHp <= 0) return;
    if (!this.demon || this.demonHp <= 0 || this.demonState === 'dead') {
      this.spawnDemonTarget();
    }

    if (this.demon) {
      const demonPos = this.demon.position;
      this.character.group.position.set(demonPos.x, demonPos.y, demonPos.z + 2.0);
      this.character.group.lookAt(demonPos.x, demonPos.y, demonPos.z);
    }

    sound.playThunderSound();
    sound.playFlameSound();
    sound.playWaterSound();

    this.character.setState('waterSlash');

    const tipPos = this.character.getKatanaTipPosition();
    const charDir = new THREE.Vector3(0, 0, -1);
    this.effects.spawnBreathingEffect('thunder', tipPos, charDir);
    this.effects.spawnBreathingEffect('flame', tipPos, charDir);
    this.effects.spawnBreathingEffect('water', tipPos, charDir);

    this.checkHitOnDemon(150, true);

    this.showAnnouncement("💥 EXECUTION SLASH! DEMON DEFEATED!");
    this.registerCombo();
    this.registerCombo();
    this.registerCombo();
  }

  // High Speed Dodge Dash
  playerDash() {
    if (this.playerHp <= 0) return;
    if (!this.useStamina(20)) return;

    sound.playDashSound();
    const charDir = new THREE.Vector3(0, 0, 1).applyQuaternion(this.character.group.quaternion);
    this.character.group.position.addScaledVector(charDir, 3.0);
    this.effects.spawnBreathingEffect(this.character.breathingStyle, this.character.group.position, charDir);
  }

  // Guard / Parry Stance
  setPlayerBlocking(blocking: boolean) {
    if (this.playerHp <= 0) return;
    this.isBlocking = blocking;
    if (blocking) {
      this.character.setState('block');
    } else if (this.character.state === 'block') {
      this.character.setState('idle');
    }
  }

  // Total Concentration Gourd Heal
  playerHeal() {
    if (this.playerHp <= 0 || this.playerHp >= this.playerMaxHp) return;
    if (!this.useStamina(35)) return;

    this.playerHp = Math.min(this.playerMaxHp, this.playerHp + 40);
    sound.playHealSound();
    this.notifyStats();
    this.showAnnouncement("RECOVERED +40 HP!");

    this.effects.spawnBreathingEffect('water', this.character.group.position, new THREE.Vector3(0, 1, 0));
  }

  // --- HIT DETECTION & DAMAGE ---
  checkHitOnDemon(damageAmount: number, isCritical: boolean) {
    if (!this.demon || this.demonHp <= 0 || this.demonState === 'dead') return;

    const charPos = this.character.group.position;
    const demonPos = this.demon.position;
    const dist = charPos.distanceTo(demonPos);

    if (dist <= 6.0) {
      this.demonHp = Math.max(0, this.demonHp - damageAmount);
      this.notifyStats();

      sound.playImpactSound();
      this.effects.spawnDamageNumber(damageAmount, demonPos, isCritical);

      this.demonState = 'hurt';
      this.demonAnimTime = 0;

      const pushDir = demonPos.clone().sub(charPos).normalize();
      demonPos.addScaledVector(pushDir, 0.8);

      if (this.demonHp <= 0) {
        this.demonState = 'dead';

        if (this.demonDeathTimer) {
          clearTimeout(this.demonDeathTimer);
        }

        // Play death animation on the GLB model
        if (this.demon) {
          this.demon.model.playAnimation('death', false);
        }

        const deathDurationMs = this.demon ? Math.round(this.demon.model.getDeathDuration() * 1000) : 1200;

        // Atomically increment team demon kill count across network & local tabs
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
          this.showAnnouncement("🎉 VICTORY! ALL 75 DEMONS ELIMINATED!");
          if (this.callbacks.onAllDemonsDefeated) {
            this.callbacks.onAllDemonsDefeated();
          }
          this.demonDeathTimer = setTimeout(() => {
            if (this.demon) {
              this.demon.model.dispose();
              this.demon = null;
            }
          }, deathDurationMs);
        } else {
          this.showAnnouncement(`💥 DEMON DEFEATED! (${this.demonsDefeated}/${this.totalDemons})`);
          this.demonDeathTimer = setTimeout(() => {
            if (this.demon) {
              this.demon.model.dispose();
              this.demon = null;
            }
            this.spawnDemonTarget();
          }, deathDurationMs);
        }
      }
    }
  }

  demonAttackPlayer() {
    if (this.playerHp <= 0) return;

    const damage = 15;
    const targetPos = (this.currentTargetPlayer === 'p2' && this.partnerCharacter)
      ? this.partnerCharacter.group.position
      : this.character.group.position;

    if (this.currentTargetPlayer === 'p1') {
      if (this.isBlocking) {
        const blockedDamage = Math.round(damage * 0.25);
        this.playerHp = Math.max(0, this.playerHp - blockedDamage);
        sound.playBlockSound();
        this.effects.spawnDamageNumber(blockedDamage, targetPos, false);
        this.showAnnouncement("PARRIED! -75% DMG");
      } else {
        this.playerHp = Math.max(0, this.playerHp - damage);
        sound.playImpactSound();
        this.character.setState('hurt');

        this.triggerDamageFlash();
        this.effects.spawnDamageNumber(damage, targetPos, true);

        if (this.playerHp <= 0) {
          this.character.setState('die');
          this.showAnnouncement("YOU WERE DEFEATED!");
        }
      }
    } else {
      // Attacking partner (Player 2)
      sound.playImpactSound();
      this.effects.spawnDamageNumber(damage, targetPos, true);
    }

    this.notifyStats();
  }

  useStamina(amount: number): boolean {
    if (this.playerStamina >= amount) {
      this.playerStamina -= amount;
      this.notifyStats();
      return true;
    }
    return false;
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

  update(deltaTime: number) {
    if (this.playerStamina < this.playerMaxStamina) {
      this.playerStamina = Math.min(this.playerMaxStamina, this.playerStamina + deltaTime * 15);
      this.notifyStats();
    }

    if (this.demon) {
      // ALWAYS tick GLB AnimationMixer so death / attack / walk animations run frame-by-frame
      this.demon.model.update(deltaTime);

      // If demon is dead, sink model smoothly into floor during death animation & stop AI
      if (this.demonState === 'dead' || this.demonHp <= 0) {
        this.demon.group.position.y = Math.max(-2.5, this.demon.group.position.y - deltaTime * 0.8);
        return;
      }

      this.demonAnimTime += deltaTime;

      // ── Target Selection: choose nearest / maintain current target between Player 1 & Player 2
      const p1Pos = this.character.group.position;
      const p2Pos = this.partnerCharacter ? this.partnerCharacter.group.position : null;

      let targetPos = p1Pos;
      let targetDist = this.demon.position.distanceTo(p1Pos);

      if (p2Pos) {
        const p2Dist = this.demon.position.distanceTo(p2Pos);
        if (this.currentTargetPlayer === 'p2' && p2Dist < 12.0) {
          targetPos = p2Pos;
          targetDist = p2Dist;
        } else if (this.currentTargetPlayer === 'p1' && targetDist < 12.0) {
          // Stay on p1
        } else if (p2Dist < targetDist) {
          targetPos = p2Pos;
          targetDist = p2Dist;
          this.currentTargetPlayer = 'p2';
        } else {
          this.currentTargetPlayer = 'p1';
        }
      } else {
        this.currentTargetPlayer = 'p1';
      }

      // ── Rotation: face target player directly before & during attacks and chase
      const demonPos = this.demon.position;
      const dx = targetPos.x - demonPos.x;
      const dz = targetPos.z - demonPos.z;

      if (dx * dx + dz * dz > 0.001) {
        const targetAngle = Math.atan2(dx, dz);
        let diff = targetAngle - this.demon.group.rotation.y;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        
        const turnSpeed = 12.0; // Responsive natural turning speed
        this.demon.group.rotation.y += diff * Math.min(1.0, deltaTime * turnSpeed);
      }

      // ── AI State & Continuous Attack Loop ─────────────────────────────
      if (this.demonState === 'hurt') {
        if (this.demonAnimTime > 0.3) {
          this.demonState = 'idle';
          if (!this.demon.model.isAttacking()) {
            this.demon.model.playAnimation('idle');
          }
        }
      } else if (targetDist > 1.8 && targetDist < 12.0) {
        this.demonState = 'chase';
        const moveDir = targetPos.clone().sub(demonPos).normalize();
        demonPos.addScaledVector(moveDir, deltaTime * 2.2);

        // Keep inside arena bounds
        if (demonPos.length() > 13.5) {
          demonPos.setLength(13.5);
        }

        // Legacy bob (moves dummy torso for compatibility)
        this.demon.torso.position.y = 1.1 + Math.sin(this.demonAnimTime * 8) * 0.05;

        // Drive walk animation if not currently finishing an attack swing
        if (!this.demon.model.isAttacking()) {
          this.demon.model.playAnimation('walk');
        }
      } else if (targetDist <= 1.8) {
        this.demonAttackCooldown -= deltaTime;
        if (this.demonAttackCooldown <= 0) {
          // Trigger Attack animation (plays fully)
          this.demon.model.playAnimation('attack', false);
          this.demonAttackPlayer();
          this.demonAttackCooldown = 1.8; // Reset attack cooldown for continuous attacks
        } else if (!this.demon.model.isAttacking()) {
          this.demon.model.playAnimation('idle');
        }
      } else {
        if (!this.demon.model.isAttacking()) {
          this.demon.model.playAnimation('idle');
        }
      }
    }
  }
}
