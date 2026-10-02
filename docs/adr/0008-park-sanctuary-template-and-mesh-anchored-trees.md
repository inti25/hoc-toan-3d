# 0008. Park Sanctuary Template & Mesh-Anchored Knowledge Trees

## Context
Previous zone templates (`FLOWER_BEDS`, `CIRCLE_SANCTUARY`, `GRID_SANCTUARY`) rely on procedurally generated geometry primitives (stone pillars and flower meshes) spawned at mathematically calculated coordinates. With the addition of the 3D model `park.glb` as a park template (`PARK_SANCTUARY`), we need a template mechanism where learning entities (questions and challenges) are anchored directly to authored 3D model meshes (`Tree` and `Pine`), with visual feedback (grayscale sleep vs vibrant awakening) reflecting student mastery.

Furthermore, teachers need the flexibility to configure `PARK_SANCTUARY` zones at arbitrary coordinates or omit them entirely. A fixed physical bridge from Starter Village restricts map expansion and cannot adapt if multiple park zones or custom island positions are set in Google Sheets `CONFIG`.

## Decision
1. **Dynamic Sheets-Driven Loading (No Bundled Fallback)**:
   - `PARK_SANCTUARY` is excluded from static bundled fallback data (`getBundledFallbackData()`).
   - If Google Sheets `CONFIG` (or its cache) does not declare a `PARK_SANCTUARY` zone, the 3D model `park.glb`, its portals, obstacles, and trees do not spawn in the scene, saving WebGL memory and initial load time.
   - `seedData.json` retains the sample Zone 7 and its 20 multiplication/division problems so teachers can push it to Google Sheets on demand via `seedRemoteDatabase()`.
2. **Starter Village Park Portal (Decoupled from Archimedes Gatehouse)**:
   - Rather than connecting from Archimedes Gatehouse ($X = 60, Z = 0$) or using a fixed wooden bridge, `PARK_SANCTUARY` connects directly to the western edge of Starter Village ($X = -19.5, Z = 0$) using a single dedicated Starter Village Park Portal.
   - If a single `PARK_SANCTUARY` zone is configured, walking into the portal teleports directly to that park's entrance ($z.center.x + 11.5, z.center.z$).
   - If multiple `PARK_SANCTUARY` zones are configured in Google Sheets `CONFIG`, stepping into the portal opens an interactive park destination picker dialog, allowing students to select their destination.
   - The park return portal ($z.center.x + 14, z.center.z$) teleports the student back to the front of the village portal ($X = -17.5, Z = 0$).
   - Archimedes Gatehouse ($X = 60, Z = 0$) is completely decoupled and does not spawn any portals or meshes leading to `PARK_SANCTUARY`.
   - The HUD `travel` button when inside any park zone returns the player directly to Starter Village ($X = -6, Z = 5$).
3. **Zone Identity Driven by Sheets CONFIG**:
   - The zone name, badge, color, center coordinates, and `sheetName` are bound dynamically to the record in `CONFIG`, rather than hardcoding "Công Viên Xanh" or "CongVienXanh".
4. **Mesh-Anchored Entity Mapping**:
   - Scan the 20 authored tree meshes in `park.glb` (11 `Pine` and 9 `Tree` meshes).
   - Order the trees in a clockwise arc starting from the entrance and assign them to question indices 0 through 19.
5. **Isolated Material Grayscale & Awakening**:
   - Because all meshes in `park.glb` share a single texture palette material instance, modifying `child.material` globally would desaturate the entire island.
   - Clone dedicated `MeshStandardMaterial` instances for the 20 tree meshes, assigning a stony gray tone (`0x7a8288`) when dormant.
   - When a student solves a tree's math challenge:
     - Restore the original vibrant texture palette material.
     - Spawn a celebratory burst particle effect (`world.burst`) at the tree crown.
     - Deactivate the floating overhead guide beacon.
6. **Progress Persistence & Reset**:
   - Store awakened states in `AdventureState.parkTrees: boolean[]` and sync with `SaveState` / LocalStorage.
   - Progress reset reverts awakened trees back to dormant grayscale.

## Consequences
- WebGL resources and network bandwidth are conserved when the park template is not enabled.
- Fully decoupled spatial topology: `PARK_SANCTUARY` can be placed anywhere or instantiated without breaking village bridges.
- Seamless authoring experience through Google Sheets `CONFIG`.
