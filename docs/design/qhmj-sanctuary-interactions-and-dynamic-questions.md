# Nghiên Cứu Chuyên Sâu: Ý Tưởng Tương Tác & Cơ Chế Tạo Câu Hỏi Động Cho `QHMJ_SANCTUARY` (`map_qhmj.glb`)

> **Trạng thái:** Tài liệu nghiên cứu & thiết kế Pha 2 — dựa trực tiếp trên mã nguồn hiện tại của repo và dữ liệu trích xuất từ `public/3dmodel/maps/map_qhmj.glb`.  
> **Phạm vi đối chiếu:** `sheetsClient.ts`, `buildCodeGs.ts`, `adventure.ts`, `WorldSession.ts`, `remoteTypes.ts`, `seedData.json`, `World.ts`, `SpatialWorld.ts`, `FarmSanctuary.ts`, `ArchimedesZoneBuilder.ts`, `HudPresenter.ts`, `ChallengeDialog.ts`, `main.ts`, các module `src/world/qhmj/*`, và các ADR `0008`, `0012`, `0013`.

---

## Phần 1: Phân Tích Đối Chiếu Cơ Chế Tạo Câu Hỏi Động & Tương Tác Hiện Tại

### 1.1. Đường ống dữ liệu câu hỏi từ Google Sheets / Apps Script đến Client

Hệ thống hiện tại dùng mô hình **Headless CMS trên Google Sheets + Google Apps Script** kết hợp **Cache 30 phút (Stale-While-Revalidate)** và **Procedural Fallback** tùy từng template:

1. **Tầng lưu trữ & API Google Apps Script ([`scripts/buildCodeGs.ts`](file:///d:/github/hoc-toan-3d/scripts/buildCodeGs.ts#L19-L44), [`apps-script/README.md`](file:///d:/github/hoc-toan-3d/apps-script/README.md#L54-L88)):**
   - Sheet `CONFIG` gồm 17 cột (`CONFIG_HEADERS`): `ZoneId`, `Name`, `Title`, `Description`, `Template`, `Theme`, `DecorDensity`, `SheetName`, `CenterX`, `CenterZ`, `Width`, `Depth`, `ColorHex`, `Badge`, `Active`, `StartAt`, `QuestionCount` ([`scripts/buildCodeGs.ts#L20-L24`](file:///d:/github/hoc-toan-3d/scripts/buildCodeGs.ts#L20-L24)).
   - Mỗi vùng đất trỏ tới một tab câu hỏi riêng qua `SheetName`, chuẩn hóa theo 16 cột (`QUEST_HEADERS`): `ProblemId`, `StepId`, `Title`, `Subtitle`, `Prompt`, `ImageUrl`, `OptionA..D`, `Answer`, `Hints`, `Explanation`, `ExplanationImageUrl`, `PosX`, `PosZ` ([`scripts/buildCodeGs.ts#L27-L31`](file:///d:/github/hoc-toan-3d/scripts/buildCodeGs.ts#L27-L31)).
   - `fetchQuestionsFromSheet()` tự động gom nhiều dòng liên tiếp có cùng `ProblemId` (kể cả khi giáo viên để trống `ProblemId` ở các dòng bước sau, kế thừa `lastProbId` theo ADR 0013) thành một `RemoteProblem` chứa mảng `steps[]` ([`scripts/buildCodeGs.ts#L694-L761`](file:///d:/github/hoc-toan-3d/scripts/buildCodeGs.ts#L694-L761), [`docs/adr/0013-standardized-multi-step-challenges.md#L11-L12`](file:///d:/github/hoc-toan-3d/docs/adr/0013-standardized-multi-step-challenges.md#L11-L12)).
   - `ZONE_TEMPLATES` trong Apps Script hiện cung cấp **6 bản mẫu** để giáo viên tạo vùng đất mới tự sinh câu hỏi cửu chương qua menu `🎮 Vương Quốc 3D ➔ ➕ Tạo Vùng Đất Mới...` ([`scripts/buildCodeGs.ts#L155-L166`](file:///d:/github/hoc-toan-3d/scripts/buildCodeGs.ts#L155-L166), [`#L532-L575`](file:///d:/github/hoc-toan-3d/scripts/buildCodeGs.ts#L532-L575)): `GRID_SANCTUARY`, `CIRCLE_SANCTUARY`, `FLOWER_BEDS`, `PARK_SANCTUARY`, `PROCEDURAL_SANCTUARY`, `FARM_SANCTUARY` — **chưa có `QHMJ_SANCTUARY`**.
   - Ngoài ra, [`src/data/seedData.json`](file:///d:/github/hoc-toan-3d/src/data/seedData.json#L136-L154) đã khai báo mẫu Zone 8 (`template: "QHMJ_SANCTUARY"`, `sheetName: "QHMJ_Map"`, `center: { x: -400, z: -400 }`, `width: 152`, `depth: 109`), nhưng trong `questionsBySheet` chưa có khóa `"QHMJ_Map"` ([`src/data/seedData.json#L156-L3195`](file:///d:/github/hoc-toan-3d/src/data/seedData.json#L156-L3195)).

2. **Tầng nạp, làm sạch & phân bổ tọa độ Client ([`src/core/sheetsClient.ts`](file:///d:/github/hoc-toan-3d/src/core/sheetsClient.ts)):**
   - `loadZonesAndQuestions()` ([`sheetsClient.ts#L267-L311`](file:///d:/github/hoc-toan-3d/src/core/sheetsClient.ts#L267-L311)) dùng cache `localStorage` (`REMOTE_CACHE_KEY`, TTL `30 phút`), trả cache ngay và ngầm gọi `fetchRemoteData()` theo chiến lược Stale-While-Revalidate; khi chưa có cache và chưa gọi được mạng thì trả về `getBundledFallbackData()` rỗng (`{ zones: [], questionsBySheet: {} }`, [`sheetsClient.ts#L132-L137`](file:///d:/github/hoc-toan-3d/src/core/sheetsClient.ts#L132-L137)).
   - `sanitizeRemoteZones()` ([`sheetsClient.ts#L361-L407`](file:///d:/github/hoc-toan-3d/src/core/sheetsClient.ts#L361-L407)) đã nhận diện hợp lệ `'QHMJ_SANCTUARY'` ([`#L384`](file:///d:/github/hoc-toan-3d/src/core/sheetsClient.ts#L384)), lọc `Active` và `StartAt` qua `isZoneVisible()` ([`#L352-L356`](file:///d:/github/hoc-toan-3d/src/core/sheetsClient.ts#L352-L356)).
   - `sanitizeRemoteProblems()` ([`sheetsClient.ts#L143-L258`](file:///d:/github/hoc-toan-3d/src/core/sheetsClient.ts#L143-L258)) chuẩn hóa câu hỏi, khôi phục lỗi công thức `#ERROR!` thành `'='`, tách `Hints` theo `|` hoặc `;`, trích ảnh Markdown `![...](url)`. Lưu ý: `RemoteProblem.position` hiện chỉ lưu `{ x: number; z: number } | null` ([`src/data/remoteTypes.ts#L17-L27`](file:///d:/github/hoc-toan-3d/src/data/remoteTypes.ts#L17-L27)).
   - `resolveZoneProblemsWithPositions()` ([`sheetsClient.ts#L496-L531`](file:///d:/github/hoc-toan-3d/src/core/sheetsClient.ts#L496-L531)) gọi `computeProceduralEntityPositions()` và `sanitizeZoneEntityPosition()` ([`src/data/remoteTypes.ts#L175-L311`](file:///d:/github/hoc-toan-3d/src/data/remoteTypes.ts#L175-L311)). Trong đó, `sanitizeZoneEntityPosition()` bỏ qua việc ép khung hình chữ nhật/tròn đối với `PARK_SANCTUARY`, `FARM_SANCTUARY`, và `QHMJ_SANCTUARY` ([`remoteTypes.ts#L181-L183`](file:///d:/github/hoc-toan-3d/src/data/remoteTypes.ts#L181-L183)), nhưng `computeProceduralEntityPositions()` hiện chưa có `case 'QHMJ_SANCTUARY'` (nếu gọi sẽ rơi xuống `default: FLOWER_BEDS`).

3. **Tầng điều phối vòng đời vùng đất ([`src/boot/WorldSession.ts`](file:///d:/github/hoc-toan-3d/src/boot/WorldSession.ts)):**
   - `classifyZoneTemplate()` ([`WorldSession.ts#L23-L37`](file:///d:/github/hoc-toan-3d/src/boot/WorldSession.ts#L23-L37)) phân loại 5 nhánh: `'flower' | 'park' | 'farm' | 'qhmj' | 'monolith'`.
   - `zoneSpawnsMonoliths()` chỉ trả `true` cho `'monolith'` (`GRID_SANCTUARY`, `CIRCLE_SANCTUARY`, `PROCEDURAL_SANCTUARY`) ([`WorldSession.ts#L39-L41`](file:///d:/github/hoc-toan-3d/src/boot/WorldSession.ts#L39-L41)).
   - `zoneCountsForBadges()` hiện trả `kind !== 'flower' && kind !== 'qhmj'` — chú thích rõ Pha 1 tạm loại `qhmj` khỏi tổng huy hiệu vì chưa có thử thách ([`WorldSession.ts#L43-L47`](file:///d:/github/hoc-toan-3d/src/boot/WorldSession.ts#L43-L47)).
   - `applyRemotePayload()` nạp các vùng hiển thị, tính `_monolithProblems`, `_badgeZones`, gọi `adventure.reconcileZoneProgress()`, và đẩy vào `world.renderDynamicZones(...)` ([`WorldSession.ts#L194-L229`](file:///d:/github/hoc-toan-3d/src/boot/WorldSession.ts#L194-L229), [`#L302-L326`](file:///d:/github/hoc-toan-3d/src/boot/WorldSession.ts#L302-L326)).

### 1.2. Bảng đối chiếu cơ chế tương tác & render câu hỏi ở các zone hiện có

| Khía cạnh | **Monolith (`GRID` / `CIRCLE` / `PROCEDURAL`)** | **Flower (`FLOWER_BEDS`)** | **Park (`PARK_SANCTUARY`)** | **Farm (`FARM_SANCTUARY`)** |
| :--- | :--- | :--- | :--- | :--- |
| **Thực thể 3D & Neo vị trí** | Bia đá dựng từ primitive (`ArchimedesZoneBuilder.createMonolithEntity`) trên vành đảo `cozy_lake.glb` hoặc đảo `ProceduralLandBuilder` ([`ArchimedesZoneBuilder.ts#L272-L343`](file:///d:/github/hoc-toan-3d/src/world/ArchimedesZoneBuilder.ts#L272-L343), [`World.ts#L1059-L1079`](file:///d:/github/hoc-toan-3d/src/world/World.ts#L1059-L1079)). | 10 cây hoa cố định tại `FLOWER_COORDS` trong Vườn Hoa ([`SpatialWorld.ts#L84-L87`](file:///d:/github/hoc-toan-3d/src/world/SpatialWorld.ts#L84-L87), [`World.ts#L803-L876`](file:///d:/github/hoc-toan-3d/src/world/World.ts#L803-L876)). | Neo trực tiếp vào 20 mesh `Tree`/`Pine` trong `park.glb`, sắp theo góc từ lối vào Đông ([`World.ts#L1822-L1924`](file:///d:/github/hoc-toan-3d/src/world/World.ts#L1822-L1924), [ADR 0008](file:///d:/github/hoc-toan-3d/docs/adr/0008-park-sanctuary-template-and-mesh-anchored-trees.md)). | 10+ con vật module từ `farm.glb` đi tuần (`ROAMING`) ngoài đồng cỏ bán kính `9.5–25m`, giải cứu xong đi vào chuồng (`HOMEWARD` → `RESTING`) ([`FarmSanctuary.ts#L514-L579`](file:///d:/github/hoc-toan-3d/src/world/farm/FarmSanctuary.ts#L514-L579), [ADR 0012](file:///d:/github/hoc-toan-3d/docs/adr/0012-farm-sanctuary-template-and-roaming-animal-rescue.md)). |
| **Nguồn câu hỏi** | Google Sheets (`questionsBySheet[z.sheetName]`), fallback `createArchimedesChallenge` placeholder ([`ChallengeDialog.ts#L1487-L1557`](file:///d:/github/hoc-toan-3d/src/quiz/ChallengeDialog.ts#L1487-L1557)). | Sheets `VuonHoa`, fallback `FLOWER_QUESTIONS` ([`ChallengeDialog.ts#L557-L610`](file:///d:/github/hoc-toan-3d/src/quiz/ChallengeDialog.ts#L557-L610)). | Chỉ từ Sheets (`remoteParkProblems`); cây dư không có câu hỏi giữ màu xanh gốc, không có beacon ([`World.ts#L1879-L1903`](file:///d:/github/hoc-toan-3d/src/world/World.ts#L1879-L1903), [`main.ts#L666-L675`](file:///d:/github/hoc-toan-3d/src/main.ts#L666-L675)). | Ưu tiên Sheets `questionsBySheet[z.sheetName]`, fallback tự sinh `generateFarmMultiplicationProblem(index, kind)` ([`FarmSanctuary.ts#L581-L588`](file:///d:/github/hoc-toan-3d/src/world/farm/FarmSanctuary.ts#L581-L588), [`adventure.ts#L667-L723`](file:///d:/github/hoc-toan-3d/src/core/adventure.ts#L667-L723)). |
| **Phát hiện tương tác (Proximity & Click)** | Proximity 2D `< 2.9m` (`nearMonolithIndex()`) + click chiếu xuống mặt phẳng `y=0` (`scratchRayPlane`) ([`SpatialWorld.ts#L591-L609`](file:///d:/github/hoc-toan-3d/src/world/SpatialWorld.ts#L591-L609), [`World.ts#L2077-L2117`](file:///d:/github/hoc-toan-3d/src/world/World.ts#L2077-L2117)). | Proximity 2D `< 2.9m` (`nearFlowerIndex()`) + click mặt phẳng `y=0` ([`SpatialWorld.ts#L581-L589`](file:///d:/github/hoc-toan-3d/src/world/SpatialWorld.ts#L581-L589), [`World.ts#L2096-L2106`](file:///d:/github/hoc-toan-3d/src/world/World.ts#L2096-L2106)). | Proximity 2D `<= 2.8m` (`nearParkTreeIndex()`) + click mặt phẳng `y=0` ([`SpatialWorld.ts#L267-L275`](file:///d:/github/hoc-toan-3d/src/world/SpatialWorld.ts#L267-L275), [`World.ts#L2118-L2130`](file:///d:/github/hoc-toan-3d/src/world/World.ts#L2118-L2130)). | **Raycaster 3D trực tiếp lên mesh** (`findAnimalAtRay`) + fallback mặt phẳng `y=0` + proximity 2D động theo vị trí hiện tại `< 3.5m` ([`FarmSanctuary.ts#L618-L655`](file:///d:/github/hoc-toan-3d/src/world/farm/FarmSanctuary.ts#L618-L655), [`World.ts#L2069-L2087`](file:///d:/github/hoc-toan-3d/src/world/World.ts#L2069-L2087), [`#L2340-L2353`](file:///d:/github/hoc-toan-3d/src/world/World.ts#L2340-L2353)). |
| **Luồng HUD & Dialog** | `WorldFrameSnapshot.nearMonolithIndex` → `HudPresenter` hiện `#interact` (`E`) → `ChallengeDialog.startChallenge({ type: 'archimedes' })`. Hỗ trợ nhiều bước, numpad/multi-slot/so sánh/trắc nghiệm ([`ChallengeDialog.ts#L1463-L1818`](file:///d:/github/hoc-toan-3d/src/quiz/ChallengeDialog.ts#L1463-L1818)). | `nearFlowerIndex` → `#interact` → `ChallengeDialog.startChallenge({ type: 'flower' })`. Hỗ trợ nhiều bước (ADR 0013) ([`ChallengeDialog.ts#L557-L857`](file:///d:/github/hoc-toan-3d/src/quiz/ChallengeDialog.ts#L557-L857)). | `nearParkTreeIndex` → `#interact` → `ChallengeDialog.startChallenge({ type: 'park_tree' })`. Hỗ trợ nhiều bước ([`ChallengeDialog.ts#L862-L1175`](file:///d:/github/hoc-toan-3d/src/quiz/ChallengeDialog.ts#L862-L1175)). | `nearFarmAnimalId` → `#interact` → `ChallengeDialog.startChallenge({ type: 'farm_animal' })`. Hỗ trợ cả schema `RemoteProblem` (`steps`) lẫn schema legacy `Problem`/`Options`/`Answer` ([`ChallengeDialog.ts#L1180-L1458`](file:///d:/github/hoc-toan-3d/src/quiz/ChallengeDialog.ts#L1180-L1458)). |
| **Phản hồi 3D & Lưu tiến độ** | Tinh thể đổi màu + cột sáng + burst; lưu `state.monoliths[]`, `state.solvedProblems[id]`, `state.zoneBadges[zoneId - 1]` (chỉ `1..5` trong [`adventure.ts#L468`](file:///d:/github/hoc-toan-3d/src/core/adventure.ts#L468)). | Nụ nở thành hoa xoay + burst; lưu `state.flowers[i]` & `solvedProblems`. | Vật liệu cây chuyển từ xám `0x7a8288` sang màu tươi + tắt beacon + burst; lưu `state.parkTrees[i]` & `solvedProblems` ([`adventure.ts#L280-L338`](file:///d:/github/hoc-toan-3d/src/core/adventure.ts#L280-L338)). | Thú ăn mừng → chạy về chuồng + thưởng nông sản vào `state.inventory`; lưu `state.farmRescued[animalId]` ([`adventure.ts#L626-L643`](file:///d:/github/hoc-toan-3d/src/core/adventure.ts#L626-L643), [`main.ts#L740-L756`](file:///d:/github/hoc-toan-3d/src/main.ts#L740-L756)). |

**Rút ra quy chuẩn tương thích cho `QHMJ_SANCTUARY`:**
- **Chuẩn câu hỏi thống nhất:** Mọi câu hỏi mới (kể cả procedural fallback) nên trả về đúng định dạng `RemoteProblem` (`id`, `title`, `subtitle`, `badge`, `color`, `steps: RemoteStep[]`) để dùng trọn vẹn bộ `parseAnswer()` (`numeric`, `comparison`, `multi`, `choice`), gợi ý phân tầng, ảnh minh họa, và stepper đa bước theo [ADR 0013](file:///d:/github/hoc-toan-3d/docs/adr/0013-standardized-multi-step-challenges.md).
- **Cô lập Scene (Region Isolation):** `World.ensureZoneRegionLoaded()` đã nạp lười `buildQhmjRegion()` vào `Region_Zone_{id}` và chỉ mount khi người chơi dịch chuyển tới ([`World.ts#L1111-L1120`](file:///d:/github/hoc-toan-3d/src/world/World.ts#L1111-L1120), [`docs/design/zone-scene-isolation-and-portal-loading.md`](file:///d:/github/hoc-toan-3d/docs/design/zone-scene-isolation-and-portal-loading.md)). Các thực thể tương tác của QHMJ phải gắn vào `zoneGroup` đó (không gắn trực tiếp vào `this.scene`) để tự động unmount khi rời vùng.
- **Hai điểm cần mở rộng từ kiến trúc hiện tại:** (1) `World.interactAtScreen()` dùng `scratchRayPlane` (`y = 0`) cho hầu hết đối tượng tĩnh — sẽ sai lệch hoàn toàn ở QHMJ nơi đường nằm ở `y ∈ [0.27, 29.26]`, bắt buộc phải raycast 3D vào mesh/hitbox như `FarmSanctuary.findAnimalAtRay()`; (2) `Adventure.activateMonolith()` và `reconcileZoneProgress()` hiện giới hạn `zoneId >= 1 && zoneId <= 5` cho `zoneBadges` ([`adventure.ts#L468`](file:///d:/github/hoc-toan-3d/src/core/adventure.ts#L468), [`#L527`](file:///d:/github/hoc-toan-3d/src/core/adventure.ts#L527)), cần tổng quát hóa theo `badgeZones` để zone 8+ (như QHMJ) nhận huy hiệu bình thường.

---

## Phần 2: Bản Đồ Ngữ Nghĩa & Các Điểm Tương Tác Tiềm Năng Trong `map_qhmj.glb`

Kết quả phân tích trực tiếp tệp nhị phân [`public/3dmodel/maps/map_qhmj.glb`](file:///d:/github/hoc-toan-3d/public/3dmodel/maps/map_qhmj.glb) bằng script Node (nhân ma trận phân cấp scene và `QHMJ_SCALE = 16` theo [`src/data/qhmjMap.ts#L13`](file:///d:/github/hoc-toan-3d/src/data/qhmjMap.ts#L13)):
- Tổng số node: **306 nodes**, **111 meshes**, **0 animation clips** (mọi chuyển động đều là procedural trên runtime như `gearBones` trong [`QhmjRegion.ts#L120-L125`](file:///d:/github/hoc-toan-3d/src/world/qhmj/QhmjRegion.ts#L120-L125)).
- Quy ước tọa độ bên dưới là **tọa độ local (mét)** sau khi nhân `QHMJ_SCALE = 16`. Khi zone đặt tại `center = (-400, -400)` ([`src/data/seedData.json#L145-L148`](file:///d:/github/hoc-toan-3d/src/data/seedData.json#L145-L148)), **tọa độ thế giới** = `(center.x + local.x, local.y, center.z + local.z)` = `(-400 + local.x, local.y, -400 + local.z)`.

### 2.1. Phân tích 5 cụm đường `RoadSurface` theo cao độ & hiện tượng chồng tầng

Mesh mặt đường `road_qhmj_001__6` gồm **4.013 tam giác**, trải rộng `X ∈ [-72.33, 79.56]`, `Y ∈ [0.27, 29.26]`, `Z ∈ [-64.98, 44.01]` và tách thành **5 cụm đường rời nhau (islands)** khi hàn đỉnh ngưỡng `weldEps = 0.8m` ([`RoadSurface.ts#L52`](file:///d:/github/hoc-toan-3d/src/world/qhmj/RoadSurface.ts#L52)):

| Cụm (`island`) | Số tam giác | Biên `X` (local m) | Biên `Y` (cao độ m) | Biên `Z` (local m) | Vai trò không gian & ngữ cảnh |
| :---: | :---: | :---: | :---: | :---: | :--- |
| **Island 4** *(Thấp nhất — Cổng vào)* | 290 | `[-11.87, 79.56]` | `[0.27, 8.04]` | `[-38.90, 10.95]` | **Chân đảo & Khu `chengbao_1`**: Chứa điểm xuất phát `QHMJ_SPAWN_LOCAL = (68.87, 0.37, -9.37)` và cổng về `QHMJ_RETURN_PORTAL_LOCAL = (73.5, 0.32, -9.37)` ([`qhmjMap.ts#L28-L31`](file:///d:/github/hoc-toan-3d/src/data/qhmjMap.ts#L28-L31)). Có 5 bệ bật nhảy tỏa đi cả 4 cụm còn lại! |
| **Island 2** *(Tầng trung-thấp Tây Bắc)* | 318 | `[-72.33, -32.79]` | `[4.71, 10.71]` | `[-54.38, -15.92]` | **Nhánh Tây Bắc**: Nối từ Island 4 hoặc Island 1, chứa 1 bệ nhảy (`comm_jumpt_02s` tại `y = 10.52`) phóng lên đoạn đầu cụm Bánh Răng của Island 1. |
| **Island 3** *(Tầng trung-cao Đông Bắc)* | 127 | `[-0.34, 43.78]` | `[15.86, 16.46]` | `[-60.84, -22.33]` | **Quảng trường Lâu Đài `chengbao`**: Mặt bằng phẳng rộng quanh `y ≈ 16.46`, chứa 7 cụm hoa `common_qhmj_hua*` và 1 đạo cụ `map_daoju_02 (4)`. Không có bệ GLB gốc → `buildJumpLinks` gắn 1 bệ tổng hợp (`synthetic`) quay về Island 4. |
| **Island 1** *(Tầng chính khổng lồ)* | 3.068 | `[-71.99, 72.95]` | `[8.45, 25.03]` | `[-56.48, 44.01]` | **Trục đường chính lớn nhất (76.5% tổng số tam giác)**: Kéo dài từ khu Bánh Răng phía Tây (`y ≈ 8.45–12.5`), vòng qua khu Quạt Gió (`fan1`, `fan2`), đi qua Rừng `senlin` ở Nam/Đông (`y ≈ 17.7–23.0`), leo dốc lên tới `y = 25.03`. |
| **Island 0** *(Đỉnh cao nhất)* | 210 | `[-0.61, 56.97]` | `[23.88, 29.26]` | `[-64.98, -19.27]` | **Đỉnh Lâu Đài `changbao_3`**: Cụm đường cao nhất bản đồ (`y = 23.88–29.26`), chứa 3 bệ nhảy phóng về quảng trường Island 3. |

**Phát hiện quan trọng về cầu vượt chồng tầng:**  
Lưới tra cứu `RoadSurface` có tổng cộng **2.082 ô** kích thước `2m × 2m`, trong đó **460 ô** chứa các tam giác có chênh lệch độ cao `≥ 3.0 m` (hai tầng đường đè lên nhau theo phương thẳng đứng). Nếu lấy mẫu đều trên mặt phẳng `(x, z)` tìm các điểm có từ 2 mặt đường trở lên cách nhau `|Δy| ≥ 2.0 m`, bản đồ có tới **799 điểm chồng tầng ở bước lưới 1 m** (tương đương **203 điểm ở bước 2 m**, **128 điểm ở bước 2.5 m**, **88 điểm ở bước 3 m**). Vì vậy mọi phép kiểm tra khoảng cách tương tác, raycast click, và lưu/khôi phục vị trí trên QHMJ **tuyệt đối không được chỉ dùng 2D `(x, z)`**.

### 2.2. Đồ thị 10 bệ bật nhảy GLB (`comm_jumpt_*`) & 2 bệ tổng hợp (`synthetic`)

`QhmjRegion.ts#L91-L94` trích tâm của 10 mesh `comm_jumpt_01s_common_platform_01_0` / `comm_jumpt_02s_common_platform_01_0`, sau đó `buildJumpLinks()` ([`JumpLinks.ts#L46-L169`](file:///d:/github/hoc-toan-3d/src/world/qhmj/JumpLinks.ts#L46-L169)) kết nối thành **12 `JumpLink`** bảo đảm đi từ `Island 4` tới được mọi cụm và từ mọi cụm đều quay về được `Island 4`:

| Link ID | Node gốc trong GLB | Loại | Từ → Đến (`from → to`) | Tọa độ bệ `pad` (local m) | Tọa độ đáp `target` (local m) | Khoảng cách 3D / Bay (`duration`, `peak`) |
| :---: | :--- | :--- | :---: | :---: | :---: | :---: |
| **0** | `chengbao_1/comm_jumpt_02s` | GLB | `Island 4 → Island 1` | `(27.03, 3.05, -10.85)` | `(20.89, 20.17, 7.46)` | `25.81 m` (`1.77s`, vòm `6.45m`) |
| **1** | `chengbao_1/comm_jumpt_02s (1)` | GLB | `Island 4 → Island 0` | `(15.57, 8.04, -22.08)` | `(22.49, 24.45, -32.10)` | `20.44 m` (`1.53s`, vòm `5.11m`) |
| **2** | `chengbao_1/comm_jumpt_02s (2)` | GLB | `Island 4 → Island 2` | `(-9.99, 5.13, -35.07)` | `(-36.02, 5.44, -46.63)` | `28.48 m` (`1.80s`, vòm `7.12m`) |
| **3** | `chengbao_1/comm_jumpt_02s (3)` | GLB | `Island 4 → Island 3` | `(29.97, 2.97, -15.92)` | `(40.38, 16.26, -25.71)` | `19.52 m` (`1.49s`, vòm `4.88m`) |
| **4** | `chengbao_1/comm_jumpt_02s (4)` | GLB | `Island 4 → Island 3` | `(39.30, 0.73, -4.82)` | `(40.38, 16.26, -25.71)` | `26.05 m` (`1.78s`, vòm `6.51m`) |
| **5** | `changbao_3/comm_jumpt_01s` | GLB | `Island 0 → Island 3` | `(0.20, 29.26, -50.92)` | `(3.15, 16.46, -47.16)` | `13.67 m` (`1.22s`, vòm `3.42m`) |
| **6** | `changbao_3/comm_jumpt_01s (1)` | GLB | `Island 0 → Island 3` | `(-0.19, 26.07, -43.77)` | `(3.15, 16.46, -47.16)` | `10.73 m` (`1.09s`, vòm `3.00m`) |
| **7** | `changbao_3/comm_jumpt_02s` | GLB | `Island 0 → Island 3` | `(35.88, 26.65, -31.16)` | `(39.36, 16.46, -26.66)` | `11.67 m` (`1.13s`, vòm `3.00m`) |
| **8** | `common_qhmj/comm_jumpt_02s` | GLB | `Island 2 → Island 1` | `(-66.11, 10.52, -17.31)` | `(-67.61, 11.80, -21.54)` | `4.67 m` (`0.81s`, vòm `3.00m`) |
| **9** | `common_qhmj/comm_jumpt_02s (1)` | GLB | `Island 1 → Island 2` | `(-44.60, 14.97, 32.90)` | `(-69.40, 9.90, -19.62)` | `58.31 m` (`1.80s`, vòm `14.58m`) |
| **10** | *(Bệ tổng hợp — không có GLB)* | Synthetic | `Island 3 → Island 4` | `(23.29, 16.46, -39.33)` | `(35.43, 1.58, -15.09)` | `30.93 m` (`1.80s`, vòm `7.73m`) |
| **11** | *(Bệ tổng hợp — không có GLB)* | Synthetic | `Island 1 → Island 4` | `(62.85, 24.09, 15.07)` | `(49.03, 0.56, -3.68)` | `33.11 m` (`1.80s`, vòm `8.28m`) |

*Ghi chú tọa độ thế giới:* Với `center = (-400, -400)`, ví dụ Link 0 có `pad` ở `(-372.97, 3.05, -410.85)` và `target` ở `(-379.11, 20.17, -392.54)`.

### 2.3. Danh mục chi tiết các Landmark, Barrier, Bánh Răng, Đồng Hồ, Quạt Gió, Rừng, Lâu Đài & Đạo Cụ

#### A. Nhóm Cơ Khí & Chướng Ngại Vật (`animation/_rootJoint` & `barrier_item_qhmj_*`)

1. **Hệ thống Bánh Răng (`barrier_item_qhmj_gear_*`) — 3 cụm bone điều khiển 7 skinned meshes (`Object_13`, `15`, `17`, `19`, `21`, `23`, `25`):**
   Tất cả nằm tập trung dọc đoạn đường **cụm Tây của Island 1** (`x ∈ [-65.51, -42.16]`, `z ∈ [-22.90, 16.68]`):
   - **Cụm `barrier_item_qhmj_gear_04`** (gồm bones `gear_1_05`, `gear_9_06`, `gear_9_1_07`, `qhmj_05_d01`, `qhmj_05_d09`):
     - `Object_13`: tâm `(-54.16, 12.50, -18.47)`, gần Island 1 (`2.25 m`).
     - `Object_15`: tâm `(-58.39, 8.86, -19.73)`, gần Island 1 (`4.66 m`).
   - **Cụm `barrier_item_qhmj_gear_2_08`** (gồm bones `gear_2_09`, `gear_2_1_010`, `gear_2_2_011`, `gear_3_012`, `gear_3_1_013`, `gear_3_2_014`, `qhmj_05_d02`, `qhmj_05_d03`):
     - `Object_17`: tâm `(-53.77, 10.75, -6.89)`, gần Island 1 (`2.98 m`).
     - `Object_19`: tâm `(-62.60, 10.42, -8.44)`, nằm ngay trên mặt đường Island 1 (`groundY = 11.80`, cách mép `1.38 m`).
   - **Cụm `barrier_item_qhmj_gear_3_015`** (gồm bones `gear_6_016`, `gear_6_1_017`, `gear_7_018`, `gear_7_1_019`, `gear_7_2_020`, `gear_8_021`, `qhmj_05_d06..d08`):
     - `Object_21`: tâm `(-49.28, 12.40, 7.19)`, trên mặt đường Island 1 (`groundY = 11.79`, cách `1.30 m`).
     - `Object_23`: tâm `(-50.80, 9.37, 3.07)`, gần Island 1 (`2.83 m`).
     - `Object_25`: tâm `(-43.70, 12.75, 14.02)`, gần Island 1 (`1.22 m`).
   - *Hiện trạng code:* [`QhmjRegion.ts#L96`](file:///d:/github/hoc-toan-3d/src/world/qhmj/QhmjRegion.ts#L96) và [`#L121-L123`](file:///d:/github/hoc-toan-3d/src/world/qhmj/QhmjRegion.ts#L121-L123) đang xoay toàn bộ 14 `gear_*` bones liên tục (`dt * 0.45`).

2. **Đồng Hồ Khổng Lồ (`barrier_item_qhmj_clock`):**
   - Skinned mesh `Object_55` (vật liệu `qhmj_13s`) gắn các bone `biou_00`, `Dummy001_01..03`.
   - Tâm local: **`(-61.71, 34.11, -42.98)`** (kích thước ~`5.08 × 6.59 × 4.30 m`).
   - Treo trên cao phía Tây Bắc; điểm đường gần nhất thuộc Island 1 tại `(-62.17, 11.86, -43.35)` (cách `22.26 m` theo phương thẳng đứng), và Island 2 tại `(-64.86, 5.76, -42.45)`.

3. **Hai Quạt Gió Cơ Khí (`barrier_item_qhmj_fan`):**
   - `fan1` (`qhmj_05_f02_qhmj_05s_0`): tâm **`(-69.23, 15.77, 9.08)`**, cạnh rìa Tây của Island 1 (cách `5.84 m`).
   - `fan2` (`qhmj_05_f01_qhmj_05s_0`): tâm **`(-42.11, 15.71, -24.84)`**, cạnh khúc cua Tây Bắc của Island 1 (cách `5.49 m`).

#### B. Nhóm Rừng (`common_qhmj/senlin`) — Đều neo sát mặt đường Island 1

- **6 cụm đạo cụ `map_daoju_02*`** (mỗi cụm gồm 2 mesh `daoju_02_map_daoju_02_0` và `daoju_02_1__0`):
  1. `map_daoju_02`: `(-13.13, 18.10, 21.28)` — ngay trên Island 1 (`groundY = 17.74`, cách đỉnh đường `0.44 m`).
  2. `map_daoju_02 (1)`: `(22.27, 20.31, 11.53)` — ngay trên Island 1 (`groundY = 20.27`, cách `0.59 m`).
  3. `map_daoju_02 (2)`: `(27.19, 21.33, 20.82)` — ngay trên Island 1 (`groundY = 21.28`, cách `1.15 m`).
  4. `map_daoju_02 (3)`: `(42.55, 22.35, 38.93)` — ngay trên Island 1 (`groundY = 22.27`, cách `0.16 m`).
  5. `map_daoju_02s`: `(59.42, 22.85, 23.61)` — ngay trên Island 1 (`groundY = 22.77`, cách `0.69 m`).
  6. `map_daoju_02s (1)`: `(67.79, 23.02, 29.46)` — ngay trên Island 1 (`groundY = 22.92`, cách `1.58 m`).
- **2 trụ/cổng đá khu rừng `common_qhmj_09`:** `(6.48, 21.49, 4.09)` (`groundY = 20.15`) và `(14.76, 21.49, 6.85)` (`groundY = 20.15`) trên Island 1.
- **Cụm cây cổ thụ `comm_shu_09`** (`qhmj_09t`, `qhmj_10_04t`, `road_qhmj_10n`): tại vùng Đông Nam Island 1, tâm quanh `(60.01..63.88, 24.24..25.94, 26.46..29.52)`, `groundY ≈ 22.66–22.84`.

#### C. Nhóm Lâu Đài (`common_qhmj/chengbao`, `chengbao_1`, `changbao_3`)

- **Quảng trường `chengbao` (nằm gọn trên Island 3, `groundY = 16.46`):**
  - 1 đạo cụ `map_daoju_02 (4)`: `(-0.17, 16.83, -47.66)`.
  - **7 bông hoa `common_qhmj_hua`..`(6)`**:
    - 3 hoa rải quanh sân lớn: `(32.28, 17.06, -42.82)`, `(27.96, 17.06, -52.64)`, `(21.23, 17.06, -54.50)`.
    - 4 hoa xếp thành hàng bậc thang từ `(25.45, 17.08, -36.23)` → `(26.03, 17.08, -37.24)` → `(26.63, 17.08, -38.21)` → `(27.08, 17.08, -39.20)`.
- **Phân khu `chengbao_1` (tầng thấp Island 4):** chứa 5 bệ nhảy (`comm_jumpt_02s`..`(4)`).
- **Phân khu `changbao_3` (đỉnh cao nhất Island 0):** chứa 3 bệ nhảy (`comm_jumpt_01s`, `(1)`, `02s`).

#### D. Các node kiến trúc cảnh quan (`map_qhmj/*`) & node cần lưu ý

- Các node `road_qhmj_01..14`, `qhmj_02..14` là vỏ kiến trúc bao quanh 5 cụm đường (tường thành, cầu vòm, bậc thang, lâu đài, thác nước `qhmj_10shui`).
- Node `qhmj_10n_qhmj_10_1_0` nằm xa tít ngoài bản đồ tại `(-57.86, 137.58, 330.87)` (cách đường `313.79 m`, là vật trang trí nền trời) và `qhmj_11_qhmj_11_0` là mặt nền biển/mây ở `y = -19.00`; không dùng làm điểm tương tác.
- `mini_map_road_MiniMap_0` (thuộc `map_qhmj_pick`) và `qhmj_sky_sky_qhmj_0` đã được ẩn sẵn bằng `QHMJ_HIDDEN_NODE_PATTERNS` ([`qhmjMap.ts#L25`](file:///d:/github/hoc-toan-3d/src/data/qhmjMap.ts#L25)).

---

## Phần 3: Đề Xuất Các Ý Tưởng Tương Tác Đặc Thù Cho `QHMJ_SANCTUARY`

### 3.1. Bối cảnh trải nghiệm đặc thù của QHMJ

Khác với góc nhìn đẳng cự cố định từ trên cao (`pitch = 0.8`, `distance = 48`, `fov = 42`) của Làng/Vườn Hoa/Công Viên/Nông Trại, khi bước vào QHMJ, `World.syncCameraModeForRegion()` chuyển sang **góc nhìn gần thứ nhất/vai sau sát nhân vật** ([`World.ts#L403-L429`](file:///d:/github/hoc-toan-3d/src/world/World.ts#L403-L429), [`#L2251-L2285`](file:///d:/github/hoc-toan-3d/src/world/World.ts#L2251-L2285)):
- `fov = 58`, `far = 700`, `distance = 2.4` (zoom `0.35..14`), `pitch ∈ [-0.25, 0.85]`.
- Khi `distance < 1.1`, `avatar.group.visible = false` (chế độ góc nhìn thứ nhất thực thụ).
- Lòng đường chỉ rộng trung vị ~`3.8 m` (`QHMJ_SCALE = 16`), dốc liên tục qua nhiều tầng và cầu vượt, tốc độ chạy `7.5 m/s`.

Do đó:
1. **Không nên đặt vật cản lớn (`Obstacle` bán kính 1.35m như Bia Đá Archimedes)** giữa lòng đường hẹp `3.8 m`, vì sẽ gây tắc nghẽn hoặc đẩy trượt người chơi ra mép cầu vượt.
2. **Thực thể tương tác nên thanh mảnh hoặc gắn vào đạo cụ/trạm ven đường** (tinh thể lơ lửng cao `1.4–1.8m`, bệ ấn ký sát lề hoặc ngay cạnh bệ bật nhảy, cột sáng beacon xuyên tầng để nhìn thấy từ tầng dưới/trên ở góc nhìn gần).
3. **Click chuột & phím `E` phải hỗ trợ 3D:** Vì camera nhìn ngang (`pitch ≈ 0.14`) ở nhiều độ cao `y ∈ [0.27, 29.26]`, người chơi có xu hướng nhìn thẳng vào tinh thể/cổng phía trước và bấm chuột trực tiếp vào nó hoặc đi tới bấm `E`.

### 3.2. Các ý tưởng tương tác & So sánh ưu/nhược điểm

#### Ý tưởng 1: Rải đồng đều "Tinh Thể Tri Thức" / Bia Đá nhỏ dọc 5 cụm đường (Flat Collection)
- **Cách chơi:** Đặt $N$ tinh thể/bia nhỏ dọc theo 5 cụm đường (hoặc tại các `map_daoju_02*` và `common_qhmj_hua*`); giải hết $N$ điểm là hoàn thành zone.
- **Ưu điểm:** Đơn giản nhất, giống 100% cơ chế `FLOWER_BEDS` / `PARK_SANCTUARY`, dễ sinh ngẫu nhiên số lượng bất kỳ từ Google Sheets (`QuestionCount`).
- **Nhược điểm:** Chưa tận dụng được 10 bệ bật nhảy `comm_jumpt_*`, 3 cụm bánh răng `gear_*`, và Đồng Hồ khổng lồ `clock` — biến map 3D đa tầng độc đáo thành đường chạy tuyến tính đơn thuần.

#### Ý tưởng 2: Khóa Bệ Bật Nhảy Bằng Ấn Ký Bánh Răng (Jump-Pad Gatekeeping)
- **Cách chơi:** Trên `Island 4` (tầng thấp) có 4 bệ nhảy tỏa đi `Island 1, 2, 3, 0`. Các bệ phóng đi lên bị khóa bằng vòng hào quang đỏ/xám ("Bệ Bật Nhảy Bị Phong Ấn"); người chơi giải toán tại bệ (hoặc tại trạm bánh răng) để chuyển bệ sang xanh dương (`0x38bdf8`) và kích hoạt phóng lên cụm đường tiếp theo.
- **Ưu điểm:** Tạo động lực khám phá có chiều sâu (Metroidvania nhẹ): giải toán = mở khóa đường lên tầng cao hơn! Rất phù hợp tâm lý học sinh tiểu học thích cảm giác "phóng bay lên tầng mới".
- **Nhược điểm:** Tổng số bệ GLB có 10 bệ (một số bệ trùng đích như Link 3 & 4 cùng tới Island 3, Link 5/6/7 cùng từ Island 0 về Island 3). Nếu chỉ gắn câu hỏi vào bệ nhảy thì số lượng câu hỏi bị bó hẹp (4–8 câu), khó đáp ứng bộ 10–20 câu từ Google Sheets.

#### Ý tưởng 3: Trạm Cơ Khí Theo Landmark (`gear_*` + `senlin` + `chengbao` + `clock`)
- **Cách chơi:** Gắn câu hỏi cố định vào các cụm mesh có sẵn trong GLB: 3 cụm Bánh Răng (`barrier_item_qhmj_gear_04`, `_2_08`, `_3_015`), 6 `map_daoju_02*` + 1 `map_daoju_02 (4)` + 7 hoa `common_qhmj_hua*`, và 1 trùm cuối tại Đồng Hồ (`barrier_item_qhmj_clock`).
- **Ưu điểm:** Khai thác tối đa mỹ thuật có sẵn của `map_qhmj.glb`.
- **Nhược điểm:** Phân bố mesh trong GLB **không đều theo cụm đường**: `Island 1` (và `Island 3`) tập trung toàn bộ `daoju`/`hua`/`gear`, còn `Island 4` (vùng xuất phát), `Island 2` và đỉnh `Island 0` không có mesh `daoju`/`hua` nào! Ngoài ra `Object_55` (Đồng Hồ) treo ở `y = 34.11` cách mặt đường `22.26 m`, không thể đi bộ tới chạm trực tiếp.

#### Ý tưởng 4 (Đề xuất tối ưu): Mô Hình Kết Hợp 3 Tầng — **"Chia 3 Tầng Cao Độ + Bệ Nhảy Mở Đường + Đỉnh Tháp"**
Kết hợp điểm mạnh của cả 3 phương án trên, đồng thời giải quyết triệt để **câu hỏi thực tế không theo chủ đề** và **số lượng câu hỏi lớn (`N = 1..40+`)** bằng cách chia theo **3 tầng cao độ tự nhiên** kết hợp ngưỡng trần sức chứa:

- **Đo đạc sức chứa thực tế trên `RoadSurface` ở `QHMJ_SCALE = 16`** (`hasClearance(0.9)`, cách spawn/cổng về `>= 3.5m` và cách bệ nhảy/điểm đáp `>= 3m`):
  - `minGap = 8m`: `Island 4` (`2` + 4 bệ), `Island 2` (`6`), `Island 1` (`50`), `Island 3` (`7`), `Island 0` (`11`) → **Tổng `80` điểm**.
  - `minGap = 6m`: `Island 4` (`2` + 4 bệ), `Island 2` (`9`), `Island 1` (`76`), `Island 3` (`9`), `Island 0` (`18`) → **Tổng `118` điểm**.
  - `minGap = 5m`: `Island 4` (`2` + 4 bệ), `Island 2` (`11`), `Island 1` (`94`), `Island 3` (`11`), `Island 0` (`23`) → **Tổng `145` điểm**.

1. **Tầng 1 — Vùng Thấp (`Island 4` + `Island 2`, `y = 0.27–10.71m`, trần `15` điểm):**
   - Gồm tối đa `4` bệ bật nhảy mở đường (`jump_gate`) trên `Island 4`, `2` điểm đường trên `Island 4`, và tối đa `9–11` điểm `path_crystal` trên `Island 2`.
   - *Quy tắc chống kẹt mềm (Soft-Lock):*
     - Khi `c1 <= 4`: gán toàn bộ `c1` câu vào các `jump_gate` tiến lên từ `Island 4` (khóa toàn bộ `JumpLink` cùng cặp `fromIsland -> toIsland` để không đi vòng qua bệ song song như Link 3/4).
     - Khi `c1 > 4` (tức `N >= 15`, có câu tràn sang `Island 2`): chỉ khóa tối đa `3` bệ đi `Island 1, 3, 0`; **bệ nhảy sang `Island 2` (`Link 2`) luôn mở sẵn** để người chơi sang `Island 2` giải tiếp phần Tầng 1!
     - **Mọi bệ `synthetic` (Link 10, 11) và mọi bệ đi về/hạ tầng (Link 5, 6, 7, 8, 9) luôn mở tự do**.
2. **Tầng 2 — Vùng Trung (`Island 1` trục đường chính, `y = 8.45–25.03m`):**
   - Nhận phần còn lại `c2 = N - c1 - c3`, rải dọc trục đường dài nhất (`3.068` tam giác). Ưu tiên neo vào các `map_daoju_02*` (6 điểm) và cụm `barrier_item_qhmj_gear_*` trên `Island 1`, sau đó lấy mẫu giãn cách đều bằng **Farthest-Point Sampling 3D** với `adaptive minGap` (`8m → 6m → 4.5m → 3m`).
3. **Tầng 3 — Vùng Cao (`Island 3` quảng trường + `Island 0` đỉnh, `y = 15.86–29.26m`, trần `27` điểm):**
   - Câu cuối cùng (ưu tiên câu nhiều bước `steps.length >= 2` nếu có, không phụ thuộc chủ đề) luôn neo lên **đỉnh `Island 0`** (`clock_summit`), kèm 1–2 điểm thêm trên `Island 0` khi `c3` lớn; phần còn lại của `c3` rải lên quảng trường rộng `Island 3` (ưu tiên `map_daoju_02 (4)` và cụm hoa `common_qhmj_hua*`).
- **Tỉ lệ chia tổng quát cho mọi `N`:** `N < 3` thì `c1 = 0, c3 = 1, c2 = N - 1`; `N >= 3` thì `c1 = min(15, floor(N / 3))`, `c3 = min(27, max(1, floor(N / 3)))`, `c2 = N - c1 - c3`. Ví dụ: `N = 9` (`3-3-3`), `N = 12` (`4-4-4`), `N = 30` (`10-10-10`), `N = 40` (`13-14-13`).

| Tiêu chí | Ý tưởng 1 (Rải phẳng) | Ý tưởng 2 (Chỉ khóa bệ nhảy) | Ý tưởng 3 (Chỉ bám mesh GLB) | **Ý tưởng 4 (Kết hợp 3 tầng — Đề xuất)** |
| :--- | :---: | :---: | :---: | :---: |
| Hỗ trợ $N$ câu hỏi tùy ý từ Sheets (8–25 câu) | ⭐⭐⭐ | ⭐ | ⭐⭐ | **⭐⭐⭐** |
| Khai thác bệ nhảy, cầu vượt, đỉnh lâu đài `map_qhmj.glb` | ⭐ | ⭐⭐⭐ | ⭐⭐ | **⭐⭐⭐** |
| Không bị kẹt (soft-lock) & không chắn đường hẹp `3.8m` | ⭐⭐⭐ | ⭐⭐ | ⭐⭐ | **⭐⭐⭐** |
| Phù hợp góc nhìn gần thứ nhất (`fov = 58`, `dist = 2.4`) | ⭐⭐ | ⭐⭐⭐ | ⭐⭐ | **⭐⭐⭐** |

---

## Phần 4: Kiến Trúc Cơ Chế Tạo Câu Hỏi Động Cho `QHMJ_SANCTUARY`

Để `QHMJ_SANCTUARY` bình đẳng hoàn toàn với `PARK_SANCTUARY` và `FARM_SANCTUARY`, hệ thống câu hỏi động hỗ trợ **3 nguồn đồng bộ** theo thứ tự ưu tiên:

```
[1. Google Sheets (sheetName = "QHMJ_Map" hoặc tùy biến trong CONFIG)]
        │ (nếu có dữ liệu hợp lệ sau sanitizeRemoteProblems)
        ▼
[2. Google Apps Script Generator (scripts/buildCodeGs.ts -> ZONE_TEMPLATES.QHMJ_SANCTUARY)]
        │ (tự động tạo tab + câu hỏi khi giáo viên dùng menu trên Sheets)
        ▼
[3. Client Procedural Fallback (adventure.ts / qhmjQuestions.ts)]
        │ (dùng khi zone khai báo QHMJ_SANCTUARY trên CONFIG nhưng tab sheet rỗng/chưa có)
        ▼
[anchorQhmjProblemsToSurface(surface, links, anchors, problems)] ──▶ Neo tọa độ 3D (x, y, z, island, kind) lên RoadSurface
```

### 4.1. Nguồn 1: Google Sheets Schema & Tương thích ngược (`PosX`, `PosZ`, tùy chọn `PosY`)

- **Cấu hình `CONFIG`:** Giữ nguyên 17 cột hiện tại ([`scripts/buildCodeGs.ts#L20-L24`](file:///d:/github/hoc-toan-3d/scripts/buildCodeGs.ts#L20-L24)), `Template = QHMJ_SANCTUARY`, `SheetName = QHMJ_Map` (đã khớp [`seedData.json#L137-L154`](file:///d:/github/hoc-toan-3d/src/data/seedData.json#L137-L154)), `CenterX = -400`, `CenterZ = -400`, `Width = 152`, `Depth = 109`.
- **Tab câu hỏi (`QUEST_HEADERS`):** Giữ nguyên 16 cột chuẩn; có thể đọc thêm cột tùy chọn `PosY` (nếu giáo viên thêm vào sheet) nhưng **không bắt buộc**:
  - Nếu `PosX`, `PosZ` để trống (trường hợp phổ biến nhất khi giáo viên soạn nhanh hoặc tự sinh): Client tự phân bổ tọa độ 3D bằng bộ neo `anchorQhmjProblemsToSurface()`.
  - Nếu giáo viên nhập `PosX`, `PosZ` (tọa độ thế giới hoặc offset): Client dùng `surface.sampleNearest(x, z, posY ?? zoneSpawn.y)` để kẹp lên mặt đường gần nhất và kiểm tra `hasClearance()`, tránh mọi rủi ro rơi xuống vực hoặc trôi khỏi đường.
- **Định dạng `RemoteProblem` (`src/data/remoteTypes.ts`):** Mở rộng optional `position?: { x: number; y?: number; z: number } | null` để không làm gãy các zone 2D cũ (`y` mặc định `undefined` ở các zone phẳng).

### 4.2. Nguồn 2: Mở rộng `scripts/buildCodeGs.ts`

1. Bổ sung vào `ZONE_TEMPLATES` ([`scripts/buildCodeGs.ts#L155-L166`](file:///d:/github/hoc-toan-3d/scripts/buildCodeGs.ts#L155-L166)):
   ```js
   QHMJ_SANCTUARY: {
     label: 'Con đường bậc thang & Bệ bật nhảy',
     theme: 'RUINS',
     questionCount: 12,
     width: 152,
     depth: 109,
     colorHex: '#e74c3c'
   }
   ```
   và thêm `'QHMJ_SANCTUARY'` vào `ZONE_TEMPLATE_ORDER` để menu `➕ Tạo Vùng Đất Mới...` hiển thị lựa chọn thứ 7.
2. Ở `fetchQuestionsFromSheet()` ([`scripts/buildCodeGs.ts#L745-L753`](file:///d:/github/hoc-toan-3d/scripts/buildCodeGs.ts#L745-L753)), đọc thêm `PosY` nếu cột tồn tại (`posY !== null ? { x: posX, y: posY, z: posZ } : { x: posX, z: posZ }`), và chạy `npm run build:apps-script` để cập nhật `apps-script/Code.gs`.
3. Tùy chọn bổ sung trong `seedData.json`: bổ sung 12 bài toán mẫu cho khóa `"QHMJ_Map"` để giáo viên có sẵn bộ mẫu tham khảo.

### 4.3. Nguồn 3: Procedural Fallback trong `src/core/adventure.ts`

Tương tự `generateFarmMultiplicationProblem()` ([`src/core/adventure.ts#L667-L723`](file:///d:/github/hoc-toan-3d/src/core/adventure.ts#L667-L723)), tạo hàm `generateQhmjProblems(zoneId: number, count = 12): RemoteProblem[]` (đặt tại `src/core/qhmjQuestions.ts` hoặc `src/core/adventure.ts`), **nhưng xuất thẳng chuẩn `RemoteProblem` (`steps: RemoteStep[]`)** thay vì schema legacy `Problem`/`Options`:
- **Phân tầng độ khó theo vị trí trên 5 cụm đường:**
  - *Cụm xuất phát & Tầng thấp (`Island 4`, `Island 2` — Câu 1–4):* Phép nhân/chia bảng 2–5 và bài toán đếm bước bậc thang (`multi` hoặc `numeric`).
  - *Cụm Bánh Răng & Rừng (`Island 1` — Câu 5–9):* Phép nhân/chia bảng 6–9, tìm thành phần chưa biết (`x × a = b` hoặc dãy số quy luật bánh răng), điền dấu so sánh `<, =, >`.
  - *Quảng trường Lâu Đài (`Island 3` — Câu 10–11):* Toán có lời văn 1–2 bước về độ dài/chu vi/đếm hoa trên bậc thang.
  - *Đỉnh Tháp & Đồng Hồ (`Island 0` — Câu cuối cùng):* Bài toán **2 bước** (ADR 0013) chủ đề xem giờ / khoảng thời gian trên đồng hồ (gắn với landmark `barrier_item_qhmj_clock`).
- Dùng **seeded PRNG** theo `zoneId + index` (thay vì `Math.random()` thuần mỗi lần mở dialog) để mỗi điểm tương tác trên đường có câu hỏi nhất quán với thẻ bài trong Bản Đồ `openArchimedesMapDialog`!

### 4.4. Cơ chế neo tọa độ 3D lên mặt đường `RoadSurface` (Không rơi khỏi tầng đường)

Thuật toán `anchorQhmjProblemsToSurface(surface, links, anchors, problems)` (chạy khi `buildQhmjRegion()` dựng xong `RoadSurface` và `JumpLink[]`):

1. **Tạo danh sách điểm ứng viên hợp lệ theo từng cụm (`island`):**
   - Thu thập toàn bộ đỉnh/tâm tam giác của `RoadSurface` theo từng `island` (`4 → 2 → 3 → 1 → 0`), lọc bằng `surface.hasClearance(x, z, y, 0.9, 1.0, 1.0)` ([`RoadSurface.ts#L234-L243`](file:///d:/github/hoc-toan-3d/src/world/qhmj/RoadSurface.ts#L234-L243)) để chắc chắn điểm đặt không nằm sát mép vực.
   - Loại bỏ các điểm nằm quá gần `anchors.spawn` (`< 4.0 m`), `anchors.returnPortal` (`< 4.0 m`), hoặc điểm đáp `link.target` (`< 3.5 m`) — khoảng cách tính theo **3D `Math.hypot(dx, dy, dz)`**.
2. **Gán vị trí theo 3 tầng cao độ (không phụ thuộc chủ đề, hỗ trợ `N = 1..40+`):**
   - *Nếu `problem.position` có sẵn từ Google Sheets:* Kẹp bằng `surface.sampleNearest(pos.x, pos.z, pos.y ?? anchors.spawn.y)`. Nếu mặt đường gần nhất không đủ clearance, dịch sang `surface.nearestVertex()` có clearance gần nhất.
   - *Nếu `problem.position` là `null` (tự động chia 3 tầng):*
     - Gọi `splitQhmjProblemsByTier(autoProblems.length)` để chia thành `c1` (Tầng 1: `Island 4 + Island 2`), `c2` (Tầng 2: `Island 1`), `c3` (Tầng 3: `Island 3 + Island 0`). Nếu có câu `steps.length >= 2`, đưa 1 câu nhiều bước lên cuối danh sách để chốt ở đỉnh `Island 0` (`clock_summit`).
     - Tầng 1 gán các câu đầu vào `jump_gate` trên `Island 4` (tối đa `4` cổng khi `c1 <= 4`; hoặc tối đa `3` cổng `4 -> 1, 3, 0` để chừa `4 -> 2` mở sẵn khi `c1 > 4`) rồi tràn sang `Island 4` path và `Island 2`.
     - Tầng 2 rải trên `Island 1` (ưu tiên `map_daoju_02*` và cụm `gear_*`, sau đó lấy mẫu Farthest-Point Sampling 3D với `adaptive minGap` giảm dần `8m → 6m → 4.5m → 3m`).
     - Tầng 3 đặt `1–3` câu cuối lên đỉnh `Island 0` (câu cuối là `clock_summit`), phần còn lại rải lên quảng trường `Island 3` (ưu tiên `map_daoju_02 (4)` và `common_qhmj_hua*`).

### 4.5. Lưu tiến độ, Huy hiệu & Đồng bộ đám mây

- **Lưu trữ trong `SaveState` ([`src/core/state.ts`](file:///d:/github/hoc-toan-3d/src/core/state.ts)):**
  - Tái sử dụng `state.solvedProblems: Record<string, boolean>` với khóa chuẩn hóa (ví dụ `qhmj_<zoneId>_<problemId>` hoặc trực tiếp `String(problem.id)` kèm prefix vùng để tránh trùng số `1..20` của Hoa/Công Viên!) — tương thích tự động với `mergeStates()` trong [`SyncManager.ts#L61-L64`](file:///d:/github/hoc-toan-3d/src/core/SyncManager.ts#L61-L64) và `PLAYERS.SaveDataJson` trên Google Sheets mà **không cần đổi schema bảng `PLAYERS`**.
  - Lưu thêm `qhmjUnlockedLinks?: Record<string, boolean>` (hoặc suy ra trực tiếp từ câu hỏi neo vào `JumpLink` đã được giải trong `solvedProblems`, giữ trạng thái đơn nguồn sự thật — single source of truth).
- **Mở lại `zoneCountsForBadges` & Tổng quát hóa `zoneBadges`:**
  - Cập nhật `zoneCountsForBadges()` trong [`WorldSession.ts#L43-L47`](file:///d:/github/hoc-toan-3d/src/boot/WorldSession.ts#L43-L47) thành `return kind !== 'flower';` khi Pha 2 hoàn tất.
  - Khắc phục giới hạn cứng `zoneId >= 1 && zoneId <= 5` ở `Adventure.activateMonolith()` ([`adventure.ts#L468`](file:///d:/github/hoc-toan-3d/src/core/adventure.ts#L468)) và `reconcileZoneProgress()` ([`adventure.ts#L527`](file:///d:/github/hoc-toan-3d/src/core/adventure.ts#L527)): thay bằng tra cứu theo vị trí của zone trong `badgeZones` (hoặc `solvedZoneBadges: Record<number, boolean>`), để Zone 8 (`QHMJ_SANCTUARY`) hay Park/Farm nhận đủ Đại Huy Chương khi giải hết 100% câu hỏi.

---

## Phần 5: Kế Hoạch Triển Khai Pha 2 Chi Tiết

### 5.1. Danh sách file cần tạo mới & chỉnh sửa

| File | Loại | Thay đổi cụ thể |
| :--- | :---: | :--- |
| [`src/core/qhmjQuestions.ts`](file:///d:/github/hoc-toan-3d/src/core/qhmjQuestions.ts) | **Tạo mới** | Hàm `generateQhmjProblems(zoneId, count)` sinh câu hỏi procedural theo chuẩn `RemoteProblem` (nhân/chia, tìm `x`, so sánh, xem giờ đồng hồ cho câu cuối). |
| [`src/world/qhmj/QhmjEntities.ts`](file:///d:/github/hoc-toan-3d/src/world/qhmj/QhmjEntities.ts) | **Tạo mới** | Quản lý các điểm tương tác 3D trên `RoadSurface`: thuật toán `anchorQhmjProblemsToSurface()`, dựng mesh tinh thể/ấn ký/bệ khóa, trạng thái mở khóa bệ nhảy, hàm `findNodeAtRay(ray)` (3D raycast) và `nearNodeIndex(x, y, z)` (3D proximity). |
| [`src/world/qhmj/QhmjRegion.ts`](file:///d:/github/hoc-toan-3d/src/world/qhmj/QhmjRegion.ts) | Sửa | Nhận danh sách câu hỏi vùng + trạng thái đã giải; gắn `QhmjEntities` vào `parent` (`zoneGroup`); đổi màu vòng sáng `beacons` giữa trạng thái khóa (`0xef4444`) và mở (`0x38bdf8`). |
| [`src/world/SpatialWorld.ts`](file:///d:/github/hoc-toan-3d/src/world/SpatialWorld.ts) | Sửa | Bổ sung `qhmjNodes` (tọa độ 3D `{ x, y, z, linkId?, problemId }`) vào `QhmjZoneState`; kiểm tra điều kiện mở khóa `JumpLink` trong `tickRoad()` ([`#L759-L771`](file:///d:/github/hoc-toan-3d/src/world/SpatialWorld.ts#L759-L771)); thêm `nearQhmjNodeIndex()` dùng khoảng cách **3D `Math.hypot(dx, dy, dz)`**; lưu `lastSavedY` cho QHMJ khi spawn. |
| [`src/world/World.ts`](file:///d:/github/hoc-toan-3d/src/world/World.ts) | Sửa | Truyền `questionsBySheet[dynZone.sheetName]` vào `buildQhmjRegion()` tại [`#L1112`](file:///d:/github/hoc-toan-3d/src/world/World.ts#L1112); bổ sung sync câu hỏi khi `renderDynamicZones()` nhận fresh data; bổ sung **3D Raycaster** cho QHMJ vào `interactAtScreen()` ([`#L2058`](file:///d:/github/hoc-toan-3d/src/world/World.ts#L2058)) và cập nhật `WorldFrameSnapshot.nearQhmjNodeIndex` trong `renderFrame()`; thêm callback `onQhmjNodeClick`. |
| [`src/quiz/types.ts`](file:///d:/github/hoc-toan-3d/src/quiz/types.ts) & [`src/quiz/ChallengeDialog.ts`](file:///d:/github/hoc-toan-3d/src/quiz/ChallengeDialog.ts) | Sửa | Thêm `ChallengeType = 'qhmj_node'` vào `ChallengeSpec` và hàm `openQhmjNode(...)` hỗ trợ đầy đủ multi-step (ADR 0013), numpad, comparison, hints, telemetry `logRemoteProgress()`. |
| [`src/core/adventure.ts`](file:///d:/github/hoc-toan-3d/src/core/adventure.ts) & [`src/core/state.ts`](file:///d:/github/hoc-toan-3d/src/core/state.ts) | Sửa | Thêm `solveQhmjNode()` (cộng XP/xu, đánh dấu `solvedProblems`, thưởng hoàn thành toàn zone + Đại Huy Chương); cho phép `SaveState.position` lưu thêm `y?: number` tùy chọn cho vùng đa tầng; mở rộng `reconcileZoneProgress` cho `zoneBadges`. |
| [`src/boot/WorldSession.ts`](file:///d:/github/hoc-toan-3d/src/boot/WorldSession.ts), [`src/boot/types.ts`](file:///d:/github/hoc-toan-3d/src/boot/types.ts), [`src/world/loop/types.ts`](file:///d:/github/hoc-toan-3d/src/world/loop/types.ts) | Sửa | Mở lại `zoneCountsForBadges()` cho `'qhmj'`; bổ sung `nearQhmjNodeIndex` & `onQhmjNodeClick` vào `WorldHandle` / `WorldFrameSnapshot`. |
| [`src/main.ts`](file:///d:/github/hoc-toan-3d/src/main.ts) | Sửa | Xử lý `nearQhmjNodeIndex` trong `interactAction()` và `onWorldFrame()` (hiện banner `#interact` cho cả tinh thể lẫn bệ nhảy đang khóa); cập nhật tab Bản Đồ `openArchimedesMapDialog()` ([`#L771-L789`](file:///d:/github/hoc-toan-3d/src/main.ts#L771-L789), [`#L811-L856`](file:///d:/github/hoc-toan-3d/src/main.ts#L811-L856)) để hiển thị tiến độ X/Y thử thách của `QHMJ_SANCTUARY` và nút dịch chuyển tới điểm `spawn` / từng điểm thử thách. |
| [`scripts/buildCodeGs.ts`](file:///d:/github/hoc-toan-3d/scripts/buildCodeGs.ts), `apps-script/Code.gs`, [`src/data/seedData.json`](file:///d:/github/hoc-toan-3d/src/data/seedData.json), [`src/data/remoteTypes.ts`](file:///d:/github/hoc-toan-3d/src/data/remoteTypes.ts) | Sửa | Thêm `QHMJ_SANCTUARY` vào `ZONE_TEMPLATES` & `ZONE_TEMPLATE_ORDER`; hỗ trợ `PosY` tùy chọn; thêm bộ câu hỏi mẫu `"QHMJ_Map"` vào `seedData.json`. |

### 5.2. Interface TypeScript đề xuất

```ts
// src/world/qhmj/QhmjEntities.ts
export type QhmjNodeKind = 'jump_gate' | 'path_crystal' | 'clock_summit';

export interface QhmjInteractiveNode {
  index: number;
  id: string | number;
  /** Khóa duy nhất lưu trong SaveState.solvedProblems, vd: `qhmj_${zoneId}_${id}` */
  progressKey: string;
  kind: QhmjNodeKind;
  /** Tọa độ thế giới neo chặt trên mặt đường RoadSurface */
  position: { x: number; y: number; z: number };
  island: number;
  /** Nếu kind === 'jump_gate', trỏ tới JumpLink.id bị khóa cho tới khi giải xong */
  lockedLinkId?: number;
  problem: RemoteProblem;
  solved: boolean;
}
```

```ts
// Mở rộng src/quiz/types.ts -> ChallengeSpec
| {
    type: 'qhmj_node';
    zoneId: number;
    zoneName: string;
    nodeIndex: number;
    progressKey: string;
    nodeKind: 'jump_gate' | 'path_crystal' | 'clock_summit';
    problem: RemoteProblem;
    totalNodes: number;
    stepIndex?: number;
  }
```

### 5.3. Các rủi ro kỹ thuật bắt buộc phải kiểm thử (Test Matrix)

1. **Va chạm / Proximity trên cầu vượt chồng tầng (Bắt buộc dùng 3D `hypot(dx, dy, dz)`):**
   - Trong `map_qhmj.glb`, mặt đường có **460 ô lưới `2m × 2m` chứa nhiều tầng chênh `≥ 3m`** (**799 điểm chồng tầng ở lưới `1m`**, **203 điểm ở lưới `2m`**).
   - *Rủi ro:* Nếu `nearQhmjNodeIndex()` hoặc `anchorQhmjProblemsToSurface()` kiểm tra `Math.hypot(px - nx, pz - nz) < 2.9` giống Monolith/Flower, người chơi đứng ở tầng dưới (`Island 4`, `y = 3m`) sẽ kích hoạt nhầm tinh thể ở tầng trên (`Island 1`, `y = 20m`)!
   - *Giải pháp & Test:* Mọi kiểm tra khoảng cách ở QHMJ bắt buộc dùng **khoảng cách 3D** `Math.hypot(px - nx, pz - nz)` **kết hợp** `Math.abs(py - ny) <= 2.8` (hoặc `Math.hypot(dx, dy, dz) <= 3.0 && Math.abs(dy) <= 2.5`). Viết unit test đặt người chơi ở tầng dưới ngay dưới tọa độ `(x, z)` của một node tầng trên và khẳng định `nearQhmjNodeIndex() === -1`.
2. **Click 3D ở độ cao `y ∈ [0.27, 29.26]` (Không dùng `Plane(y = 0)`):**
   - *Rủi ro:* `World.interactAtScreen()` hiện chiếu tia lên `scratchRayPlane` (`y = 0`). Khi đứng ở `y = 24m` trên `Island 1`, điểm cắt với `y = 0` nằm lệch hàng chục mét.
   - *Giải pháp & Test:* Dùng `this.scratchRay.intersectObjects(qhmjHitMeshes, true)` trực tiếp lên các mesh/hitbox tinh thể & bệ khóa (giống `FarmSanctuary.findAnimalAtRay`), kiểm tra thêm khoảng cách 3D từ người chơi tới node trước khi mở dialog.
3. **Chống kẹt mềm (Soft-Lock) ở bệ bật nhảy bị khóa:**
   - *Rủi ro:* Nếu khóa nhầm bệ `synthetic` (Link 10, 11) hoặc bệ đi xuống (Link 5, 6, 7, 8), người chơi lỡ nhảy lên tầng cao rồi không quay về được hoặc bỏ qua không giải nổi câu khó sẽ bị mắc kẹt.
   - *Giải pháp & Test:* Trong unit test `tests/qhmj_road.test.ts`, khẳng định mọi `JumpLink` có `synthetic === true` hoặc dẫn về `Island 4` **không bao giờ** bị gán `lockedLinkId`, và từ mọi `island` đã mở đều tồn tại đường về `anchors.returnPortal` mà không cần giải thêm câu hỏi mới.
4. **Lưu & Khôi phục vị trí (Deferred Spawn) khi người chơi reload ở tầng cao:**
   - *Rủi ro:* `SaveState.position` hiện chỉ lưu `{ x, z }`. Khi `SpatialWorld.teleport(x, z)` chạy lúc reload tại điểm chồng tầng, `sampleNearest(x, z, qz.spawn.y)` so với `qz.spawn.y = 0.37` sẽ kéo người chơi tụt xuống tầng dưới cùng!
   - *Giải pháp & Test:* Lưu thêm `y?: number` trong `SaveState.position` (bỏ qua nếu không nằm trong QHMJ), và dùng `position.y ?? qz.spawn.y` làm `refY` trong `SpatialWorld.teleport()`. Viết test lưu tọa độ ở `Island 1` ngay phía trên `Island 4`, khôi phục qua `parseSave` + `teleport`, xác nhận nhân vật giữ nguyên tầng `Island 1`.
5. **Trùng ID câu hỏi & Huy hiệu khu vực `zoneId > 5`:**
   - *Rủi ro:* `seedData.json` đặt QHMJ là `ZoneId = 8`, câu hỏi sinh từ Sheets thường có `ProblemId = 1..12` trùng với `1..10` của `VuonHoa` hoặc `1..20` của `CongVienXanh`, khiến `adventure.isProblemSolved(id)` đánh dấu nhầm; đồng thời `Adventure.activateMonolith()` đang khóa `zoneId <= 5` cho `zoneBadges`.
   - *Giải pháp & Test:* Namespace khóa tiến độ theo vùng (`qhmj_${zoneId}_${problem.id}`), đồng thời tổng quát hóa `zoneBadges` theo danh sách `badgeZones`.
6. **Góc nhìn gần & vật cản đường hẹp:**
   - Tinh thể/ấn ký đặt trên đường rộng `3.8 m` **không thêm vào `regionObstacles`** (hoặc chỉ có bán kính vật lý `0` — đi xuyên qua vùng hào quang được) để tránh kẹt chuyển động khi camera sát lưng (`distance = 2.4 m`).
