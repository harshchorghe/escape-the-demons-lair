import * as THREE from 'three';
import { DemonSlayerCharacter } from './DemonSlayerCharacter';
import { EffectsEngine } from './EffectsEngine';
import { sound } from './SoundSynthesizer';

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
}

export interface CombatCallbacks {
  onStatsChange?: (stats: CombatStats) => void;
  onAnnouncement?: (text: string) => void;
  onDemonDefeated?: () => void;
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

  public combo: number = 0;
  public comboTimer: NodeJS.Timeout | null = null;
  public isBlocking: boolean = false;

  // Demon Target Enemy
  public demon: {
    group: THREE.Group;
    torso: THREE.Mesh;
    head: THREE.Mesh;
    leftArm: THREE.Mesh;
    rightArm: THREE.Mesh;
    position: THREE.Vector3;
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
    callbacks: CombatCallbacks = {}
  ) {
    this.scene = scene;
    this.character = character;
    this.effects = effectsEngine;
    this.callbacks = callbacks;

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
    if (this.demon) {
      this.scene.remove(this.demon.group);
    }

    const group = new THREE.Group();
    this.demonHp = 150;
    this.demonState = 'idle';

    const skinMat = new THREE.MeshToonMaterial({ color: 0x4a1525 });
    const hornMat = new THREE.MeshStandardMaterial({ color: 0xffea00, roughness: 0.2, metalness: 0.8 });
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });

    const torsoGeo = new THREE.BoxGeometry(0.6, 0.75, 0.4);
    const torso = new THREE.Mesh(torsoGeo, skinMat);
    torso.position.y = 1.1;
    group.add(torso);

    const shoulderGeo = new THREE.ConeGeometry(0.2, 0.4, 4);
    const leftShoulder = new THREE.Mesh(shoulderGeo, hornMat);
    leftShoulder.position.set(0.42, 1.4, 0);
    leftShoulder.rotation.z = -0.5;
    group.add(leftShoulder);

    const rightShoulder = new THREE.Mesh(shoulderGeo, hornMat);
    rightShoulder.position.set(-0.42, 1.4, 0);
    rightShoulder.rotation.z = 0.5;
    group.add(rightShoulder);

    const headGeo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
    const head = new THREE.Mesh(headGeo, skinMat);
    head.position.y = 1.7;
    group.add(head);

    const eyeGeo = new THREE.SphereGeometry(0.06, 8, 8);
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(0.1, 1.75, 0.21);
    group.add(leftEye);

    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(-0.1, 1.75, 0.21);
    group.add(rightEye);

    const hornGeo = new THREE.ConeGeometry(0.08, 0.4, 8);
    const leftHorn = new THREE.Mesh(hornGeo, hornMat);
    leftHorn.position.set(0.12, 1.98, 0.05);
    leftHorn.rotation.x = 0.2;
    group.add(leftHorn);

    const rightHorn = new THREE.Mesh(hornGeo, hornMat);
    rightHorn.position.set(-0.12, 1.98, 0.05);
    rightHorn.rotation.x = 0.2;
    group.add(rightHorn);

    const armGeo = new THREE.CylinderGeometry(0.1, 0.08, 0.7, 8);
    const leftArm = new THREE.Mesh(armGeo, skinMat);
    leftArm.position.set(0.4, 1.1, 0);
    leftArm.rotation.z = -0.3;
    group.add(leftArm);

    const rightArm = new THREE.Mesh(armGeo, skinMat);
    rightArm.position.set(-0.4, 1.1, 0);
    rightArm.rotation.z = 0.3;
    group.add(rightArm);

    group.position.set(0, 0, -4);
    this.scene.add(group);

    this.demon = {
      group,
      torso,
      head,
      leftArm,
      rightArm,
      position: group.position
    };

    this.notifyStats();
    this.showAnnouncement("DEMON TARGET APPEARED!");
  }

  // Perform Light Katana Slash
  playerLightSlash() {
    if (this.playerHp <= 0) return;
    this.character.setState('slash');
    sound.playSlashSound();

    this.checkHitOnDemon(25, false);
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
    if (!this.demon || this.demonHp <= 0) {
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
    if (!this.demon || this.demonHp <= 0) return;

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
        this.showAnnouncement("💥 DEMON VANQUISHED & DEFEATED!");
        
        this.effects.spawnBreathingEffect('flame', demonPos, new THREE.Vector3(0, 1, 0));
        this.effects.spawnBreathingEffect('thunder', demonPos, new THREE.Vector3(0, 1, 0));
        
        if (this.callbacks.onDemonDefeated) {
          this.callbacks.onDemonDefeated();
        }

        setTimeout(() => {
          if (this.demon) {
            this.scene.remove(this.demon.group);
            this.demon = null;
          }
        }, 1000);
      }
    }
  }

  demonAttackPlayer() {
    if (this.playerHp <= 0) return;

    const damage = 15;

    if (this.isBlocking) {
      const blockedDamage = Math.round(damage * 0.25);
      this.playerHp = Math.max(0, this.playerHp - blockedDamage);
      sound.playBlockSound();
      this.effects.spawnDamageNumber(blockedDamage, this.character.group.position, false);
      this.showAnnouncement("PARRIED! -75% DMG");
    } else {
      this.playerHp = Math.max(0, this.playerHp - damage);
      sound.playImpactSound();
      this.character.setState('hurt');

      this.triggerDamageFlash();

      this.effects.spawnDamageNumber(damage, this.character.group.position, true);

      if (this.playerHp <= 0) {
        this.character.setState('die');
        this.showAnnouncement("YOU WERE DEFEATED!");
      }
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

    if (this.demon && this.demonHp > 0 && this.playerHp > 0) {
      this.demonAnimTime += deltaTime;
      const charPos = this.character.group.position;
      const demonPos = this.demon.position;
      const dist = demonPos.distanceTo(charPos);

      this.demon.group.lookAt(charPos.x, demonPos.y, charPos.z);

      if (this.demonState === 'hurt') {
        if (this.demonAnimTime > 0.3) {
          this.demonState = 'idle';
        }
      } else if (dist > 1.8 && dist < 12.0) {
        this.demonState = 'chase';
        const moveDir = charPos.clone().sub(demonPos).normalize();
        demonPos.addScaledVector(moveDir, deltaTime * 2.2);

        this.demon.torso.position.y = 1.1 + Math.sin(this.demonAnimTime * 8) * 0.05;
      } else if (dist <= 1.8) {
        this.demonAttackCooldown -= deltaTime;
        if (this.demonAttackCooldown <= 0) {
          this.demonAttackPlayer();
          this.demonAttackCooldown = 2.2;
        }
      }
    }
  }
}
