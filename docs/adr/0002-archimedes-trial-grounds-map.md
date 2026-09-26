# 0002. Archimedes Trial Grounds Map Architecture

Context: Integrating 40 advanced Grade 2 math problems (Archimedes Review Topic 15) into the 3D kingdom risked either a sprawling set of one-off interactive minigames or a detached 2D quiz list that bypasses spatial gameplay.

Decision: 
1. **Continuous 3D Spatial Realm**: Extend the 3D kingdom seamlessly from the Ancient Portal at the eastern edge of the Flower Garden (`x: 35`) into the Archimedes Plateau (`x: 40..215`, `z: -70..+50`). The realm features 5 Thematic Zone Sanctuaries (`Ốc Đảo Chuyên Đề`) connected by ancient stone trails and a central orientation compass monument.
2. **Physical Knowledge Monoliths (`Bia Đá Tri Thức`)**: Model each of the 40 problems as an interactive 3D obelisk monolith with a mossy carved stone pedestal, inscribed problem number plaque, and a floating Rune Crystal Beacon (`Tinh Thể Phong Ấn`). Monoliths transition from dormant grey to radiant zone-colored illumination and celestial light beams upon completion.
3. **Dual Exploration & Fast-Travel Interaction**: Support both physical in-world approach (proximity detection `< 2.9m`, in-world raycasting click) and instant coordinates teleportation from the Trial Map HUD dialog.
4. **Decoupled Architecture**: Maintain headless validation via `SpatialWorld.nearMonolithIndex()` and static domain typing in `archimedesTrialMap.ts`, keeping the 3D rendering in `World.ts` decoupled from session evaluation logic in `ChallengeSession`.

Consequences:
- The 3D world remains continuous with zero loading screens, expanding the game's sense of wonder and spatial continuity.
- All 40 trial stations are statically verifiable and headless-tested in Node without Three.js mocks.
- Performance remains high (~160 low-poly meshes using shared materials, well within 60fps budget on mobile/tablets).

