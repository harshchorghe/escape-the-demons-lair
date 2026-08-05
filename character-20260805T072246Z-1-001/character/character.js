/**
 * HIGH-RESOLUTION Demon Slayer Character — Full PBR Rebuild
 * Features: High-poly organic geometry, Physically Based Rendering (PBR) materials,
 * subsurface skin shading, multi-layer haori cloth physics, detailed facial geometry,
 * full anatomical limbs, high-fidelity Nichirin katana, and OWNDAYS 3D Spectacles.
 */

export class DemonSlayerCharacter {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();

    // Animation state machine
    this.state = 'idle';
    this.animTime = 0;
    this.breathingStyle = 'water';
    this.hasGlasses = true;
    this.joints = {};
    this.clothPanels = [];
    this.clothVelocities = [];

    this.buildPBRMaterials();
    this.buildHighResCharacter();
    this.scene.add(this.group);
  }

  // ─────────────────────────────────────────────
  // 1. PBR MATERIAL LIBRARY
  // ─────────────────────────────────────────────
  buildPBRMaterials() {
    // Skin — warm peach, SSS-like with emissive warmth
    this.mat = {
      skin: new THREE.MeshStandardMaterial({
        color: 0xf0c8a0,
        roughness: 0.62,
        metalness: 0.0,
        emissive: 0x200a00,
        emissiveIntensity: 0.06,
      }),
      skinDark: new THREE.MeshStandardMaterial({
        color: 0xc8966a,
        roughness: 0.7,
        metalness: 0.0,
        emissive: 0x180600,
        emissiveIntensity: 0.05,
      }),
      // Lips
      lips: new THREE.MeshStandardMaterial({
        color: 0xc87070,
        roughness: 0.55,
        metalness: 0.0,
      }),
      // Sclera (whites of eyes)
      eyeWhite: new THREE.MeshStandardMaterial({
        color: 0xf8f4f0,
        roughness: 0.4,
        metalness: 0.0,
      }),
      // Iris — deep red-crimson for Tanjiro
      eyeIris: new THREE.MeshStandardMaterial({
        color: 0xaa0000,
        roughness: 0.15,
        metalness: 0.2,
        emissive: 0x660000,
        emissiveIntensity: 0.3,
      }),
      // Pupil
      eyePupil: new THREE.MeshStandardMaterial({
        color: 0x080808,
        roughness: 0.3,
        metalness: 0.0,
      }),
      // Eye catchlight
      eyeCatch: new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xffffff,
        emissiveIntensity: 1.0,
        roughness: 0.1,
      }),
      // Hair — dark with subtle blue sheen
      hair: new THREE.MeshStandardMaterial({
        color: 0x141020,
        roughness: 0.5,
        metalness: 0.05,
        emissive: 0x050010,
        emissiveIntensity: 0.1,
      }),
      // Eyelash / eyebrow
      eyebrow: new THREE.MeshStandardMaterial({
        color: 0x0a0810,
        roughness: 0.8,
        metalness: 0.0,
      }),
      // Scar mark
      scar: new THREE.MeshStandardMaterial({
        color: 0xcc1a1a,
        roughness: 0.8,
        metalness: 0.0,
        emissive: 0x660000,
        emissiveIntensity: 0.2,
      }),
      // Corps uniform cloth — dark navy
      uniform: new THREE.MeshStandardMaterial({
        color: 0x111825,
        roughness: 0.85,
        metalness: 0.0,
      }),
      // Haori — teal (changes per style)
      haori: new THREE.MeshStandardMaterial({
        color: 0x0d7f7f,
        roughness: 0.75,
        metalness: 0.0,
        side: THREE.DoubleSide,
      }),
      // Haori geometric pattern overlay (black/white checker)
      haoriPattern: new THREE.MeshStandardMaterial({
        color: 0x1a1a1a,
        roughness: 0.8,
        metalness: 0.0,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85,
      }),
      // Belt
      belt: new THREE.MeshStandardMaterial({
        color: 0xe8e4dc,
        roughness: 0.65,
        metalness: 0.0,
      }),
      // Gold metallic
      gold: new THREE.MeshStandardMaterial({
        color: 0xffd700,
        roughness: 0.18,
        metalness: 0.95,
        emissive: 0xaa6600,
        emissiveIntensity: 0.1,
      }),
      // Pants — dark with slight sheen
      pants: new THREE.MeshStandardMaterial({
        color: 0x0c1018,
        roughness: 0.8,
        metalness: 0.0,
      }),
      // Leg wraps
      wraps: new THREE.MeshStandardMaterial({
        color: 0xdcd4c0,
        roughness: 0.9,
        metalness: 0.0,
      }),
      // Geta wooden sandals
      geta: new THREE.MeshStandardMaterial({
        color: 0x7a4010,
        roughness: 0.7,
        metalness: 0.0,
      }),
      // Katana steel — mirror polished
      katanaSteel: new THREE.MeshStandardMaterial({
        color: 0xd8d8e8,
        roughness: 0.05,
        metalness: 1.0,
        envMapIntensity: 2.0,
      }),
      // Katana grip wrap
      katanaGrip: new THREE.MeshStandardMaterial({
        color: 0x600000,
        roughness: 0.85,
        metalness: 0.0,
      }),
      // Katana guard (tsuba)
      katanaTsuba: new THREE.MeshStandardMaterial({
        color: 0xddaa00,
        roughness: 0.22,
        metalness: 0.9,
      }),
      // Blade glowing edge
      bladeGlow: new THREE.MeshStandardMaterial({
        color: 0x00e0ff,
        emissive: 0x00c4e8,
        emissiveIntensity: 2.0,
        roughness: 0.1,
        metalness: 0.4,
        transparent: true,
        opacity: 0.85,
      }),
      // Glasses
      glassFrame: new THREE.MeshStandardMaterial({
        color: 0x0a0a14,
        roughness: 0.15,
        metalness: 0.9,
        envMapIntensity: 1.5,
      }),
      glassAccent: new THREE.MeshStandardMaterial({
        color: 0x00a8a8,
        roughness: 0.2,
        metalness: 0.85,
        emissive: 0x005555,
        emissiveIntensity: 0.3,
      }),
      glassLens: new THREE.MeshPhysicalMaterial({
        color: 0xaaddff,
        transparent: true,
        opacity: 0.25,
        roughness: 0.02,
        metalness: 0.05,
        transmission: 0.9,
        ior: 1.52,
        reflectivity: 0.6,
      }),
    };
  }

  // ─────────────────────────────────────────────
  // 2. CHARACTER BUILDER
  // ─────────────────────────────────────────────
  buildHighResCharacter() {
    const root = new THREE.Group();
    this.joints.root = root;
    this.group.add(root);

    // ── HIPS / ROOT
    const hips = new THREE.Group();
    hips.position.y = 1.05;
    root.add(hips);
    this.joints.hips = hips;

    // Pelvis — organic oval shape using Lathe
    const pelvisPoints = [
      new THREE.Vector2(0.18, -0.14),
      new THREE.Vector2(0.22, -0.04),
      new THREE.Vector2(0.21, 0.10),
      new THREE.Vector2(0.18, 0.18),
    ];
    const pelvisGeo = new THREE.LatheGeometry(pelvisPoints, 24);
    const pelvisMesh = new THREE.Mesh(pelvisGeo, this.mat.uniform);
    pelvisMesh.castShadow = true;
    hips.add(pelvisMesh);

    // Belt
    const beltGeo = new THREE.CylinderGeometry(0.22, 0.20, 0.06, 32);
    const beltMesh = new THREE.Mesh(beltGeo, this.mat.belt);
    beltMesh.position.y = 0.12;
    beltMesh.castShadow = true;
    hips.add(beltMesh);

    // Belt buckle (gold)
    const buckleGeo = new THREE.BoxGeometry(0.06, 0.06, 0.23, 2, 2, 2);
    const buckleMesh = new THREE.Mesh(buckleGeo, this.mat.gold);
    buckleMesh.position.y = 0.12;
    hips.add(buckleMesh);

    // ── LEGS (smooth capsules)
    this._buildLeg(hips, 0.13, 'left');
    this._buildLeg(hips, -0.13, 'right');

    // ── TORSO
    const torso = new THREE.Group();
    torso.position.y = 0.18;
    hips.add(torso);
    this.joints.torso = torso;

    this._buildTorso(torso);

    // ── HAORI COAT
    this._buildHaori(torso);

    // ── HEAD
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 0.68, 0);
    torso.add(headGroup);
    this.joints.head = headGroup;
    this._buildHead(headGroup);

    // ── ARMS
    this._buildArm(torso, 0.30, 'left');
    this._buildArm(torso, -0.30, 'right');

    // ── KATANA
    this._buildKatana();

    // Initial stance
    this.joints.rightArm.rotation.x = -0.35;
    this.joints.rightArm.rotation.z = -0.28;
    this.joints.katanaGrp.rotation.x = Math.PI / 2;
  }

  // ── Smooth Leg with capsule anatomy
  _buildLeg(parent, xOffset, side) {
    const leg = new THREE.Group();
    leg.position.set(xOffset, -0.12, 0);
    parent.add(leg);
    this.joints[side + 'Leg'] = leg;

    // Upper thigh — tapered cylinder with rounded cap
    const thighGeo = new THREE.CylinderGeometry(0.115, 0.095, 0.44, 20, 4);
    const thigh = new THREE.Mesh(thighGeo, this.mat.pants);
    thigh.position.y = -0.22;
    thigh.castShadow = true;
    leg.add(thigh);

    // Knee sphere
    const kneeGeo = new THREE.SphereGeometry(0.095, 16, 16);
    const knee = new THREE.Mesh(kneeGeo, this.mat.pants);
    knee.position.y = -0.44;
    leg.add(knee);

    // Lower shin — wraps
    const shinGeo = new THREE.CylinderGeometry(0.088, 0.07, 0.42, 20, 4);
    const shin = new THREE.Mesh(shinGeo, this.mat.wraps);
    shin.position.y = -0.65;
    shin.castShadow = true;
    leg.add(shin);

    // Ankle sphere
    const ankleGeo = new THREE.SphereGeometry(0.07, 12, 12);
    const ankle = new THREE.Mesh(ankleGeo, this.mat.wraps);
    ankle.position.y = -0.87;
    leg.add(ankle);

    // Foot — tapered box with toe rounding
    const footGeo = new THREE.BoxGeometry(0.11, 0.055, 0.26, 4, 2, 4);
    const foot = new THREE.Mesh(footGeo, this.mat.geta);
    foot.position.set(0, -0.93, 0.06);
    foot.castShadow = true;
    leg.add(foot);

    // Geta wooden platform under foot
    const platformGeo = new THREE.BoxGeometry(0.10, 0.03, 0.24, 2, 1, 4);
    const platform = new THREE.Mesh(platformGeo, this.mat.geta);
    platform.position.set(0, -0.965, 0.06);
    leg.add(platform);
  }

  // ── Organic Torso with muscle form
  _buildTorso(torso) {
    // Chest — lathe for organic pectoral silhouette
    const chestPoints = [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.22, 0.04),
      new THREE.Vector2(0.24, 0.20),
      new THREE.Vector2(0.23, 0.36),
      new THREE.Vector2(0.20, 0.50),
      new THREE.Vector2(0.16, 0.58),
      new THREE.Vector2(0, 0.60),
    ];
    const chestGeo = new THREE.LatheGeometry(chestPoints, 32);
    const chestMesh = new THREE.Mesh(chestGeo, this.mat.uniform);
    chestMesh.castShadow = true;
    torso.add(chestMesh);

    // Collar bone area — tapered cylinder
    const collarGeo = new THREE.CylinderGeometry(0.16, 0.21, 0.12, 24);
    const collar = new THREE.Mesh(collarGeo, this.mat.uniform);
    collar.position.y = 0.60;
    torso.add(collar);

    // Neck
    const neckGeo = new THREE.CylinderGeometry(0.075, 0.10, 0.16, 20);
    const neck = new THREE.Mesh(neckGeo, this.mat.skin);
    neck.position.y = 0.68;
    neck.castShadow = true;
    torso.add(neck);
    this.joints.neck = neck;

    // Corps crest buttons
    for (let i = 0; i < 4; i++) {
      const btnGeo = new THREE.SphereGeometry(0.02, 12, 12);
      const btn = new THREE.Mesh(btnGeo, this.mat.gold);
      btn.position.set(0, 0.08 + i * 0.12, 0.215);
      torso.add(btn);
    }

    // Shoulder pads — flattened spheres
    [-0.27, 0.27].forEach(x => {
      const shoulderCapGeo = new THREE.SphereGeometry(0.12, 20, 14);
      shoulderCapGeo.scale(1.1, 0.85, 1.0);
      const shoulderCap = new THREE.Mesh(shoulderCapGeo, this.mat.uniform);
      shoulderCap.position.set(x, 0.56, 0);
      torso.add(shoulderCap);
    });
  }

  // ── Haori multi-panel with cloth physics
  _buildHaori(torso) {
    const haoriGroup = new THREE.Group();
    torso.add(haoriGroup);
    this.joints.haoriGroup = haoriGroup;

    // Back panel (main wide piece)
    const backGeo = new THREE.PlaneGeometry(0.68, 0.78, 6, 12);
    const backPanel = new THREE.Mesh(backGeo, this.mat.haori);
    backPanel.position.set(0, 0.26, -0.22);
    backPanel.castShadow = true;
    haoriGroup.add(backPanel);
    this.clothPanels.push(backPanel);
    this.clothVelocities.push(0);

    // Left side panel
    const sideGeo = new THREE.PlaneGeometry(0.20, 0.70, 3, 10);
    const leftSide = new THREE.Mesh(sideGeo, this.mat.haori);
    leftSide.position.set(0.30, 0.24, -0.03);
    leftSide.rotation.y = -Math.PI * 0.38;
    leftSide.castShadow = true;
    haoriGroup.add(leftSide);
    this.clothPanels.push(leftSide);
    this.clothVelocities.push(0);

    // Right side panel
    const rightSide = new THREE.Mesh(sideGeo, this.mat.haori);
    rightSide.position.set(-0.30, 0.24, -0.03);
    rightSide.rotation.y = Math.PI * 0.38;
    rightSide.castShadow = true;
    haoriGroup.add(rightSide);
    this.clothPanels.push(rightSide);
    this.clothVelocities.push(0);

    // Chest collar lapels
    const lapelGeo = new THREE.PlaneGeometry(0.14, 0.40, 2, 6);

    const leftLapel = new THREE.Mesh(lapelGeo, this.mat.haori);
    leftLapel.position.set(0.12, 0.45, 0.20);
    leftLapel.rotation.y = Math.PI * 0.15;
    haoriGroup.add(leftLapel);

    const rightLapel = new THREE.Mesh(lapelGeo, this.mat.haori);
    rightLapel.position.set(-0.12, 0.45, 0.20);
    rightLapel.rotation.y = -Math.PI * 0.15;
    haoriGroup.add(rightLapel);

    // Haori geometric pattern overlay squares
    this._addHaoriPattern(haoriGroup);

    this.joints.haoriBack = backPanel;
  }

  // Haori pattern — black/white checker boxes on back panel
  _addHaoriPattern(haoriGroup) {
    const cols = 4, rows = 5;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if ((r + c) % 2 === 0) {
          const pGeo = new THREE.PlaneGeometry(0.14, 0.13);
          const pMat = new THREE.MeshStandardMaterial({
            color: 0x080808,
            roughness: 0.8,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.88,
          });
          const p = new THREE.Mesh(pGeo, pMat);
          p.position.set(
            (c - cols / 2 + 0.5) * 0.155,
            (r - rows / 2 + 0.5) * 0.145 + 0.26,
            -0.205
          );
          haoriGroup.add(p);
        }
      }
    }
  }

  // ── Detailed Head with proper facial anatomy
  _buildHead(headGroup) {
    // ── Main skull — high-res sphere
    const skullGeo = new THREE.SphereGeometry(0.22, 48, 36);
    const skull = new THREE.Mesh(skullGeo, this.mat.skin);
    skull.position.y = 0.22;
    skull.castShadow = true;
    headGroup.add(skull);

    // ── Jawline — slightly elongated lower half
    const jawGeo = new THREE.SphereGeometry(0.18, 36, 24, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
    const jaw = new THREE.Mesh(jawGeo, this.mat.skin);
    jaw.position.y = 0.10;
    headGroup.add(jaw);

    // ── Cheekbones — subtle protrusion
    [-0.16, 0.16].forEach((x) => {
      const cheekGeo = new THREE.SphereGeometry(0.075, 16, 12);
      cheekGeo.scale(1.4, 0.9, 0.7);
      const cheek = new THREE.Mesh(cheekGeo, this.mat.skin);
      cheek.position.set(x, 0.20, 0.16);
      headGroup.add(cheek);
    });

    // ── Nose — 3-part: bridge, tip, nostrils
    const noseBridgeGeo = new THREE.CylinderGeometry(0.024, 0.030, 0.10, 10);
    const noseBridge = new THREE.Mesh(noseBridgeGeo, this.mat.skinDark);
    noseBridge.position.set(0, 0.20, 0.215);
    noseBridge.rotation.x = Math.PI * 0.12;
    headGroup.add(noseBridge);

    const noseTipGeo = new THREE.SphereGeometry(0.032, 14, 10);
    noseTipGeo.scale(1.2, 0.9, 1.0);
    const noseTip = new THREE.Mesh(noseTipGeo, this.mat.skinDark);
    noseTip.position.set(0, 0.155, 0.232);
    headGroup.add(noseTip);

    // ── Lips — top and bottom
    const topLipGeo = new THREE.SphereGeometry(0.04, 14, 8);
    topLipGeo.scale(2.4, 0.6, 0.7);
    const topLip = new THREE.Mesh(topLipGeo, this.mat.lips);
    topLip.position.set(0, 0.12, 0.226);
    headGroup.add(topLip);

    const botLipGeo = new THREE.SphereGeometry(0.04, 14, 8);
    botLipGeo.scale(2.0, 0.7, 0.75);
    const botLip = new THREE.Mesh(botLipGeo, this.mat.lips);
    botLip.position.set(0, 0.098, 0.225);
    headGroup.add(botLip);

    // ── Eyes — 3-layer each
    this._buildEye(headGroup, 0.088, 0.215);   // right eye
    this._buildEye(headGroup, -0.088, 0.215);  // left eye

    // ── Eyebrows — thin curved arcs
    this._buildEyebrow(headGroup, 0.088, 0.280);
    this._buildEyebrow(headGroup, -0.088, 0.280);

    // ── Tanjiro scar mark
    this._buildScar(headGroup);

    // ── Hair
    this._buildHair(headGroup);

    // ── Ear
    [-0.22, 0.22].forEach(x => {
      const earGeo = new THREE.SphereGeometry(0.055, 14, 10);
      earGeo.scale(0.7, 1.0, 0.55);
      const ear = new THREE.Mesh(earGeo, this.mat.skin);
      ear.position.set(x, 0.20, 0.01);
      headGroup.add(ear);
    });

    // ── OWNDAYS Spectacles
    this._buildOwndaysGlasses(headGroup);
  }

  // ── High-detail eye assembly
  _buildEye(parent, xPos, yPos) {
    const zPos = 0.205;

    // Sclera (white)
    const scleraGeo = new THREE.SphereGeometry(0.052, 20, 16);
    const sclera = new THREE.Mesh(scleraGeo, this.mat.eyeWhite);
    sclera.position.set(xPos, yPos, zPos);
    sclera.scale.z = 0.72;
    parent.add(sclera);

    // Iris (colored)
    const irisGeo = new THREE.CircleGeometry(0.033, 20);
    const iris = new THREE.Mesh(irisGeo, this.mat.eyeIris);
    iris.position.set(xPos, yPos, zPos + 0.036);
    parent.add(iris);

    // Pupil
    const pupilGeo = new THREE.CircleGeometry(0.016, 14);
    const pupil = new THREE.Mesh(pupilGeo, this.mat.eyePupil);
    pupil.position.set(xPos, yPos, zPos + 0.0365);
    parent.add(pupil);

    // Catchlight (specular sparkle)
    const catchGeo = new THREE.CircleGeometry(0.007, 8);
    const catchlight = new THREE.Mesh(catchGeo, this.mat.eyeCatch);
    catchlight.position.set(xPos + 0.012, yPos + 0.012, zPos + 0.0375);
    parent.add(catchlight);

    // Upper eyelid crease
    const lidGeo = new THREE.SphereGeometry(0.055, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.40);
    const lid = new THREE.Mesh(lidGeo, this.mat.skin);
    lid.position.set(xPos, yPos + 0.004, zPos + 0.001);
    lid.scale.z = 0.72;
    parent.add(lid);
  }

  // ── Thin eyebrow arc
  _buildEyebrow(parent, xPos, yPos) {
    const browGeo = new THREE.TorusGeometry(0.04, 0.008, 6, 16, Math.PI * 0.65);
    const brow = new THREE.Mesh(browGeo, this.mat.eyebrow);
    brow.position.set(xPos, yPos, 0.207);
    brow.rotation.z = xPos > 0 ? -0.3 : 0.3;
    parent.add(brow);
  }

  // ── Tanjiro flame scar
  _buildScar(parent) {
    // Vertical scar line
    const scarLineGeo = new THREE.CylinderGeometry(0.013, 0.011, 0.11, 8);
    const scarLine = new THREE.Mesh(scarLineGeo, this.mat.scar);
    scarLine.position.set(-0.075, 0.285, 0.195);
    scarLine.rotation.z = 0.25;
    scarLine.rotation.x = 0.3;
    parent.add(scarLine);

    // Horizontal scar line
    const scarLine2 = new THREE.CylinderGeometry(0.011, 0.009, 0.055, 8);
    const sc2 = new THREE.Mesh(scarLine2, this.mat.scar);
    sc2.position.set(-0.065, 0.260, 0.197);
    sc2.rotation.z = Math.PI / 2 - 0.2;
    sc2.rotation.x = 0.3;
    parent.add(sc2);
  }

  // ── High-res layered hair
  _buildHair(parent) {
    const hairGroup = new THREE.Group();
    parent.add(hairGroup);
    this.joints.hair = hairGroup;

    // Cap base — slightly flattened sphere covering upper skull
    const capGeo = new THREE.SphereGeometry(0.23, 36, 24, 0, Math.PI * 2, 0, Math.PI * 0.65);
    const cap = new THREE.Mesh(capGeo, this.mat.hair);
    cap.position.y = 0.20;
    cap.scale.y = 1.05;
    hairGroup.add(cap);

    // Large main spikes — Tanjiro's characteristic unruly mop of hair
    const spikeConfigs = [
      { pos: [0, 0.42, 0.08], rot: [0.3, 0, 0], scale: [1, 1.4, 0.9] },
      { pos: [0.12, 0.44, 0.04], rot: [0.2, -0.4, 0.3], scale: [0.85, 1.2, 0.8] },
      { pos: [-0.12, 0.44, 0.04], rot: [0.2, 0.4, -0.3], scale: [0.85, 1.2, 0.8] },
      { pos: [0.18, 0.38, -0.04], rot: [0, -0.7, 0.4], scale: [0.8, 1.1, 0.8] },
      { pos: [-0.18, 0.38, -0.04], rot: [0, 0.7, -0.4], scale: [0.8, 1.1, 0.8] },
      { pos: [0.06, 0.40, -0.12], rot: [-0.3, -0.3, 0], scale: [0.75, 1.0, 0.75] },
      { pos: [-0.06, 0.40, -0.12], rot: [-0.3, 0.3, 0], scale: [0.75, 1.0, 0.75] },
      { pos: [0, 0.36, -0.18], rot: [-0.6, 0, 0], scale: [1.0, 0.9, 0.8] },
    ];

    spikeConfigs.forEach(({ pos, rot, scale }) => {
      const spikeGeo = new THREE.SphereGeometry(0.085, 14, 10);
      spikeGeo.scale(scale[0], scale[1], scale[2]);
      const spike = new THREE.Mesh(spikeGeo, this.mat.hair);
      spike.position.set(...pos);
      spike.rotation.set(...rot);
      hairGroup.add(spike);
    });

    // Side bangs framing face
    const bangConfigs = [
      { pos: [0.09, 0.34, 0.17], rot: [0.55, -0.3, 0.2], scale: [0.6, 1.4, 0.55] },
      { pos: [-0.09, 0.34, 0.17], rot: [0.55, 0.3, -0.2], scale: [0.6, 1.4, 0.55] },
      { pos: [0.05, 0.30, 0.20], rot: [0.7, -0.1, 0.1], scale: [0.5, 1.2, 0.5] },
      { pos: [-0.05, 0.30, 0.20], rot: [0.7, 0.1, -0.1], scale: [0.5, 1.2, 0.5] },
    ];

    bangConfigs.forEach(({ pos, rot, scale }) => {
      const bangGeo = new THREE.SphereGeometry(0.06, 12, 10);
      bangGeo.scale(scale[0], scale[1], scale[2]);
      const bang = new THREE.Mesh(bangGeo, this.mat.hair);
      bang.position.set(...pos);
      bang.rotation.set(...rot);
      hairGroup.add(bang);
    });

    // Ear-covering sideburns
    [-0.22, 0.22].forEach(x => {
      const sideburnGeo = new THREE.SphereGeometry(0.075, 12, 10);
      sideburnGeo.scale(0.75, 1.2, 0.6);
      const sideburn = new THREE.Mesh(sideburnGeo, this.mat.hair);
      sideburn.position.set(x, 0.22, -0.02);
      hairGroup.add(sideburn);
    });
  }

  // ── Smooth Arm with muscle definition
  _buildArm(parent, xOffset, side) {
    const arm = new THREE.Group();
    arm.position.set(xOffset, 0.56, 0);
    parent.add(arm);
    this.joints[side + 'Arm'] = arm;

    const isLeft = side === 'left';

    // Shoulder deltoid sphere
    const deltoidGeo = new THREE.SphereGeometry(0.11, 18, 14);
    deltoidGeo.scale(1.0, 0.85, 0.95);
    const deltoid = new THREE.Mesh(deltoidGeo, this.mat.uniform);
    deltoid.position.y = -0.05;
    arm.add(deltoid);

    // Upper arm — bicep taper
    const upperArmGeo = new THREE.CylinderGeometry(0.09, 0.075, 0.36, 18, 4);
    const upperArm = new THREE.Mesh(upperArmGeo, this.mat.uniform);
    upperArm.position.y = -0.23;
    upperArm.castShadow = true;
    arm.add(upperArm);

    // Elbow sphere
    const elbowGeo = new THREE.SphereGeometry(0.075, 14, 12);
    const elbow = new THREE.Mesh(elbowGeo, this.mat.uniform);
    elbow.position.y = -0.42;
    arm.add(elbow);

    // Forearm — wider at elbow, tapering to wrist
    const forearmGeo = new THREE.CylinderGeometry(0.07, 0.055, 0.34, 18, 4);
    const forearm = new THREE.Mesh(forearmGeo, this.mat.uniform);
    forearm.position.y = -0.60;
    forearm.castShadow = true;
    arm.add(forearm);

    // Wrist sphere
    const wristGeo = new THREE.SphereGeometry(0.055, 12, 10);
    const wrist = new THREE.Mesh(wristGeo, this.mat.skin);
    wrist.position.y = -0.775;
    arm.add(wrist);

    // Hand — palm
    const palmGeo = new THREE.SphereGeometry(0.058, 14, 12);
    palmGeo.scale(1.3, 0.75, 1.0);
    const palm = new THREE.Mesh(palmGeo, this.mat.skin);
    palm.position.y = -0.85;
    palm.castShadow = true;
    arm.add(palm);
    if (!isLeft) this.joints.rightHand = palm;

    // Fingers (4 + thumb, simplified)
    this._buildFingers(arm, isLeft);
  }

  // ── Simplified finger nubs
  _buildFingers(arm, isLeft) {
    const fingerOffsets = [
      [-0.03, -0.895, 0.02],
      [-0.01, -0.908, 0.025],
      [0.01, -0.908, 0.025],
      [0.03, -0.895, 0.02],
    ];
    fingerOffsets.forEach(([x, y, z]) => {
      const fGeo = new THREE.CylinderGeometry(0.012, 0.010, 0.038, 8);
      const finger = new THREE.Mesh(fGeo, this.mat.skin);
      finger.position.set(x, y, z);
      arm.add(finger);
    });

    // Thumb
    const thumbGeo = new THREE.SphereGeometry(0.018, 8, 8);
    const thumb = new THREE.Mesh(thumbGeo, this.mat.skin);
    thumb.position.set(isLeft ? 0.068 : -0.068, -0.862, 0.012);
    arm.add(thumb);
  }

  // ── Nichirin Katana — highly detailed blade
  _buildKatana() {
    const katana = new THREE.Group();
    this.joints.katanaGrp = katana;

    const rightHand = this.joints.rightHand;
    rightHand.add(katana);

    // Grip (tsuka) — wrapped handle with ridges
    for (let i = 0; i < 8; i++) {
      const wrapGeo = new THREE.CylinderGeometry(0.024 + (i % 2 === 0 ? 0.002 : 0), 0.024, 0.034, 12);
      const wrap = new THREE.Mesh(wrapGeo, i % 2 === 0 ? this.mat.katanaGrip : this.mat.belt);
      wrap.position.y = 0.02 + i * 0.034;
      katana.add(wrap);
    }

    // Pommel
    const pommelGeo = new THREE.SphereGeometry(0.028, 12, 10);
    pommelGeo.scale(1.0, 0.7, 1.0);
    const pommel = new THREE.Mesh(pommelGeo, this.mat.gold);
    pommel.position.y = 0.012;
    katana.add(pommel);

    // Tsuba (guard) — decorative hex shape
    const tsubaGeo = new THREE.CylinderGeometry(0.072, 0.072, 0.018, 6);
    const tsuba = new THREE.Mesh(tsubaGeo, this.mat.katanaTsuba);
    tsuba.position.y = 0.294;
    katana.add(tsuba);

    // Inner tsuba ring
    const innerRingGeo = new THREE.TorusGeometry(0.04, 0.007, 8, 20);
    const innerRing = new THREE.Mesh(innerRingGeo, this.mat.gold);
    innerRing.position.y = 0.294;
    innerRing.rotation.x = Math.PI / 2;
    katana.add(innerRing);

    // Blade — tapered high-poly with fuller groove
    const bladeGeo = new THREE.BoxGeometry(0.018, 1.15, 0.045, 2, 24, 4);
    const blade = new THREE.Mesh(bladeGeo, this.mat.katanaSteel);
    blade.position.set(0, 0.893, 0);
    blade.castShadow = true;
    katana.add(blade);

    // Blade tip — cone
    const tipGeo = new THREE.ConeGeometry(0.013, 0.09, 8);
    const bladeConv = new THREE.Mesh(tipGeo, this.mat.katanaSteel);
    bladeConv.position.set(0, 1.47, 0);
    katana.add(bladeConv);

    // Water-blue glowing edge (Nichirin glow)
    const glowGeo = new THREE.BoxGeometry(0.006, 1.15, 0.012, 1, 24, 2);
    const glowEdge = new THREE.Mesh(glowGeo, this.mat.bladeGlow);
    glowEdge.position.set(0, 0.893, 0.024);
    katana.add(glowEdge);
    this.joints.bladeEdge = glowEdge;
    this.joints.bladeGlowMat = this.mat.bladeGlow;

    // Sword tip reference
    const tipPoint = new THREE.Object3D();
    tipPoint.position.y = 1.56;
    katana.add(tipPoint);
    this.joints.swordTip = tipPoint;
  }

  // ── OWNDAYS Kimetsu 3D Spectacles
  _buildOwndaysGlasses(headGroup) {
    const glasses = new THREE.Group();
    glasses.position.set(0, 0.215, 0.197);
    headGroup.add(glasses);
    this.joints.glasses = glasses;

    // Frame rims — Boston panto oval
    [-0.082, 0.082].forEach(x => {
      const rimGeo = new THREE.TorusGeometry(0.056, 0.007, 10, 32);
      const rim = new THREE.Mesh(rimGeo, this.mat.glassFrame);
      rim.position.x = x;
      glasses.add(rim);

      const lensGeo = new THREE.CircleGeometry(0.052, 24);
      const lens = new THREE.Mesh(lensGeo, this.mat.glassLens);
      lens.position.set(x, 0, 0.004);
      glasses.add(lens);
    });

    // Nose bridge — narrow H-bridge
    const bridgeGeo = new THREE.CylinderGeometry(0.005, 0.005, 0.044, 8);
    const bridge = new THREE.Mesh(bridgeGeo, this.mat.glassFrame);
    bridge.rotation.z = Math.PI / 2;
    glasses.add(bridge);

    // Temple arms
    [-0.138, 0.138].forEach(x => {
      const templeGeo = new THREE.BoxGeometry(0.005, 0.007, 0.21);
      const temple = new THREE.Mesh(templeGeo, this.mat.glassAccent);
      temple.position.set(x, 0, -0.098);
      glasses.add(temple);

      // Gold emblem at temple tip
      const emblemGeo = new THREE.BoxGeometry(0.012, 0.012, 0.018);
      const emblem = new THREE.Mesh(emblemGeo, this.mat.gold);
      emblem.position.set(x, 0, -0.018);
      glasses.add(emblem);
    });
  }

  // ─────────────────────────────────────────────
  // 3. STYLE SWITCHING — OWNDAYS FRAMES
  // ─────────────────────────────────────────────
  toggleGlasses() {
    this.hasGlasses = !this.hasGlasses;
    this.joints.glasses.visible = this.hasGlasses;
    return this.hasGlasses;
  }

  setBreathingStyle(style) {
    this.breathingStyle = style;
    if (style === 'water') {
      this.mat.haori.color.setHex(0x0d7f7f);
      this.mat.bladeGlow.color.setHex(0x00e0ff);
      this.mat.bladeGlow.emissive.setHex(0x00c4e8);
      this.mat.glassAccent.color.setHex(0x00a8a8);
      this.mat.eyeIris.color.setHex(0xaa0000);
    } else if (style === 'flame') {
      this.mat.haori.color.setHex(0xb82000);
      this.mat.bladeGlow.color.setHex(0xff4400);
      this.mat.bladeGlow.emissive.setHex(0xdd2200);
      this.mat.glassAccent.color.setHex(0xff4500);
      this.mat.eyeIris.color.setHex(0xff4500);
    } else if (style === 'thunder') {
      this.mat.haori.color.setHex(0xd4a800);
      this.mat.bladeGlow.color.setHex(0xffee00);
      this.mat.bladeGlow.emissive.setHex(0xddcc00);
      this.mat.glassAccent.color.setHex(0xffee00);
      this.mat.eyeIris.color.setHex(0xffe600);
    }
  }

  setState(newState) {
    if (this.state === 'die') return;
    if (this.state !== newState) {
      this.state = newState;
      this.animTime = 0;
    }
  }

  // ─────────────────────────────────────────────
  // 4. ANIMATION UPDATE LOOP
  // ─────────────────────────────────────────────
  update(deltaTime, isMoving, moveDirection) {
    this.animTime += deltaTime;
    const t = this.animTime;

    const { torso, head, leftArm, rightArm, leftLeg, rightLeg, katanaGrp, haoriBack, haoriGroup } = this.joints;

    if (isMoving && this.state === 'idle') this.state = 'run';
    else if (!isMoving && this.state === 'run') this.state = 'idle';

    // ── Blade glow pulse
    if (this.mat.bladeGlow) {
      this.mat.bladeGlow.emissiveIntensity = 1.6 + Math.sin(t * 4) * 0.6;
    }

    // ── Cloth physics — soft wind sway on haori panels
    const windForce = Math.sin(t * 1.8) * 0.022 + Math.cos(t * 2.7) * 0.012;
    this.clothPanels.forEach((panel, i) => {
      this.clothVelocities[i] += windForce * 0.5;
      this.clothVelocities[i] *= 0.88;
      panel.rotation.x += this.clothVelocities[i];
      panel.rotation.x = Math.max(-0.18, Math.min(0.22, panel.rotation.x));
    });

    // ── State Animations
    if (this.state === 'idle') {
      const breathe = Math.sin(t * 2.2) * 0.025;
      torso.position.y = 0.18 + breathe;
      head.rotation.x = Math.sin(t * 2.2) * 0.018;
      head.rotation.y = Math.sin(t * 1.1) * 0.06;

      leftArm.rotation.x = Math.sin(t * 2.2) * 0.035;
      leftArm.rotation.z = 0.14;
      rightArm.rotation.x = -0.30 + Math.sin(t * 2.2) * 0.035;
      rightArm.rotation.z = -0.18;

      leftLeg.rotation.x = 0;
      rightLeg.rotation.x = 0;

    } else if (this.state === 'run') {
      const spd = 11;
      const legAngle = Math.sin(t * spd) * 0.72;
      leftLeg.rotation.x = legAngle;
      rightLeg.rotation.x = -legAngle;
      leftArm.rotation.x = -legAngle * 0.75;
      rightArm.rotation.x = legAngle * 0.75 - 0.32;
      torso.rotation.x = 0.18;
      torso.position.y = 0.18 + Math.abs(Math.sin(t * spd)) * 0.065;

      if (haoriBack) {
        haoriBack.rotation.x = 0.32 + Math.sin(t * spd) * 0.09;
      }

    } else if (this.state === 'slash') {
      const p = Math.min(t / 0.28, 1);
      if (p < 0.5) {
        rightArm.rotation.x = -1.9;
        rightArm.rotation.y = 0.9;
        rightArm.rotation.z = 0.55;
        torso.rotation.y = -0.55;
      } else {
        const s = (p - 0.5) * 2;
        rightArm.rotation.x = 0.2;
        rightArm.rotation.y = -1.1 * s;
        rightArm.rotation.z = -0.75 * s;
        torso.rotation.y = 0.75 * s;
      }
      if (t >= 0.32) this.setState('idle');

    } else if (this.state === 'waterSlash') {
      const p = Math.min(t / 0.5, 1);
      this.group.position.y = Math.sin(p * Math.PI) * 1.6;
      this.group.rotation.y += deltaTime * 11;
      rightArm.rotation.x = -1.6;
      rightArm.rotation.z = -1.1;
      if (t >= 0.5) {
        this.group.position.y = 0;
        this.setState('idle');
      }

    } else if (this.state === 'flameDash') {
      torso.rotation.x = 0.55;
      rightArm.rotation.x = -0.2;
      rightArm.rotation.y = 0;
      rightArm.rotation.z = 0;
      katanaGrp.rotation.x = 0;
      if (t >= 0.44) this.setState('idle');

    } else if (this.state === 'thunderFlash') {
      torso.rotation.x = 0.65;
      head.rotation.x = -0.4;
      rightArm.rotation.x = -0.55;
      rightArm.rotation.y = 0.6;
      if (t >= 0.38) this.setState('idle');

    } else if (this.state === 'block') {
      torso.rotation.y = -0.4;
      rightArm.rotation.x = -1.25;
      rightArm.rotation.y = 0.8;
      rightArm.rotation.z = 0.4;
      leftArm.rotation.x = -1.0;
      leftArm.rotation.y = -0.4;

    } else if (this.state === 'hurt') {
      const p = Math.min(t / 0.28, 1);
      torso.rotation.x = -0.4 * Math.sin(p * Math.PI);
      head.rotation.x = -0.5 * Math.sin(p * Math.PI);
      if (t >= 0.28) this.setState('idle');

    } else if (this.state === 'die') {
      const p = Math.min(t / 1.0, 1);
      this.group.rotation.z = (Math.PI / 2) * p;
      this.group.position.y = 0.3 * (1 - p);
    }
  }

  getKatanaTipPosition() {
    const tip = new THREE.Vector3();
    this.joints.swordTip.getWorldPosition(tip);
    return tip;
  }

  // ─────────────────────────────────────────────
  // 5. BLENDER OBJ EXPORT
  // ─────────────────────────────────────────────
  exportBlenderOBJ() {
    let objData = '# Demon Slayer High-Resolution OWNDAYS 3D Character (Blender Compatible)\n';
    let vertexCount = 1;
    this.group.traverse(child => {
      if (child.isMesh && child.visible) {
        const geo = child.geometry.clone();
        geo.applyMatrix4(child.matrixWorld);
        const posAttr = geo.attributes.position;
        const normAttr = geo.attributes.normal;
        if (posAttr) {
          objData += `o ${child.name || 'Mesh_' + child.id}\n`;
          for (let i = 0; i < posAttr.count; i++) {
            objData += `v ${posAttr.getX(i).toFixed(5)} ${posAttr.getY(i).toFixed(5)} ${posAttr.getZ(i).toFixed(5)}\n`;
          }
          if (normAttr) {
            for (let i = 0; i < normAttr.count; i++) {
              objData += `vn ${normAttr.getX(i).toFixed(5)} ${normAttr.getY(i).toFixed(5)} ${normAttr.getZ(i).toFixed(5)}\n`;
            }
          }
          if (geo.index) {
            const idx = geo.index;
            for (let i = 0; i < idx.count; i += 3) {
              const a = idx.getX(i) + vertexCount;
              const b = idx.getX(i + 1) + vertexCount;
              const c = idx.getX(i + 2) + vertexCount;
              objData += `f ${a}//${a} ${b}//${b} ${c}//${c}\n`;
            }
          } else {
            for (let i = 0; i < posAttr.count; i += 3) {
              objData += `f ${i + vertexCount} ${i + 1 + vertexCount} ${i + 2 + vertexCount}\n`;
            }
          }
          vertexCount += posAttr.count;
        }
      }
    });
    const blob = new Blob([objData], { type: 'text/plain' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `DemonSlayer_HR_OWNDAYS_${this.breathingStyle}.obj`;
    link.click();
  }
}
