/**
 * Main Application Entry Point for Demon Slayer 3D
 * Features OWNDAYS Kimetsu Spectacles Collection, Japanese Moonlit Arena, Input Loop, and Blender 3D Export.
 */

import { DemonSlayerCharacter } from './character.js';
import { EffectsEngine } from './effects.js';
import { CombatEngine } from './combat.js';
import { sound } from './audio.js';

class DemonSlayerApp {
  constructor() {
    this.container = document.getElementById('canvas-container');
    
    // Scene Setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x06060e);
    this.scene.fog = new THREE.FogExp2(0x080814, 0.028);

    // Camera Setup
    this.camera = new THREE.PerspectiveCamera(
      52,
      window.innerWidth / window.innerHeight,
      0.05,
      120
    );
    this.camera.position.set(0, 3.2, 6.5);

    // ── HIGH-QUALITY RENDERER (Cinematic PBR)
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // ── ACES Filmic Tone Mapping — key to cinematic PBR look
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.outputEncoding = THREE.sRGBEncoding;

    this.container.appendChild(this.renderer.domElement);

    // ── Sky gradient sphere for PBR environment reflections
    this._buildSkySphere();

    // Orbit Controls
    this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.05;
    this.controls.minDistance = 3;
    this.controls.maxDistance = 15;

    // Time Tracking
    this.clock = new THREE.Clock();

    // Input Keys State
    this.keys = {
      w: false, a: false, s: false, d: false,
      ArrowUp: false, ArrowLeft: false, ArrowDown: false, ArrowRight: false,
      Shift: false
    };

    // Environment & Entities Initialization
    this.buildJapaneseArena();
    this.character = new DemonSlayerCharacter(this.scene);
    this.effects = new EffectsEngine(this.scene, this.camera);
    this.combat = new CombatEngine(this.scene, this.character, this.effects);

    // Event Listeners
    this.bindInputs();
    this.bindUIEvents();
    window.addEventListener('resize', () => this.onWindowResize());

    // Start Main Loop
    this.animate();
  }

  // ── 1. CINEMATIC MOONLIT SHRINE ARENA
  buildJapaneseArena() {
    // ── Ambient (very low, night atmosphere)
    const ambient = new THREE.AmbientLight(0x151828, 0.5);
    this.scene.add(ambient);

    // ── KEY LIGHT: Blue-white moon (primary shadow caster)
    const moonKey = new THREE.DirectionalLight(0x8cb4f0, 2.2);
    moonKey.position.set(8, 18, 12);
    moonKey.castShadow = true;
    moonKey.shadow.mapSize.width = 4096;
    moonKey.shadow.mapSize.height = 4096;
    moonKey.shadow.camera.near = 0.5;
    moonKey.shadow.camera.far = 50;
    moonKey.shadow.camera.left = -12;
    moonKey.shadow.camera.right = 12;
    moonKey.shadow.camera.top = 12;
    moonKey.shadow.camera.bottom = -12;
    moonKey.shadow.bias = -0.0002;
    this.scene.add(moonKey);

    // ── FILL LIGHT: Warm golden bounce from lanterns below (low angle)
    const fillLight = new THREE.DirectionalLight(0xffa050, 0.55);
    fillLight.position.set(-6, 1.5, 5);
    this.scene.add(fillLight);

    // ── RIM LIGHT: Strong cyan/teal backlit rim for character silhouette
    const rimLight = new THREE.DirectionalLight(0x00e8d2, 1.4);
    rimLight.position.set(0, 4, -9);
    this.scene.add(rimLight);

    // ── CHARACTER SPOTLIGHT: focused above character center
    const charSpot = new THREE.SpotLight(0xffd0a0, 2.2, 14, Math.PI * 0.18, 0.55, 1.2);
    charSpot.position.set(0, 9, 2);
    charSpot.target.position.set(0, 0.8, 0);
    charSpot.castShadow = false; // Don't double-shadow
    this.scene.add(charSpot);
    this.scene.add(charSpot.target);

    // ── Ground — polished dark stone tile
    const groundGeo = new THREE.CylinderGeometry(16, 17, 0.5, 48, 4);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x0e0e1a,
      roughness: 0.45,
      metalness: 0.35,
      envMapIntensity: 0.8,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.position.y = -0.25;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // ── Stone tile pattern rings
    for (let i = 0; i < 3; i++) {
      const r1 = 4 + i * 3.5;
      const rGeo = new THREE.RingGeometry(r1, r1 + 0.06, 48);
      const rMat = new THREE.MeshBasicMaterial({
        color: i === 0 ? 0x00d2ff : 0x334455,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: i === 0 ? 0.55 : 0.2,
      });
      const ring = new THREE.Mesh(rGeo, rMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.01;
      this.scene.add(ring);
    }

    // ── Arena set pieces
    this.buildToriiGate(0, 0, -12);
    this.buildLantern(-6, 0, -8);
    this.buildLantern(6, 0, -8);
    this.buildLantern(-8, 0, 4);
    this.buildLantern(8, 0, 4);
    this.buildLantern(-4, 0, 8);
    this.buildLantern(4, 0, 8);
  }

  // ── Gradient Night Sky Sphere
  _buildSkySphere() {
    const skyGeo = new THREE.SphereGeometry(80, 32, 32);
    // Gradient sky using vertex colors
    const skyMat = new THREE.MeshBasicMaterial({
      color: 0x04040e,
      side: THREE.BackSide,
    });
    const sky = new THREE.Mesh(skyGeo, skyMat);
    this.scene.add(sky);

    // Stars particle system
    const starGeo = new THREE.BufferGeometry();
    const starCount = 1200;
    const positions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i++) {
      positions[i] = (Math.random() - 0.5) * 160;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.12,
      transparent: true,
      opacity: 0.8,
    });
    const stars = new THREE.Points(starGeo, starMat);
    this.scene.add(stars);
  }

  buildToriiGate(x, y, z) {
    const toriiMat = new THREE.MeshStandardMaterial({ color: 0xb30000, roughness: 0.4 });
    const blackMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.3 });

    const gate = new THREE.Group();
    gate.position.set(x, y, z);

    const p1 = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.35, 6, 12), toriiMat);
    p1.position.set(-3.5, 3, 0);
    p1.castShadow = true;
    gate.add(p1);

    const p2 = p1.clone();
    p2.position.set(3.5, 3, 0);
    gate.add(p2);

    const b1 = new THREE.Mesh(new THREE.BoxGeometry(8.5, 0.4, 0.5), toriiMat);
    b1.position.set(0, 5.5, 0);
    b1.castShadow = true;
    gate.add(b1);

    const b2 = new THREE.Mesh(new THREE.BoxGeometry(9.2, 0.5, 0.6), blackMat);
    b2.position.set(0, 6.0, 0);
    b2.castShadow = true;
    gate.add(b2);

    this.scene.add(gate);
  }

  buildLantern(x, y, z) {
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x444455 });
    const fireMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });

    const lantern = new THREE.Group();
    lantern.position.set(x, y, z);

    const base = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.2, 0.6), stoneMat);
    base.position.y = 0.6;
    lantern.add(base);

    const fire = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.4, 0.35), fireMat);
    fire.position.y = 1.4;
    lantern.add(fire);

    const roof = new THREE.Mesh(new THREE.ConeGeometry(0.6, 0.4, 4), stoneMat);
    roof.position.y = 1.75;
    roof.rotation.y = Math.PI / 4;
    lantern.add(roof);

    const pLight = new THREE.PointLight(0xffaa00, 0.8, 6);
    pLight.position.y = 1.4;
    lantern.add(pLight);

    this.scene.add(lantern);
  }

  // --- 2. INPUT BINDINGS ---
  bindInputs() {
    window.addEventListener('keydown', (e) => {
      if (this.keys.hasOwnProperty(e.key)) {
        this.keys[e.key] = true;
      }

      if (e.key === 'j' || e.key === 'J') {
        this.combat.playerLightSlash();
      } else if (e.key === 'k' || e.key === 'K') {
        this.combat.playerSpecialAttack(this.character.breathingStyle);
      } else if (e.key === 'x' || e.key === 'X') {
        this.combat.playerExecutionFinisher();
      } else if (e.key === ' ') {
        this.combat.playerDash();
      } else if (e.key === 'Shift') {
        this.combat.setPlayerBlocking(true);
      } else if (e.key === 'h' || e.key === 'H') {
        this.combat.playerHeal();
      } else if (e.key === 'g' || e.key === 'G') {
        this.toggleGlasses();
      } else if (e.key === 'n' || e.key === 'N') {
        this.combat.spawnDemonTarget();
      } else if (e.key === '1') {
        this.switchStyle('water');
      } else if (e.key === '2') {
        this.switchStyle('flame');
      } else if (e.key === '3') {
        this.switchStyle('thunder');
      }
    });

    window.addEventListener('keyup', (e) => {
      if (this.keys.hasOwnProperty(e.key)) {
        this.keys[e.key] = false;
      }
      if (e.key === 'Shift') {
        this.combat.setPlayerBlocking(false);
      }
    });

    this.renderer.domElement.addEventListener('click', (e) => {
      if (e.target.closest('#hud')) return;
      this.combat.playerLightSlash();
    });
  }

  bindUIEvents() {
    document.querySelectorAll('.style-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const style = tab.getAttribute('data-style');
        this.switchStyle(style);
      });
    });

    document.getElementById('btn-slash').addEventListener('click', () => this.combat.playerLightSlash());
    document.getElementById('btn-special').addEventListener('click', () => this.combat.playerSpecialAttack(this.character.breathingStyle));
    document.getElementById('btn-defeat').addEventListener('click', () => this.combat.playerExecutionFinisher());
    document.getElementById('btn-dash').addEventListener('click', () => this.combat.playerDash());
    document.getElementById('btn-heal').addEventListener('click', () => this.combat.playerHeal());
    document.getElementById('btn-spawn').addEventListener('click', () => this.combat.spawnDemonTarget());
    document.getElementById('btn-glasses').addEventListener('click', () => this.toggleGlasses());

    document.getElementById('btn-export').addEventListener('click', () => {
      this.character.exportBlenderOBJ();
      this.combat.showAnnouncement("EXPORTED BLENDER 3D MODEL (.OBJ)!");
    });

    const btnBlock = document.getElementById('btn-block');
    btnBlock.addEventListener('mousedown', () => this.combat.setPlayerBlocking(true));
    btnBlock.addEventListener('mouseup', () => this.combat.setPlayerBlocking(false));
    btnBlock.addEventListener('touchstart', () => this.combat.setPlayerBlocking(true));
    btnBlock.addEventListener('touchend', () => this.combat.setPlayerBlocking(false));

    document.getElementById('btn-sound').addEventListener('click', () => {
      const isMuted = sound.toggleMute();
      document.getElementById('sound-icon').innerText = isMuted ? '🔇' : '🔊';
    });

    document.getElementById('btn-camera').addEventListener('click', () => {
      const charPos = this.character.group.position;
      this.camera.position.set(charPos.x, charPos.y + 3.5, charPos.z + 7);
      this.controls.target.copy(charPos);
    });

    const modalHelp = document.getElementById('modal-help');
    document.getElementById('btn-help').addEventListener('click', () => {
      modalHelp.classList.remove('hidden');
    });
    document.getElementById('btn-close-help').addEventListener('click', () => {
      modalHelp.classList.add('hidden');
    });
  }

  toggleGlasses() {
    const active = this.character.toggleGlasses();
    const btnText = document.querySelector('#btn-glasses .btn-text');
    if (btnText) {
      btnText.innerText = active ? 'Glasses ON' : 'Glasses OFF';
    }
    this.combat.showAnnouncement(active ? "OWNDAYS GLASSES EQUIPPED!" : "GLASSES REMOVED");
  }

  switchStyle(style) {
    this.character.setBreathingStyle(style);
    
    document.querySelectorAll('.style-tab').forEach(tab => {
      tab.classList.toggle('active', tab.getAttribute('data-style') === style);
    });

    const iconEl = document.getElementById('avatar-icon');
    const titleEl = document.getElementById('style-title');
    const specialTextEl = document.getElementById('special-btn-text');

    if (style === 'water') {
      iconEl.innerText = '👓';
      titleEl.innerText = 'Tanjiro OWNDAYS Frame • 水の呼吸';
      specialTextEl.innerText = 'Water Form 1';
      this.combat.showAnnouncement("EQUIPPED OWNDAYS TANJIRO FRAME!");
    } else if (style === 'flame') {
      iconEl.innerText = '🔥';
      titleEl.innerText = 'Kyojuro OWNDAYS Frame • 炎の呼吸';
      specialTextEl.innerText = 'Flame Form 1';
      this.combat.showAnnouncement("EQUIPPED OWNDAYS RENGOKU FRAME!");
    } else if (style === 'thunder') {
      iconEl.innerText = '⚡';
      titleEl.innerText = 'Zenitsu OWNDAYS Frame • 雷の呼吸';
      specialTextEl.innerText = 'Thunder Form 1';
      this.combat.showAnnouncement("EQUIPPED OWNDAYS ZENITSU FRAME!");
    }
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  // --- 3. MAIN RENDER LOOP ---
  animate() {
    requestAnimationFrame(() => this.animate());

    const deltaTime = Math.min(this.clock.getDelta(), 0.1);

    const moveDir = new THREE.Vector3();
    if (this.keys.w || this.keys.ArrowUp) moveDir.z -= 1;
    if (this.keys.s || this.keys.ArrowDown) moveDir.z += 1;
    if (this.keys.a || this.keys.ArrowLeft) moveDir.x -= 1;
    if (this.keys.d || this.keys.ArrowRight) moveDir.x += 1;

    const isMoving = moveDir.lengthSq() > 0;

    if (isMoving && this.combat.playerHp > 0) {
      moveDir.normalize();

      const cameraAngle = Math.atan2(
        this.camera.position.x - this.character.group.position.x,
        this.camera.position.z - this.character.group.position.z
      );

      const rotatedMove = moveDir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraAngle);

      const moveSpeed = 4.5;
      this.character.group.position.addScaledVector(rotatedMove, deltaTime * moveSpeed);

      if (this.character.group.position.length() > 13.5) {
        this.character.group.position.setLength(13.5);
      }

      const targetRotation = Math.atan2(rotatedMove.x, rotatedMove.z);
      this.character.group.rotation.y = THREE.MathUtils.lerp(
        this.character.group.rotation.y,
        targetRotation,
        0.15
      );
    }

    this.character.update(deltaTime, isMoving, moveDir);
    this.effects.update(deltaTime);
    this.combat.update(deltaTime);

    const charPos = this.character.group.position;
    this.controls.target.lerp(new THREE.Vector3(charPos.x, charPos.y + 1.2, charPos.z), 0.1);
    this.controls.update();

    this.renderer.render(this.scene, this.camera);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new DemonSlayerApp();
});
