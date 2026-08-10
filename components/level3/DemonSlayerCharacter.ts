import * as THREE from 'three';
import { PlayerModel } from './PlayerModel';

export interface JointsMap {
  root: THREE.Group;
  hips: THREE.Group;
  torso: THREE.Group;
  head: THREE.Group;
  neck?: THREE.Mesh;
  leftLeg?: THREE.Group;
  rightLeg?: THREE.Group;
  leftArm?: THREE.Group;
  rightArm?: THREE.Group;
  rightHand?: THREE.Mesh;
  katanaGrp?: THREE.Group;
  bladeEdge?: THREE.Mesh;
  bladeGlowMat?: THREE.MeshStandardMaterial;
  swordTip?: THREE.Object3D;
  hair?: THREE.Group;
  haoriGroup?: THREE.Group;
  haoriBack?: THREE.Mesh;
}

export class DemonSlayerCharacter {
  public scene: THREE.Scene;
  public group: THREE.Group;
  public state: string = 'idle';
  public animTime: number = 0;
  public joints: JointsMap = {} as JointsMap;
  public mat: Record<string, THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial> = {};
  public playerModel: PlayerModel;

  constructor(scene: THREE.Scene, modelUrl: string = '/models/player1.glb') {
    this.scene = scene;
    this.playerModel = new PlayerModel(this.scene);
    this.playerModel.load(modelUrl);
    this.group = this.playerModel.group;

    // Create dummy joints and swordTip node for backward compatibility
    const dummyGroup = new THREE.Group();
    const swordTip = new THREE.Object3D();
    swordTip.position.set(0, 1.2, 0.8);
    this.group.add(swordTip);

    this.joints = {
      root: this.group,
      hips: dummyGroup,
      torso: dummyGroup,
      head: dummyGroup,
      swordTip: swordTip,
    };
  }

  setState(newState: string) {
    if (this.state !== newState) {
      this.state = newState;
      this.animTime = 0;
    }
  }

  /** Smoothly rotate character toward a 3D target position (used when attacking) */
  faceTarget(targetPos: THREE.Vector3) {
    const charPos = this.group.position;
    const dx = targetPos.x - charPos.x;
    const dz = targetPos.z - charPos.z;
    if (dx * dx + dz * dz > 0.001) {
      this.group.rotation.y = Math.atan2(dx, dz);
    }
  }

  update(deltaTime: number, isMoving: boolean = false, moveDir?: THREE.Vector3) {
    this.animTime += deltaTime;

    // Tick GLB animation mixer
    this.playerModel.update(deltaTime);

    // ── Animation Priority Hierarchy: Death -> Attack -> Walk -> Idle ──
    if (this.state === 'die') {
      this.playerModel.playAnimation('death', false);
      const deathDuration = this.playerModel.getDeathDuration();

      // After death animation completes, sink model & hide/remove from scene
      if (this.animTime >= deathDuration) {
        this.group.position.y = Math.max(-3.0, this.group.position.y - deltaTime * 2.0);
        if (this.animTime >= deathDuration + 0.5) {
          this.group.visible = false;
          if (this.group.parent) {
            this.group.parent.remove(this.group);
          }
        }
      }
      return;
    }

    const isAttackState = this.state === 'slash';

    if (isAttackState) {
      this.playerModel.playAnimation('attack', false);

      // Auto-return to idle/walk when attack action duration completes
      const attackDuration = 0.45;
      if (this.animTime >= attackDuration) {
        this.setState('idle');
      }
    } else if (isMoving) {
      this.playerModel.playAnimation('walk');
    } else if (this.state === 'hurt') {
      if (this.animTime >= 0.3) {
        this.setState('idle');
      }
      if (!this.playerModel.isAttacking()) {
        this.playerModel.playAnimation(isMoving ? 'walk' : 'idle');
      }
    } else {
      // Idle default
      this.playerModel.playAnimation('idle');
    }
  }

  getKatanaTipPosition(): THREE.Vector3 {
    const tip = new THREE.Vector3();
    if (this.joints.swordTip) {
      this.joints.swordTip.getWorldPosition(tip);
    } else {
      tip.copy(this.group.position);
    }
    return tip;
  }

  dispose() {
    this.playerModel.dispose();
  }
}
