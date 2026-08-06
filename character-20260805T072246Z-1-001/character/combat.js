/**
 * Combat Engine & Enemy AI Manager for Demon Slayer 3D
 * Handles player health, stamina, damage calculation, demon enemy target AI, combo tracking, and Execution Finisher.
 */

import { sound } from './audio.js';

export class CombatEngine {
  constructor(scene, character, effectsEngine) {
    this.scene = scene;
    this.character = character;
    this.effects = effectsEngine;

    // Player Stats
    this.playerHp = 100;
    this.playerMaxHp = 100;
    this.playerStamina = 100;
    this.playerMaxStamina = 100;

    this.combo = 0;
    this.comboTimer = null;
    this.isBlocking = false;

    // Demon Target Enemy
    this.demon = null;
    this.demonHp = 150;
    this.demonMaxHp = 150;
    this.demonState = 'idle'; // 'idle', 'chase', 'attack', 'hurt', 'dead'
    this.demonAnimTime = 0;
    this.demonAttackCooldown = 0;

    // UI Cache Elements
    this.hpFill = document.getElementById('hp-fill');
    this.hpGhost = document.getElementById('hp-ghost');
    this.hpValue = document.getElementById('hp-value');
    
    this.staminaFill = document.getElementById('stamina-fill');
    this.staminaValue = document.getElementById('stamina-value');

    this.demonHpFill = document.getElementById('demon-hp-fill');
    this.demonHpValue = document.getElementById('demon-hp-value');

    this.comboContainer = document.getElementById('combo-container');
    this.comboCountEl = document.getElementById('combo-count');

    this.damageFlashEl = document.getElementById('damage-flash');
    this.announcementEl = document.getElementById('announcement');

    // Initial Demon Spawn
    this.spawnDemonTarget();
  }

  // --- DEMON ENEMY TARGET CREATION ---
  spawnDemonTarget() {
    if (this.demon) {
      this.scene.remove(this.demon.group);
    }

    const group = new THREE.Group();
    this.demonHp = 150;
    this.demonState = 'idle';

    // Demon Materials
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

    this.updateDemonUI();
    this.showAnnouncement("DEMON TARGET APPEARED!");
  }

  // --- PLAYER ACTIONS & COMBAT LOGIC ---

  // Perform Light Katana Slash
  playerLightSlash() {
    if (this.playerHp <= 0) return;
    this.character.setState('slash');
    sound.playSlashSound();

    this.checkHitOnDemon(50, false);
    this.registerCombo();
  }

  // Perform Special Breathing Technique
  playerSpecialAttack(style) {
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
      this.spawnDemonTarget(); // Spawn new demon if none active
    }

    // Teleport player right in front of demon for execution
    const demonPos = this.demon.position;
    this.character.group.position.set(demonPos.x, demonPos.y, demonPos.z + 2.0);
    this.character.group.lookAt(demonPos.x, demonPos.y, demonPos.z);

    // Play all elemental sounds simultaneously
    sound.playThunderSound();
    sound.playFlameSound();
    sound.playWaterSound();

    // Set Jump Spin Slash animation
    this.character.setState('waterSlash');

    // Spawn massive particle explosion
    const tipPos = this.character.getKatanaTipPosition();
    const charDir = new THREE.Vector3(0, 0, -1);
    this.effects.spawnBreathingEffect('thunder', tipPos, charDir);
    this.effects.spawnBreathingEffect('flame', tipPos, charDir);
    this.effects.spawnBreathingEffect('water', tipPos, charDir);

    // Instantly deal 150 Damage to defeat Demon
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

  // Set Guard / Parry Stance
  setPlayerBlocking(blocking) {
    if (this.playerHp <= 0) return;
    this.isBlocking = blocking;
    if (blocking) {
      this.character.setState('block');
    } else if (this.character.state === 'block') {
      this.character.setState('idle');
    }
  }

  // Total Concentration Gourd Heal Action
  playerHeal() {
    if (this.playerHp <= 0 || this.playerHp >= this.playerMaxHp) return;
    if (!this.useStamina(35)) return;

    this.playerHp = Math.min(this.playerMaxHp, this.playerHp + 40);
    sound.playHealSound();
    this.updatePlayerUI();
    this.showAnnouncement("RECOVERED +40 HP!");

    this.effects.spawnBreathingEffect('water', this.character.group.position, new THREE.Vector3(0, 1, 0));
  }

  // --- HIT DETECTION & DAMAGE ---
  checkHitOnDemon(damageAmount, isCritical) {
    if (!this.demon || this.demonHp <= 0) return;

    const charPos = this.character.group.position;
    const demonPos = this.demon.position;
    const dist = charPos.distanceTo(demonPos);

    if (dist <= 6.0) {
      this.demonHp = Math.max(0, this.demonHp - damageAmount);
      this.updateDemonUI();

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
        
        setTimeout(() => {
          if (this.demon) {
            this.scene.remove(this.demon.group);
            this.demon = null;
          }
        }, 1000);
      }
    }
  }

  // Demon Attacks Player
  demonAttackPlayer() {
    if (this.playerHp <= 0) return;

    const damage = 50;

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

    this.updatePlayerUI();
  }

  // --- STATS & STAMINA REGENERATION ---
  useStamina(amount) {
    if (this.playerStamina >= amount) {
      this.playerStamina -= amount;
      this.updatePlayerUI();
      return true;
    }
    return false;
  }

  registerCombo() {
    this.combo++;
    this.comboCountEl.innerText = this.combo;
    this.comboContainer.classList.add('active');

    clearTimeout(this.comboTimer);
    this.comboTimer = setTimeout(() => {
      this.combo = 0;
      this.comboContainer.classList.remove('active');
    }, 2500);
  }

  triggerDamageFlash() {
    this.damageFlashEl.classList.add('active');
    setTimeout(() => {
      this.damageFlashEl.classList.remove('active');
    }, 200);
  }

  showAnnouncement(text) {
    this.announcementEl.innerText = text;
    this.announcementEl.classList.add('show');
    clearTimeout(this.announcementTimer);
    this.announcementTimer = setTimeout(() => {
      this.announcementEl.classList.remove('show');
    }, 1800);
  }

  // --- UI UPDATES ---
  updatePlayerUI() {
    const hpPct = (this.playerHp / this.playerMaxHp) * 100;
    this.hpFill.style.width = `${hpPct}%`;
    this.hpValue.innerText = `${Math.round(this.playerHp)} / ${this.playerMaxHp}`;

    setTimeout(() => {
      this.hpGhost.style.width = `${hpPct}%`;
    }, 300);

    const staminaPct = (this.playerStamina / this.playerMaxStamina) * 100;
    this.staminaFill.style.width = `${staminaPct}%`;
    this.staminaValue.innerText = `${Math.round(this.playerStamina)} / ${this.playerMaxStamina}`;
  }

  updateDemonUI() {
    if (!this.demonHpFill) return;
    const pct = Math.max(0, (this.demonHp / this.demonMaxHp) * 100);
    this.demonHpFill.style.width = `${pct}%`;
    this.demonHpValue.innerText = `${Math.round(this.demonHp)} / ${this.demonMaxHp}`;
  }

  // --- FRAME UPDATE LOOP ---
  update(deltaTime) {
    if (this.playerStamina < this.playerMaxStamina) {
      this.playerStamina = Math.min(this.playerMaxStamina, this.playerStamina + deltaTime * 15);
      this.updatePlayerUI();
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
