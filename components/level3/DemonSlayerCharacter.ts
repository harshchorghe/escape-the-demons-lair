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
  glasses?: THREE.Group;
  hair?: THREE.Group;
  haoriGroup?: THREE.Group;
  haoriBack?: THREE.Mesh;
}

export class DemonSlayerCharacter {
  public scene: THREE.Scene;
  public group: THREE.Group;
  public state: string = 'idle';
  public animTime: number = 0;
  public breathingStyle: string = 'water';
  public hasGlasses: boolean = true;
  public joints: JointsMap = {} as JointsMap;
  public clothPanels: THREE.Mesh[] = [];
  public clothVelocities: number[] = [];
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

  setBreathingStyle(style: string) {
    this.breathingStyle = style;
  }

  toggleGlasses(): boolean {
    this.hasGlasses = !this.hasGlasses;
    return this.hasGlasses;
  }

  setState(newState: string) {
    if (this.state !== newState) {
      this.state = newState;
      this.animTime = 0;
    }
  }

  update(deltaTime: number, isMoving: boolean = false, moveDir?: THREE.Vector3) {
    this.animTime += deltaTime;

    // Tick GLB animation mixer
    this.playerModel.update(deltaTime);

    // ── Keyboard & Combat State → GLB Animation Mapping ─────────────────
    if (this.state === 'die') {
      this.playerModel.playAnimation('death', false);
      return;
    }

    const isAttackState =
      this.state === 'slash' ||
      this.state === 'waterSlash' ||
      this.state === 'flameDash' ||
      this.state === 'thunderFlash';

    if (isAttackState) {
      this.playerModel.playAnimation('attack', false);

      // Auto-return to idle/walk when attack action duration completes
      const attackDuration = 0.45;
      if (this.animTime >= attackDuration) {
        this.setState('idle');
      }
    } else if (this.state === 'block' || this.state === 'hurt') {
      if (this.state === 'hurt' && this.animTime >= 0.3) {
        this.setState('idle');
      }
      if (!this.playerModel.isAttacking()) {
        this.playerModel.playAnimation(isMoving ? 'walk' : 'idle');
      }
    } else {
      // Standard Movement: Walk if moving keys are held, Idle if standing still
      if (isMoving) {
        this.playerModel.playAnimation('walk');
      } else {
        this.playerModel.playAnimation('idle');
      }
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

  exportBlenderOBJ() {
    if (typeof document === 'undefined') return;
    let objData = '# Demon Slayer OWNDAYS 3D Player Character (.OBJ)\n';
    let vertexCount = 1;
    this.group.traverse((child) => {
      if ((child as THREE.Mesh).isMesh && child.visible) {
        const mesh = child as THREE.Mesh;
        const geo = mesh.geometry.clone();
        geo.applyMatrix4(mesh.matrixWorld);
        const posAttr = geo.attributes.position as THREE.BufferAttribute;
        if (posAttr) {
          objData += `o ${mesh.name || 'Mesh_' + mesh.id}\n`;
          for (let i = 0; i < posAttr.count; i++) {
            objData += `v ${posAttr.getX(i).toFixed(5)} ${posAttr.getY(i).toFixed(5)} ${posAttr.getZ(i).toFixed(5)}\n`;
          }
          if (geo.index) {
            const idx = geo.index;
            for (let i = 0; i < idx.count; i += 3) {
              const a = idx.getX(i) + vertexCount;
              const b = idx.getX(i + 1) + vertexCount;
              const c = idx.getX(i + 2) + vertexCount;
              objData += `f ${a}//${a} ${b}//${b} ${c}//${c}\n`;
            }
          }
          vertexCount += posAttr.count;
        }
      }
    });
    const blob = new Blob([objData], { type: 'text/plain' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Player_${this.breathingStyle}.obj`;
    link.click();
  }
}
