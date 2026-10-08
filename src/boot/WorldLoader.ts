import type { World } from '../world/World';
import type { WorldLaunchOptions, WorldLoaderSeam } from './types';

export class WorldLoader implements WorldLoaderSeam {
  private modulePromise: Promise<typeof import('../world/World')> | null = null;
  private _isLoaded = false;
  private _isLoading = false;

  get isLoaded(): boolean {
    return this._isLoaded;
  }

  get isLoading(): boolean {
    return this._isLoading;
  }

  /**
   * Preloads the 3D Engine chunk in the background without blocking the main UI thread.
   */
  preload(): Promise<void> {
    if (this._isLoaded && this.modulePromise) {
      return Promise.resolve();
    }

    if (!this.modulePromise) {
      this._isLoading = true;
      this.modulePromise = import('../world/World')
        .then((m) => {
          this._isLoaded = true;
          this._isLoading = false;
          return m;
        })
        .catch((err) => {
          // Reset so subsequent attempts can retry
          this.modulePromise = null;
          this._isLoaded = false;
          this._isLoading = false;
          throw err;
        });
    }

    return this.modulePromise.then(() => undefined);
  }

  /**
   * Instantiates and configures the World engine once the chunk is ready.
   */
  async launch(options: WorldLaunchOptions): Promise<World> {
    await this.preload();
    const { World } = await this.modulePromise!;

    const world = new World(options.canvas);

    // Initial state wiring
    world.setBridge(options.bridge);
    world.setFlowersBloomed(options.flowers);
    world.setMonolithsActivated(options.monolithChecker);
    world.setAvatar(options.avatar);
    world.syncAwakenedParkTrees(options.parkTrees);
    if (world.setFarmRescued) world.setFarmRescued(options.farmRescued);
    if (options.equippedTrail) world.setEquippedTrail(options.equippedTrail);

    // Callbacks
    if (options.onTeleport) world.onTeleport = options.onTeleport;
    if (options.onJump) world.onJump = options.onJump;
    if (options.onSceneClick) world.onSceneClick = options.onSceneClick;
    if (options.onFlowerClick) world.onFlowerClick = options.onFlowerClick;
    if (options.onMonolithClick) world.onMonolithClick = options.onMonolithClick;
    if (options.onParkTreeClick) world.onParkTreeClick = options.onParkTreeClick;
    if (options.onPortalClick) world.onPortalClick = options.onPortalClick;
    if (options.onShopClick) world.onShopClick = options.onShopClick;
    if (options.onFarmAnimalClick) world.onFarmAnimalClick = options.onFarmAnimalClick;
    if (options.onFrame) world.onFrame = options.onFrame;

    // Initial position
    if (options.initialPosition) {
      const safe = world.spatial.resolveSafeSpawn(options.initialPosition.x, options.initialPosition.z);
      if (safe) {
        world.setInitialPosition(safe.x, safe.z);
        if (safe.x !== options.initialPosition.x || safe.z !== options.initialPosition.z) {
          options.onTeleport?.(safe.x, safe.z);
        }
      }
    }

    return world;
  }
}
