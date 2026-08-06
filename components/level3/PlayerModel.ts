import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * PlayerModel
 * Reusable GLB model loader & AnimationMixer controller for player characters (player1.glb, player2.glb).
 */
export class PlayerModel {
  public scene: THREE.Scene;
  public group: THREE.Group;

  private mixer: THREE.AnimationMixer | null = null;
  private clips: Map<string, THREE.AnimationClip> = new Map();
  private semanticClips: Map<string, THREE.AnimationClip> = new Map();
  private currentAction: THREE.AnimationAction | null = null;
  private currentClipName: string = '';
  private isDisposed: boolean = false;

  public isReady: boolean = false;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.group = new THREE.Group();
  }

  /**
   * Load GLB model, configure scale (~2.6 height), ground feet on tatami (y = 0),
   * enable cast/receive shadows, and parse animation clips.
   */
  load(url: string, onReady?: () => void) {
    this.isDisposed = false;
    const loader = new GLTFLoader();

    loader.load(
      url,
      (gltf) => {
        if (this.isDisposed) {
          gltf.scene.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              if (child.geometry) child.geometry.dispose();
              if (child.material) {
                if (Array.isArray(child.material)) {
                  child.material.forEach((m) => {
                    if (m.map) m.map.dispose();
                    m.dispose();
                  });
                } else {
                  if (child.material.map) child.material.map.dispose();
                  child.material.dispose();
                }
              }
            }
          });
          return;
        }

        const model = gltf.scene;

        // ── 1. Scale: Standard Player Height (~2.6 world units)
        //    Measure BEFORE scaling to get original height
        const boxBefore = new THREE.Box3().setFromObject(model);
        const sizeBefore = boxBefore.getSize(new THREE.Vector3());
        const targetHeight = 2.6;
        const scale = targetHeight / Math.max(sizeBefore.y, 0.001);
        model.scale.setScalar(scale);

        // ── 2. Position: Recalculate bounding box AFTER scale is applied,
        //    then lift so the bottom of the model sits exactly at y = 0 (top of tatami).
        model.updateMatrixWorld(true);
        const boxAfter = new THREE.Box3().setFromObject(model);
        // Place model so its feet are at y=0
        model.position.y = -boxAfter.min.y;

        // ── 3. Rotation: Aligned with group forward direction
        model.rotation.y = 0;

        // ── 4. Shadows: Enable castShadow & receiveShadow on ALL meshes
        model.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });

        this.group.add(model);
        this.scene.add(this.group);

        // ── 5. Animations: Case-insensitive mapping for Idle, Walk/Run, Attack, Death
        if (gltf.animations && gltf.animations.length > 0) {
          this.mixer = new THREE.AnimationMixer(model);

          for (const clip of gltf.animations) {
            const name = clip.name.toLowerCase();
            this.clips.set(name, clip);

            if (name.includes('idle') || name.includes('stand') || name.includes('breath')) {
              if (!this.semanticClips.has('idle')) this.semanticClips.set('idle', clip);
            }
            if (name.includes('walk') || name.includes('run') || name.includes('move') || name.includes('chase')) {
              if (!this.semanticClips.has('walk')) this.semanticClips.set('walk', clip);
              if (!this.semanticClips.has('walking')) this.semanticClips.set('walking', clip);
              if (!this.semanticClips.has('run')) this.semanticClips.set('run', clip);
            }
            if (name.includes('attack') || name.includes('slash') || name.includes('hit') || name.includes('strike')) {
              if (!this.semanticClips.has('attack')) this.semanticClips.set('attack', clip);
            }
            if (name.includes('death') || name.includes('die') || name.includes('dead') || name.includes('defeat') || name.includes('down')) {
              if (!this.semanticClips.has('death')) this.semanticClips.set('death', clip);
            }
          }

          // Auto-play idle on spawn
          this.playAnimation('idle');
        }

        this.isReady = true;
        if (onReady) onReady();
      },
      undefined,
      (err) => {
        console.error(`[PlayerModel] Failed to load ${url}:`, err);
        // ── Fallback: render a colored capsule so the partner is always visible ──
        if (!this.isDisposed) {
          this.spawnFallbackMesh(url);
        }
      }
    );
  }

  /**
   * Spawn a simple capsule placeholder when the GLB can't be loaded.
   * Tinted differently per model URL so the two players are distinguishable.
   */
  private spawnFallbackMesh(url: string) {
    const isP2 = url.includes('player2');
    const color = isP2 ? 0x4488ff : 0xff6644;

    // Body
    const bodyGeo = new THREE.CapsuleGeometry(0.35, 1.4, 8, 16);
    const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.1 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 1.5; // centre of capsule above floor
    body.castShadow = true;
    body.receiveShadow = true;

    // Head
    const headGeo = new THREE.SphereGeometry(0.28, 12, 8);
    const headMat = new THREE.MeshStandardMaterial({ color, roughness: 0.5 });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 2.55;
    head.castShadow = true;

    this.group.add(body, head);
    this.scene.add(this.group);
    this.isReady = true;
    console.warn(`[PlayerModel] Using fallback mesh for ${url}`);
  }

  /**
   * Check if attack animation is currently playing non-looped
   */
  public isAttacking(): boolean {
    if (this.currentClipName === 'attack' && this.currentAction) {
      return this.currentAction.isRunning() && this.currentAction.time < (this.currentAction.getClip().duration - 0.1);
    }
    return false;
  }

  /**
   * Check if death animation is playing
   */
  public isDead(): boolean {
    return this.currentClipName === 'death';
  }

  /**
   * Play a named animation clip with smooth blending.
   * Supports: idle, walk, attack, death
   */
  playAnimation(name: string, loop: boolean = true) {
    if (!this.mixer || this.isDisposed) return;

    const key = name.toLowerCase();

    // Do not interrupt death
    if (this.currentClipName === 'death' && key !== 'death') return;

    // Do not interrupt ongoing attack animation unless playing attack or death
    if (this.isAttacking() && key !== 'attack' && key !== 'death') return;

    if (this.currentClipName === key && key !== 'attack') return; // already playing

    // Find clip by semantic mapping, exact name, or partial match
    let clip = this.semanticClips.get(key) || this.clips.get(key);

    if (!clip) {
      for (const [clipName, c] of this.clips.entries()) {
        if (clipName.includes(key)) {
          clip = c;
          break;
        }
      }
    }

    // Fallback to idle or first available clip
    if (!clip) {
      clip = this.semanticClips.get('idle') || Array.from(this.clips.values())[0];
    }

    if (!clip) return;

    const action = this.mixer.clipAction(clip);
    action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    action.clampWhenFinished = !loop;
    action.reset();

    if (this.currentAction && this.currentAction !== action) {
      this.currentAction.fadeOut(0.15);
    }

    action.fadeIn(0.15).play();
    this.currentAction = action;
    this.currentClipName = key;
  }

  /** Must be called every frame with deltaTime (seconds). */
  update(deltaTime: number) {
    if (this.mixer && !this.isDisposed) {
      this.mixer.update(deltaTime);
    }
  }

  /** Full GPU/RAM disposal and scene removal */
  dispose() {
    this.isDisposed = true;
    if (this.mixer) {
      this.mixer.stopAllAction();
      this.mixer.uncacheRoot(this.group);
      this.mixer = null;
    }
    this.group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((mat) => {
              if (mat.map) mat.map.dispose();
              mat.dispose();
            });
          } else {
            if (child.material.map) child.material.map.dispose();
            child.material.dispose();
          }
        }
      }
    });
    this.scene.remove(this.group);
    this.clips.clear();
    this.semanticClips.clear();
    this.currentAction = null;
  }
}
