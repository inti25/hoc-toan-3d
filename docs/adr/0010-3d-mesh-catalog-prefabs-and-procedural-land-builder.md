# 0010. 3D Mesh Catalog, Standalone Prefabs & Procedural Land Builder

## Context
Previously, creating educational learning zones required either procedural geometry primitives (`CIRCLE_SANCTUARY`, `GRID_SANCTUARY`) or static monolithic 3D scenes (`park.glb`, `cozy_lake.glb`). The monolithic approach presented three major architectural bottlenecks:
1. **Asset Inflexibility & Lock-in**: Meshes like trees, benches, rocks, and lanterns bundled inside monolithic GLB files could not be reused to compose new custom islands.
2. **Authoring Friction**: Adding a new multiplication/division island required full 3D modeling authoring in external DCC tools (e.g. Blender) followed by manual code changes in the game engine.
3. **PWA Mobile Resource Constraints**: Monolithic GLB scenes (up to 15 MB) overload network bandwidth and mobile GPU VRAM on student devices.

We required an automated pipeline that can scan arbitrary 3D model repositories, catalog metadata and bounding boxes, slice meshes into standalone lightweight prefabs with baked bottom pivots, and allow dynamic, data-driven procedural generation of custom 3D islands configured via Google Sheets.

## Decision

1. **Dual-Phase Offline Extraction via `@gltf-transform`**:
   - Built a headless Node.js CLI toolchain using `@gltf-transform/core`, `@gltf-transform/extensions`, and `@gltf-transform/functions` without headless browser or Three.js runtime dependencies.
   - **Phase 1 (`npm run scan:models`)**: Scans all `.glb` files in `public/3dmodel/`, classifies meshes into 6 semantic categories (`TERRAIN`, `FOLIAGE`, `PROP`, `OBSTACLE`, `CHARACTER`, `ENVIRONMENT`), calculates precise axis-aligned bounding boxes (AABB), and outputs structured metadata to `public/data/meshCatalog.json`.
   - **Phase 2 (`npm run slice:prefabs`)**: Slices individual meshes into standalone `.glb` files under `public/3dmodel/prefabs/`. Each prefab bakes world transforms and normal matrices, and offsets vertex coordinates such that the pivot origin rests at the base ($Y = 0$, $X = 0, Z = 0$). Unused textures, materials, and buffer views are pruned, producing lightweight assets (20–80 KB each).

2. **Client-Side Lazy Loading & VRAM Sharing (`PrefabCatalog` & `AssetRepository`)**:
   - Introduced `PrefabCatalog` singleton as the authoritative registry for sliced prefabs.
   - Extended `AssetRepository` to support `prefab:*` keys with on-demand async loading, Geometry/Material deep cloning (sharing GPU buffers across identical props), and low-poly procedural fallback placeholders to safeguard against network dropouts.
   - `instantiatePrefab()` automatically attaches physics obstacle descriptors based on catalog bounding radii.

3. **Data-Driven Procedural Island Template (`PROCEDURAL_SANCTUARY`)**:
   - Expanded Google Sheets `ZONES` schema with `template = PROCEDURAL_SANCTUARY`, alongside customizable parameters `theme` (`FOREST`, `GARDEN`, `RUINS`, `VILLAGE`) and `decorDensity` (`LOW`, `MEDIUM`, `HIGH`).
   - Implemented `ProceduralLandBuilder`:
     - Generates PBR terrain disc meshes with top grass plate, bedrock cliff base, and sandy perimeter rims.
     - Spawns two-way teleportation portals connecting to the Archimedes trial nexus.
     - Places Knowledge Monoliths dynamically along an elliptical arc.
     - Employs a deterministic Linear Congruential Generator (LCG PRNG) seeded by `zone.id` to scatter theme-specific prefabs reproducibly.
     - Enforces strict keep-out zones: portal perimeter ($\ge 3.5\text{m}$), monolith interaction areas ($\ge 2.2\text{m}$), and prop-to-prop clearances ($\ge 2.5\text{m}$).

## Consequences

### Positive
- **Zero-Code Island Creation**: Teachers and curriculum designers can author entirely new 3D floating learning sanctuaries simply by adding a row in Google Sheets `ZONES` and assigning multiplication problems in `PROBLEMS`.
- **Minimal Bandwidth & Memory**: Client loads only the specific prefabs needed for the active zone, downloading tens of kilobytes instead of megabyte-heavy full scenes.
- **Deterministic Reproducibility**: Seeded PRNG ensures terrain layout and foliage placement remain identical every time a student revisits a sanctuary.
- **Robustness**: Offline-first design with built-in low-poly fallbacks prevents WebGL crashes when assets are missing or during spotty network connections.

### Negative / Trade-offs
- Build pipeline requires running `npm run scan:models` and `npm run slice:prefabs` when new raw 3D models are introduced to the repository.
- Sliced prefabs retain the source model's texture palette; cross-model material unification is handled via PBR shading rather than texture atlasing.
