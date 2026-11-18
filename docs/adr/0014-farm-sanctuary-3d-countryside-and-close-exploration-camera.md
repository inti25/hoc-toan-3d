# 0014. Farm Sanctuary 3D Countryside (`maps/farm/scene.gltf`) & Close Exploration Camera

Status: accepted (supersedes spatial scenery & camera sections of ADR 0012)

## Context

`FARM_SANCTUARY` previously constructed a flat 32 m circular meadow with a closed wooden pen (`pen_fence`) and `park_*` flora prefabs viewed under the fixed isometric overview camera (`distance = 48 m`, `pitch = 0.8 rad`). A richer 3D countryside farm asset (`public/3dmodel/maps/farm/scene.gltf`, *"moorhuhn kart 2 farm"*, CC-BY-4.0) was added alongside the existing `QHMJ_SANCTUARY` close-exploration camera style, while `farm.glb` still supplies the only rigged, animated farm animals and species shelters.

## Decision

1. **Dual-Asset Composition (`scene.gltf` + `farm.glb`)**:
   - Load `public/3dmodel/maps/farm/scene.gltf` as `map:farm_world` at `FARM_SCALE = 0.4` (shifted by `FARM_RAW_OFFSET = { x: -15, z: 55 }` so the playable track centers near `zone.center`, ~220 × 165 m). Keep its unlit materials (`KHR_materials_unlit`) and built-in blue-cloud sky dome (`unnamed.007_3`) intact.
   - Retain `public/3dmodel/maps/farm.glb` (`map:farm`) exclusively for the modular rigged animals (`FarmAnimalEntity`), species shelters (`coop`, `cow_shelter`, `pig_shelter`, `duck_shelter`, `dog_shelter`, troughs, hay bales), and harvest produce. Remove the obsolete flat ground discs, closed perimeter pen fence, and park flora/bush batches.
   - Place the open **Khu Chuồng Trại Trung Tâm** (`FARM_PEN_CENTER_LOCAL = { x: 72, y: 1.19, z: -36 }`), spawn point (`60, -36`), and return portal (`65, -24`) on the flat eastern meadow in front of the red barn and windmill.

2. **3D Walkable Terrain (`RoadSurface`) & Jumpable Fence Collisions (`FarmColliderGrid`)**:
   - Extract the ~9.9k ground triangles (dirt loop, cobblestone lane, pastures, wheat fields) into `RoadSurface` so both the player (`FARM_SPEED = 7.5 m/s`) and roaming animals conform to sloped terrain height `Y`.
   - Rasterize vertical/diagonal triangles of solid structures (barns, windmill, tree trunks) and low wooden fences (`Mesh_0289.rip.001_13`) into a 0.9 m spatial hash `FarmColliderGrid`, avoiding diagonal `Box3` bounding-box bloat and skipping overhead canopies/roofs above `groundY + 2.2 m`. Solid structures always block; low wooden fences block grounded walking (`y <= floorY + 0.55`) while permitting jumping over them.

3. **Localized Animal Anchors, Guidance Beacons & Hybrid Homeward Walk**:
   - Anchor unrescued animals at 18 geometry-verified scenic spots along the track and meadows, roaming locally within 6–10 m with overhead animated beacons (hidden upon rescue).
   - After celebrating, rescued animals walk over 3D terrain toward `FARM_PEN_ENTRY_LOCAL` and into their species shelter; if further than 35 m away, they cheer-run for 4.5 s and sparkle-warp to `FARM_PEN_ENTRY_LOCAL` before entering their shelter so long distances never stall completion.

4. **Shared Close Exploration Camera (**Góc Nhìn Khám Phá Gần**)**:
   - Generalize `World.ts`'s `inQhmjCamera` flag into `cameraMode: 'isometric' | 'qhmj' | 'farm'` sharing `fov = 58°`, `distance ∈ [0.35, 14]`, `pitch ∈ [-0.25, 0.85]`, avatar auto-hide below `1.1 m`, and `lerpSpeed = 22`. `FARM_SANCTUARY` defaults to `distance = 4.2 m`, `pitch = 0.22 rad`, `camera.far = 950`, and extended fog `(480, 1100)` so the sky dome renders cleanly.

5. **PWA Cache & Coordinate Compatibility**:
   - Add `globIgnores: ['**/3dmodel/**']` to `vite.config.ts` so the 34 texture PNGs under `public/3dmodel/maps/farm/textures/` are runtime-cached on demand rather than precached at initial page load.
   - Recommend `(400, 400)` with `220 × 165` in `scripts/buildCodeGs.ts`, `apps-script/Code.gs`, and `src/data/seedData.json` for new zones, while preserving compatibility with legacy sheets (e.g., `(0, 80)`) via `activeRegionId`-prioritized isolation in `SpatialWorld`.

## Consequences

- `FARM_SANCTUARY` gains full 3D countryside exploration with zero duplication of `RoadSurface` or camera input logic across QHMJ and Farm.
- Existing legacy `FARM_SANCTUARY` rows in Google Sheets keep working without breaking Starter Village boundaries, though updating `CenterX = 400, CenterZ = 400, Width = 220, Depth = 165` is recommended for clean `Saved Adventure Coordinates` across reloads.
- Attribution for *"moorhuhn kart 2 farm"* (CC-BY-4.0) by `amogusstrikesback2` must remain preserved in `README.md` and `public/3dmodel/maps/farm/license.txt`.
