# 0009. Cozy Lake Terrain for GRID and CIRCLE Sanctuaries

> **Status: Accepted.** Hoàn thành thay thế địa hình các vùng đất GRID_SANCTUARY và CIRCLE_SANCTUARY bằng mô hình Cozy Lake (`public/3dmodel/maps/cozy_lake.glb`) với vành bờ cát đi được (`13.5m <= r <= 18.0m`), cổng teleport ở phía Tây (`r = 15.75m`), bố cục bia đá trên vành (`r = 14.4m`), và bảo tồn các công trình trung tâm trên mặt hồ.

## Context
The five Archimedes sanctuary islands (zones 1–5) were box-shaped islands hardcoded in five places: the island list in `World.ts`, the walkable rectangles in `SpatialWorld.isWithinLand`, per-island centerpieces, monolith coordinates in `archimedesTrialMap.ts`, and the return portals in `ArchimedesZoneBuilder`. `GRID_SANCTUARY` and `CIRCLE_SANCTUARY` only decided where monoliths sit. We want these zones to use the authored model `public/3dmodel/maps/cozy_lake.glb`.

## Decision
1. **Scope**: Every zone with template `GRID_SANCTUARY` or `CIRCLE_SANCTUARY` (the five hardcoded sanctuaries and any dynamic zone with id > 6) uses the Cozy Lake Terrain. `FLOWER_BEDS` and `PARK_SANCTUARY` are unchanged.
2. **Template semantics**: Template ids and the Sheets `Template` column stay unchanged. Both templates share the terrain and differ only in monolith layout (two rows vs ring), still computed procedurally by `computeProceduralEntityPositions`. Unlike `PARK_SANCTUARY` (ADR 0008), entities are not anchored to model meshes.
3. **Single source of truth**: Zone centers and ids stay as they are. One shared "lake land" descriptor (center, radius, scale, anchors) feeds the terrain, `isWithinLand`, monolith positions, and the return portal. The remaining hardcoded rectangles, coordinates, and ad-hoc positions are removed.
4. **Sizing**: The lake is uniformly scaled so its circular land area matches the old island footprint (~768 m², radius ≈ 15.6 m). `width`/`depth` from Sheets still spread the layout but never distort the lake.
5. **Clean-up**: Clouds and stray far-away nodes in the `.glb` are removed on load. Decorative props (trees, stones, mushrooms) within a safety radius of monoliths, the centerpiece, or portals are hidden instead of moving the monoliths, so GRID/CIRCLE keep their shape.
6. **Identity**: The terrain is never tinted. The zone color shows through portals, monolith glow, and the centerpiece. The existing themed centerpiece stays at the lake center.
7. **Portals**: Only return portals move onto the lake, on its west side about 3 m inside the shore. Outbound portals stay at Archimedes Gatehouse. Positions are in world coordinates, so the lake's per-zone rotation does not matter.
8. **Elevation and water**: Sand/dirt surface sits at y = 0 so `floorHeight` is unchanged. The water disc and shore are scenery only, with no swimming or sinking. Walkable bounds are a circle shrunk slightly inside the shore (as in the park), and props are registered as obstacles.
9. **Loading**: The `.glb` is fetched once at startup and cloned per zone. The old box island shows until the lake is ready. If loading fails, the box island stays and the game still works, because movement rules live in code and not in the mesh.

## Consequences
- Five hardcoded places shrink to one descriptor, so adding another zone no longer needs hand-edited rectangles.
- Zone terrain looks identical across zones. Per-zone color is the only visual differentiator.
- Hiding props near monoliths keeps layouts predictable but leaves small clearings in the scenery.
- Existing saved coordinates (ADR 0007) inside the old rectangles may land outside the lake's circular land. Deferred Spawn must clamp or fall back to the zone's return portal.
