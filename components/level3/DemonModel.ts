import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * DemonModel
 * Loads demon.glb and manages its AnimationMixer.
 * Designed to be a drop-in visual representation for the boss demon.
 */
export class DemonModel {
  public scene: THREE.Scene;
  /** Root group — used for position, lookAt, scene.add/remove */
  public group: THREE.Group;
  /** Dummy torso Object3D for backward compatibility */
  public torso: THREE.Object3D;

  private mixer: THREE.AnimationMixer | null = null;
  private clips: Map<string, THREE.AnimationClip> = new Map();
  private semanticClips: Map<string, THREE.AnimationClip> = new Map();
  private currentAction: THREE.AnimationAction | null = null;
  private currentClipName: string = '';
  private isDisposed: boolean = false;

  /** True once the GLB has finished loading */
  public isReady: boolean = false;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    // Dummy torso: not rendered, only used for position.y bookkeeping
    this.torso = new THREE.Object3D();
    this.torso.position.y = 1.8;
  }

  /**
   * Load demon.glb, configure transforms, enable shadows, wire animations.
   * Calls onReady() when the model is fully set up and added to the scene.
   */
  load(url: string, onReady?: () => void) {
    this.isDisposed = false;
    const loader = new GLTFLoader();
    loader.load(
      url,
      (gltf) => {
        // If dispose() was called while GLB was loading async, clean up immediately
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

        // ── 1. Scale: Boss / Enemy Size (target height ~3.6 units, dominant & intimidating)
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const targetHeight = 3.6; // Large boss scale
        const scale = targetHeight / Math.max(size.y, 0.001);
        model.scale.setScalar(scale);

        // ── 2. Position: Feet grounded properly on tatami floor (y = 0)
        const scaledBox = new THREE.Box3().setFromObject(model);
        model.position.y = -scaledBox.min.y;

        // ── 3. Rotation: Model aligned with group forward direction (0 offset)
        model.rotation.y = 0;

        // ── 4. Shadows: Enable castShadow & receiveShadow on ALL meshes
        model.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });

        // ── 5. Animations: Parse and map all clip names
        if (gltf.animations && gltf.animations.length > 0) {
          this.mixer = new THREE.AnimationMixer(model);

          console.log(`[DemonModel] Loaded clips for ${url}:`, gltf.animations.map(a => a.name));

          for (const clip of gltf.animations) {
            const name = clip.name.toLowerCase();
            this.clips.set(name, clip);

            if (name.includes('idle') || name.includes('stand') || name.includes('breath') || name.includes('stay') || name.includes('default')) {
              if (!this.semanticClips.has('idle')) this.semanticClips.set('idle', clip);
            }
            if (name.includes('walk') || name.includes('run') || name.includes('chase') || name.includes('move') || name.includes('step') || name.includes('locomotion')) {
              if (!this.semanticClips.has('walk')) this.semanticClips.set('walk', clip);
              if (!this.semanticClips.has('walking')) this.semanticClips.set('walking', clip);
              if (!this.semanticClips.has('run')) this.semanticClips.set('run', clip);
            }
            if (name.includes('attack') || name.includes('slash') || name.includes('hit') || name.includes('strike') || name.includes('swing') || name.includes('combo')) {
              if (!this.semanticClips.has('attack')) this.semanticClips.set('attack', clip);
            }
            if (name.includes('death') || name.includes('die') || name.includes('dead') || name.includes('defeat') || name.includes('down') || name.includes('fall')) {
              if (!this.semanticClips.has('death')) this.semanticClips.set('death', clip);
            }
          }

          // Pre-play idle on spawn & tick mixer frame 0 BEFORE adding model to scene to guarantee ZERO T-pose frames
          this.playAnimation('idle');
          this.mixer.update(0);
        }

        this.group.add(model);
        this.scene.add(this.group);

        this.isReady = true;
        if (onReady) onReady();
      },
      undefined,
      (err) => {
        console.error('[DemonModel] Failed to load demon.glb:', err);
      }
    );
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
   * Play a named animation clip (case-insensitive).
   * Supports: idle, walk/walking/run, attack, death
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

    // Fallback to idle or first available clip if not found
    if (!clip) {
      clip = this.semanticClips.get('idle') || Array.from(this.clips.values())[0];
    }

    if (!clip) return;

    const action = this.mixer.clipAction(clip);
    action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    action.clampWhenFinished = !loop;
    action.timeScale = 1.35; // 1.35x speed multiplier for fast & responsive animations
    action.reset();

    if (this.currentAction && this.currentAction !== action) {
      this.currentAction.fadeOut(0.12);
    }

    action.fadeIn(0.12).play();
    this.currentAction = action;
    this.currentClipName = key;
  }

  /** Get duration of death animation clip if present, or fallback 1.2s */
  public getDeathDuration(): number {
    const clip = this.semanticClips.get('death') || this.clips.get('death');
    return clip ? clip.duration : 1.2;
  }

  /** Must be called every frame with deltaTime (seconds). */
  update(deltaTime: number) {
    if (this.mixer && !this.isDisposed) {
      this.mixer.update(deltaTime);
    }
  }

  /** Complete removal from scene and full GPU/RAM resource disposal */
  dispose() {
    this.isDisposed = true;
    if (this.mixer) {
      this.mixer.stopAllAction();
      this.mixer.uncacheRoot(this.group);
      this.mixer = null;
    }
    this.group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        if (child.geometry) {
          child.geometry.dispose();
        }
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
