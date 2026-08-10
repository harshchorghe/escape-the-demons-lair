import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

export interface CachedGLTF {
  scene: THREE.Group;
  animations: THREE.AnimationClip[];
}

class ModelCacheManager {
  private loader: GLTFLoader | null = null;
  private cache = new Map<string, CachedGLTF>();
  private loadingPromises = new Map<string, Promise<CachedGLTF>>();

  private getLoader(): GLTFLoader {
    if (!this.loader) {
      this.loader = new GLTFLoader();
    }
    return this.loader;
  }

  /**
   * Preload a list of GLTF asset URLs silently in the background
   */
  public async preload(urls: string[]) {
    if (typeof window === 'undefined') return;
    const promises = urls.map((url) => this.loadGLTF(url).catch(() => null));
    await Promise.all(promises);
  }

  /**
   * Load and cache GLTF data
   */
  public loadGLTF(url: string): Promise<CachedGLTF> {
    if (this.cache.has(url)) {
      return Promise.resolve(this.cache.get(url)!);
    }

    if (this.loadingPromises.has(url)) {
      return this.loadingPromises.get(url)!;
    }

    const promise = new Promise<CachedGLTF>((resolve, reject) => {
      this.getLoader().load(
        url,
        (gltf) => {
          const data: CachedGLTF = {
            scene: gltf.scene,
            animations: gltf.animations || [],
          };
          this.cache.set(url, data);
          this.loadingPromises.delete(url);
          resolve(data);
        },
        undefined,
        (err) => {
          this.loadingPromises.delete(url);
          reject(err);
        }
      );
    });

    this.loadingPromises.set(url, promise);
    return promise;
  }

  /**
   * Get a deep cloned instance of a cached GLTF scene and its animation clips
   */
  public getCloned(url: string): CachedGLTF | null {
    const cached = this.cache.get(url);
    if (!cached) return null;

    const clonedScene = SkeletonUtils.clone(cached.scene) as THREE.Group;
    return {
      scene: clonedScene,
      animations: cached.animations,
    };
  }
}

export const modelCache = new ModelCacheManager();
