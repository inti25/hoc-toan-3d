# 0007. Saved Player Coordinates and Deferred Spawn Architecture

## Context
"Vương Quốc Học Toán 3D" features an expansive 3D world encompassing Starter Village, Friendship Bridge, Knowledge Flower Garden, Archimedes Gatehouse, and 5 Thematic Zone Sanctuaries.
Previously, every browser reload or return visit reset the player's position back to the initial spawn point in Starter Village `(-6, 0, 6)`. For students progressing through distant sanctuaries (such as Sanctuary 4 or 5 at coordinates $X \approx 150-190$), restarting at the village required traversing or teleporting back each time.
However, automatically restoring coordinates introduces several challenges:
1. **Asynchronous Island Generation**: The 5 Archimedes Sanctuaries and custom zones from Google Sheets load asynchronously via network or cache. If a player spawns at $(150, 60)$ before the 3D meshes are built, the character would fall through the void.
2. **I/O Throttling**: Saving coordinates to `localStorage` on every frame (60fps) creates main-thread I/O bottlenecks and frame drops.
3. **Bridge Progression Integrity**: If saved coordinates were across the river in Flower Garden or Archimedes realm, but progression data was corrupted or reset, the player could get stuck.

## Decision
1. **Saved Adventure Coordinates in `SaveState`**:
   - Extend `SaveState` with an optional `position?: { x: number; z: number }`.
   - Coordinates are rounded to 2 decimal places (`~1 cm` precision) during serialization to minimize payload size and avoid floating-point drift.
   - For new players (`started: false`), coordinates default to `(-6, 0, 6)`.
   - Resetting progress (`resetProgress`) clears the saved coordinates and teleports the player back to `(-6, 0, 6)`.

2. **Debounced & Event-Driven Auto-Save**:
   - Implement a 1-second debounce after movement stops: while the player is running, no disk writes occur. Once movement ceases for 1 second, the current $(X, Z)$ is committed to `SaveState`.
   - Immediately commit coordinates on discrete spatial events:
     - Portal transit (`checkPortalTransit`).
     - Map dialog teleportation.
     - Completing a question/challenge session.
     - Page lifecycle transitions (`visibilitychange` / `beforeunload`).

3. **Deferred Spawn Safety Fallback**:
   - On startup, evaluate whether the saved coordinates fall within the currently active land boundary `spatial.isWithinLand(x, z)`.
   - If the coordinates are currently valid (e.g. Starter Village or Flower Garden with completed bridge), spawn the player directly at $(X, Z)$ and snap the camera to standard follow distance.
   - If the coordinates belong to a remote sanctuary that has not yet finished loading, temporarily position the player at Starter Village `(-6, 0, 6)`.
   - Once dynamic zones are generated (`syncDynamicContent`), check if deferred coordinates are waiting. If valid, teleport the player seamlessly to the saved sanctuary coordinates with a celebratory burst effect.

## Consequences
- Students seamlessly resume their adventures at the exact spot they left off.
- Zero main-thread frame drops during continuous locomotion.
- Robust prevention of void-falling when network latency delays procedural island generation.
- Full compatibility with existing progression, reset flows, and offline PWA caching.
