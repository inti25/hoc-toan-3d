# 0008. Park Sanctuary Template & Mesh-Anchored Knowledge Trees

## Context
Previous zone templates (`FLOWER_BEDS`, `CIRCLE_SANCTUARY`, `GRID_SANCTUARY`) rely on procedurally generated geometry primitives (stone pillars and flower meshes) spawned at mathematically calculated coordinates. With the addition of the 3D model `park.glb` (Công Viên Xanh) to expand the world westward from Starter Village, we need a template mechanism where learning entities (questions and challenges) are anchored directly to authored 3D model meshes (`Tree` and `Pine`), with visual feedback (grayscale sleep vs vibrant awakening) reflecting student mastery.

## Decision
1. **PARK_SANCTUARY Zone Template**:
   - Extend `ZoneTemplateType` with `'PARK_SANCTUARY'`.
   - Register Công Viên Xanh in the Kingdom's `CONFIG` sheet as Zone 7 (`sheetName: 'CongVienXanh'`, `template: 'PARK_SANCTUARY'`, `badge: '🌳'`).
2. **Mesh-Anchored Entity Mapping**:
   - Scan the 20 authored tree meshes in `park.glb` (11 `Pine` and 9 `Tree` meshes).
   - Order the trees in a clockwise arc starting from the eastern bridge entrance ($X = -27$) and assign them to question indices 0 through 19.
   - For procedural fallback and telemetry, `computeProceduralEntityPositions` derives coordinates directly from the tree anchor positions.
3. **Isolated Material Grayscale & Awakening**:
   - Because all meshes in `park.glb` share a single texture palette material instance, modifying `child.material` globally would desaturate the entire island.
   - Clone dedicated `MeshStandardMaterial` instances for the 20 tree meshes, assigning a stony gray tone (`0x7a8288`) when dormant.
   - When a student solves a tree's math challenge:
     - Restore the original vibrant texture palette material.
     - Spawn a celebratory burst particle effect (`world.burst`) at the tree crown.
     - Deactivate the floating overhead guide beacon.
4. **Interactive Proximity & Challenge Flow**:
   - Spatial proximity detection triggers within a $2.5\text{m}$ radius around each tree trunk.
   - HUD prompts: `⚡ Cây Tri Thức #X: (Bấm E để giải bài)` (or `🌳 Cây Tri Thức #X (Đã thức tỉnh - Xem lại)`).
   - Pressing **E** or tapping the action button opens `ChallengeDialog`.
5. **Progress Persistence**:
   - Store awakened states in `AdventureState.parkTrees: boolean[]` and sync with `SaveState` / LocalStorage.
   - Synchronize completion logs with Google Sheets through the unified `solvedProblemIds` pipeline.
   - On page reload, awakened trees restore their vibrant green materials immediately.

## Consequences
- Transforms static imported 3D scenery models into rich, interactive learning environments.
- Material cloning isolates grayscale effects specifically to tree foliage without affecting benches, lamps, or terrain.
- Seamlessly fits into the existing Google Sheets question authoring and progress reporting infrastructure.
