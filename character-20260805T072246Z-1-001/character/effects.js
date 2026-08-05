/**
 * Visual Effects Engine for Demon Slayer 3D
 * Custom particle systems for Water, Flame, and Thunder Breathing techniques,
 * slash trails, ambient wisteria petals, and floating damage numbers.
 */

export class EffectsEngine {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;

    this.particles = [];
    this.slashTrails = [];
    
    // Ambient Wisteria Petals
    this.buildWisteriaPetals();
  }

  // 1. Ambient Falling Wisteria Petals
  buildWisteriaPetals() {
    const petalCount = 120;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(petalCount * 3);
    const velocities = [];

    for (let i = 0; i < petalCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 30;
      positions[i * 3 + 1] = Math.random() * 12 + 1;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 30;

      velocities.push({
        y: -0.015 - Math.random() * 0.02,
        x: Math.sin(i) * 0.01,
        z: Math.cos(i) * 0.01,
        rot: Math.random() * 0.02
      });
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      color: 0xdf80ff,
      size: 0.25,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending
    });

    this.wisteriaSystem = new THREE.Points(geometry, material);
    this.wisteriaVelocities = velocities;
    this.scene.add(this.wisteriaSystem);
  }

  // 2. Spawn Breathing Form Attack Particles
  spawnBreathingEffect(style, position, direction) {
    if (style === 'water') {
      this.spawnWaterWave(position, direction);
    } else if (style === 'flame') {
      this.spawnFlameBurst(position, direction);
    } else if (style === 'thunder') {
      this.spawnThunderSparks(position, direction);
    }
  }

  // Water Wave Effect (Fluid Blue Ribbons & Drops)
  spawnWaterWave(pos, dir) {
    const count = 60;
    for (let i = 0; i < count; i++) {
      const pGeo = new THREE.SphereGeometry(0.08 + Math.random() * 0.12, 8, 8);
      const pMat = new THREE.MeshBasicMaterial({
        color: Math.random() > 0.3 ? 0x00d2ff : 0x80e5ff,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending
      });
      const mesh = new THREE.Mesh(pGeo, pMat);
      
      mesh.position.copy(pos).add(new THREE.Vector3(
        (Math.random() - 0.5) * 1.5,
        (Math.random() - 0.5) * 0.8,
        (Math.random() - 0.5) * 1.5
      ));

      const vel = dir.clone().multiplyScalar(4 + Math.random() * 6).add(new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        Math.random() * 2,
        (Math.random() - 0.5) * 2
      ));

      this.scene.add(mesh);
      this.particles.push({
        mesh,
        vel,
        life: 0.5,
        maxLife: 0.5
      });
    }
  }

  // Flame Burst Effect (Fiery Embers & Shockwave)
  spawnFlameBurst(pos, dir) {
    const count = 75;
    for (let i = 0; i < count; i++) {
      const pGeo = new THREE.DodecahedronGeometry(0.1 + Math.random() * 0.15);
      const pMat = new THREE.MeshBasicMaterial({
        color: Math.random() > 0.4 ? 0xff4500 : 0xffaa00,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending
      });
      const mesh = new THREE.Mesh(pGeo, pMat);

      mesh.position.copy(pos);

      const vel = dir.clone().multiplyScalar(6 + Math.random() * 8).add(new THREE.Vector3(
        (Math.random() - 0.5) * 4,
        Math.random() * 4,
        (Math.random() - 0.5) * 4
      ));

      this.scene.add(mesh);
      this.particles.push({
        mesh,
        vel,
        life: 0.45,
        maxLife: 0.45
      });
    }
  }

  // Thunder Sparks Effect (Jagged Lightning Bolts & Flash)
  spawnThunderSparks(pos, dir) {
    const count = 80;
    for (let i = 0; i < count; i++) {
      const pGeo = new THREE.BoxGeometry(0.04, 0.4 + Math.random() * 0.4, 0.04);
      const pMat = new THREE.MeshBasicMaterial({
        color: Math.random() > 0.3 ? 0xffe600 : 0xffffff,
        transparent: true,
        opacity: 1,
        blending: THREE.AdditiveBlending
      });
      const mesh = new THREE.Mesh(pGeo, pMat);

      mesh.position.copy(pos);
      mesh.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
      );

      const vel = dir.clone().multiplyScalar(10 + Math.random() * 10).add(new THREE.Vector3(
        (Math.random() - 0.5) * 6,
        Math.random() * 3,
        (Math.random() - 0.5) * 6
      ));

      this.scene.add(mesh);
      this.particles.push({
        mesh,
        vel,
        life: 0.35,
        maxLife: 0.35
      });
    }
  }

  // 3. Create 3D Floating Damage Numbers over target position
  spawnDamageNumber(amount, position, isCritical = false) {
    const el = document.createElement('div');
    el.className = `floating-damage ${isCritical ? 'critical' : ''}`;
    el.innerText = isCritical ? `CRITICAL -${amount}` : `-${amount}`;
    document.body.appendChild(el);

    // Track 3D position to 2D Screen projection
    const worldPos = position.clone().add(new THREE.Vector3(
      (Math.random() - 0.5) * 0.5,
      1.5 + Math.random() * 0.5,
      (Math.random() - 0.5) * 0.5
    ));

    const updatePosition = () => {
      const vector = worldPos.clone().project(this.camera);
      const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
      const y = (-(vector.y * 0.5) + 0.5) * window.innerHeight;

      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
    };

    updatePosition();

    // Auto remove element after animation
    setTimeout(() => {
      if (el.parentNode) {
        el.parentNode.removeChild(el);
      }
    }, 800);
  }

  // Frame Update Loop
  update(deltaTime) {
    // Update Wisteria Petals
    const positions = this.wisteriaSystem.geometry.attributes.position.array;
    for (let i = 0; i < this.wisteriaVelocities.length; i++) {
      const v = this.wisteriaVelocities[i];
      positions[i * 3] += v.x;
      positions[i * 3 + 1] += v.y;
      positions[i * 3 + 2] += v.z;

      // Wrap around screen bounds
      if (positions[i * 3 + 1] < 0) {
        positions[i * 3 + 1] = 12;
      }
    }
    this.wisteriaSystem.geometry.attributes.position.needsUpdate = true;

    // Update Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= deltaTime;

      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        p.mesh.material.dispose();
        this.particles.splice(i, 1);
      } else {
        p.mesh.position.addScaledVector(p.vel, deltaTime);
        p.mesh.material.opacity = p.life / p.maxLife;
        p.mesh.scale.multiplyScalar(0.96);
      }
    }
  }
}
