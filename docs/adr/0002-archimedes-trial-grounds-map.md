# 0002. Archimedes Trial Grounds Map Architecture

Context: Integrating 40 advanced Grade 2 math problems (Archimedes Review Topic 15) into a single sprawling continuous terrain caused the landscape to feel too vast and sparse compared to the compact, cozy, and vibrant aesthetic of the Flower Garden (`Vườn Hoa Tri Thức`).

Decision: 
1. **Archipelago of 5 Compact Sanctuaries (`Ốc Đảo Chuyên Đề`)**: Restructure the Archimedes realm into a constellation of 5 dedicated, cozy islands (each roughly `24m x 32m`, identical in scale and intimate aesthetic to the Flower Garden). Each island features thematic terrain, lush foliage, lanterns, stone pathways, and its respective Knowledge Monoliths (`Bia Đá Tri Thức`).
2. **Archimedes Gatehouse Hub (`Đền Cổng Archimedes`)**: A central floating stone plaza (`x: 60, z: 0`, `22m x 22m`) housing a return portal to the Flower Garden and 5 color-coded celestial portal arches leading directly to the 5 Sanctuaries.
3. **Walk-Through Portal Transit**: Stepping into any portal arch triggers seamless teleportation with a burst of stardust sparks without loading screens, allowing children to effortlessly navigate between the Hub and Sanctuaries.
4. **Physical Knowledge Monoliths**: 40 interactive 3D obelisk monoliths arranged in tight, easily navigable garden formations (3m–4m apart) around each zone's monument, with floating Rune Crystal Beacons and sky beams upon activation.
5. **Dual Exploration & Fast-Travel Interaction**: Full walk-through exploration via portals combined with instant HUD-based fast-travel from the Trial Map modal.
6. **Decoupled Architecture**: Spatial bounding and portal transit logic remain purely headless and testable in `SpatialWorld.ts`, with 3D visuals rendered in `World.ts`.

Consequences:
- Each zone feels as cozy, lively, and beautifully detailed as the Flower Garden, eliminating long, tedious running distances.
- Children can freely choose which math topic to practice by walking into its colored portal at the Gatehouse.
- All 40 trial stations are statically verifiable and headless-tested in Node.
- Frame rates remain silky-smooth at 60fps across desktop and mobile devices.


