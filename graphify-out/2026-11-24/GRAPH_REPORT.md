# Graph Report - vuong-quoc-cuu-chuong-3d  (2026-11-24)

## Corpus Check
- 150 files · ~205,319 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 211 file(s) not represented in the graph (top: .glb 188, .bin 9, .gltf 9)
- WARNING: 211 of 364 files seen (58%) have no supported extractor and are missing from this graph entirely. It may look complete while representing only part of the codebase.

## Summary
- 1526 nodes · 3784 edges · 82 communities (63 shown, 19 thin omitted)
- Extraction: 93% EXTRACTED · 7% INFERRED · 0% AMBIGUOUS · INFERRED: 251 edges (avg confidence: 0.86)
- Token cost: 287,380 input · 154,182 output

## Graph Freshness
- Built from commit: `fe29c15f`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- main.ts
- Challenge Dialog & Sessions
- QhmjRegion.ts
- PlayerAvatar
- Farm Sanctuary & Terrain
- Farm Guidance & Tracker HUD
- .syncRenderLoopState
- Bao Chau 3D Model Builder
- SyncManager
- Adventure Progression & Rewards
- World.ts
- ref_node_assert
- Vite PWA & Build Config
- Google Sheets Client & Cache
- SceneBatchPool.ts
- 3D Primitives & Park Loading
- Explorer Profile & Passcodes
- SpatialWorld Kinematics & Collision
- WorldSession Handle & Sync
- Farm Sanctuary Animal Spawning
- HUD Frame Presentation
- qhmj_road.test.ts
- Player Sync Design & Issues
- GitHub Pages Deploy Workflow
- Portal Links & Hub Overlap
- SceneBatchPool & Particle Effects
- 3D Model Scanner CLI
- .renderDynamicZones
- Farm Collider Grid & Mesh Raster
- Apps Script Generator Tests
- RemoteZoneConfig
- AudioManager
- QhmjLayout.ts
- Starter Village & Core Gameplay
- Sheets CMS & Batch Ingestion
- Bai 310 Workbook Screenshot
- Region Activation & Teleportation
- Mesh Catalog Pipeline Issues
- Scene Isolation & Prefab Slicing
- Deep Modules & MVP QA
- Farm Countryside & Animal Rescue
- classifyZoneTemplate
- TypeScript Compiler Config
- Procedural Land Builder Spec
- Vương Quốc Học Toán 3D — Game Design Document (Remake v2.0)
- WorldSession Port Interfaces
- ProceduralLandBuilder Implementation
- Archimedes Archipelago & Cozy Lake
- Spatial Bounds & Deferred Spawn
- AssetRepository
- three
- Modular FarmAnimalEntity
- 3D Prefab & Safety Clearing
- Park Sanctuary & Tree Awakening
- settings
- Apps Script Setup & Players Roster
- PWA Offline & Brand Assets
- QHMJ Design & Jump-Pad Graph
- prefabSlicer.ts
- openArchimedesMapDialog
- adventure.ts
- Cross-Design Portal & QHMJ Links
- scripts
- Multi-Slot Question Inputs
- Multi-Step Challenge Stepper
- engine.ts
- Numbers & Schema
- Farm Asset Attribution & Save Key
- ScreenStack
- Google Sheets v2 & SaveState v2 Specification
- Touch Wheel Direct Locomotion
- Manual Hot Sync Triggers
- C. Danh mục Vật Phẩm & Cửa Hàng (`SHOP_CATALOG`)
- archimedes_trial_map.test.ts
- World Style, Lighting, Unified Camera & Region Plugins
- Progression, Economy & Item Catalog
- Rules

## God Nodes (most connected - your core abstractions)
1. `World` - 94 edges
2. `Adventure` - 70 edges
3. `SpatialWorld` - 68 edges
4. `ChallengeDialog` - 38 edges
5. `RemoteZoneConfig` - 37 edges
6. `FarmSanctuary` - 36 edges
7. `RemoteProblem` - 35 edges
8. `AssetRepository` - 33 edges
9. `WorldHandle` - 33 edges
10. `three` - 30 edges

## Surprising Connections (you probably didn't know these)
- `Rules` --references--> `World`  [INFERRED]
  docs/features/world-style-camera/design.md → src/world/World.ts
- `Edge cases` --references--> `AssetRepository`  [INFERRED]
  docs/features/world-style-camera/design.md → src/world/assets/AssetRepository.ts
- `Edge cases` --references--> `ScreenStack`  [INFERRED]
  docs/features/ui-ux-shell/design.md → src/ui/ScreenStack.ts
- `Edge cases` --references--> `sanitizeRemoteZones()`  [INFERRED]
  docs/features/google-sheets-v2/design.md → src/core/sheetsClient.ts
- `Milestones` --references--> `ArchimedesZoneBuilder`  [INFERRED]
  docs/GDD.md → src/world/ArchimedesZoneBuilder.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Four Deep Modules Game Decomposition** — docs_adr_0001_four_deep_modules_four_deep_modules_architecture, docs_adr_0001_four_deep_modules_adventure, docs_adr_0001_four_deep_modules_quizsession, docs_adr_0001_four_deep_modules_spatialworld, docs_adr_0001_four_deep_modules_audioadapter [EXTRACTED 1.00]
- **Offline-First Google Sheets Two-Way Player Sync Architecture** — _scratch_sheets_player_sync_issues_01_sheets_players_schema_and_apps_script_api_playerssheetschema, _scratch_sheets_player_sync_issues_02_explorer_passcode_generator_and_recovery_passcodegenerator, _scratch_sheets_player_sync_issues_03_union_max_sync_and_throttled_queue_mergestatesunionmax, _scratch_sheets_player_sync_issues_04_local_storage_migration_and_cloud_status_ui_runlocalstoragemigration [EXTRACTED 1.00]
- **4-Tier 3D Mesh Catalog to Procedural Sanctuary Pipeline** — docs_design_3d_mesh_catalog_and_custom_land_builder_meshcatalogschema, docs_design_3d_mesh_catalog_and_custom_land_builder_prefabslicer, docs_design_3d_mesh_catalog_and_custom_land_builder_vramsharingdeepclone, docs_design_3d_mesh_catalog_and_custom_land_builder_procedurallandbuilder [EXTRACTED 1.00]
- **QHMJ_SANCTUARY 3-Tier Dynamic Question & 3D Interaction System** — docs_design_qhmj_sanctuary_interactions_and_dynamic_questions_3tierelevationmodel, docs_design_qhmj_sanctuary_interactions_and_dynamic_questions_qhmjquestionsources, docs_design_qhmj_sanctuary_interactions_and_dynamic_questions_surfaceanchoring, docs_design_qhmj_sanctuary_interactions_and_dynamic_questions_3draycastandproximity [EXTRACTED 1.00]
- **Google Sheets CMS Batch Ingestion, Schedule & Sync Pipeline** — context_zone_registry, docs_adr_0003_google_sheets_backend_and_zone_templates_google_sheets_cms, docs_adr_0004_unified_batch_ingestion_and_manual_sync_unified_batch_ingestion, docs_adr_0004_unified_batch_ingestion_and_manual_sync_manual_hot_sync_triggers, docs_adr_0011_zone_unlock_schedule_zone_unlock_schedule_architecture [EXTRACTED 1.00]
- **Universal Multi-Step Challenge & 3D Entity Awakening Loop** — docs_adr_0013_standardized_multi_step_challenges_universal_stepper_architecture, context_challenge_flower, context_knowledge_monolith, context_knowledge_tree, context_escaped_farm_animal, context_multistep_awakening [EXTRACTED 1.00]

## Communities (82 total, 19 thin omitted)

### Community 0 - "main.ts"
Cohesion: 0.07
Nodes (25): generateQhmjProblems(), mulberry32(), adventure, app, audio, cloudStatusBtn, dirDown, dirLeft (+17 more)

### Community 1 - "Challenge Dialog & Sessions"
Cohesion: 0.05
Nodes (40): ArchimedesStep, FLOWER_QUESTIONS, FlowerOption, FlowerQuestion, RemoteStep, ChallengeDialog, ChallengeDialogHost, closeLightbox() (+32 more)

### Community 2 - "QhmjRegion.ts"
Cohesion: 0.11
Nodes (20): QHMJ_HIDDEN_NODE_PATTERNS, BuildJumpLinksOptions, evalJumpArc(), JumpLink, PadInfo, QhmjEntities, QhmjInteractiveEntity, QhmjNodeSpec (+12 more)

### Community 4 - "Farm Sanctuary & Terrain"
Cohesion: 0.09
Nodes (37): generateFarmMultiplicationProblem(), computeFarmAnchors(), FARM_CAMERA_DEFAULTS, FARM_DIRECT_HOMEWARD_MAX_DIST, FARM_FENCE_JUMP_CLEARANCE, FARM_FENCE_MATERIALS, FARM_GROUND_MATERIALS, FARM_PEN_ENTRY_LOCAL (+29 more)

### Community 5 - "Farm Guidance & Tracker HUD"
Cohesion: 0.06
Nodes (34): FARM_ANIMAL_ANCHORS_LOCAL, FARM_PEN_CENTER_LOCAL, FARM_RETURN_PORTAL_LOCAL, FarmTrackerHud, FarmTrackerHudOptions, FarmTrackerSyncParams, CAMERA_ZOOM_LIMITS, CameraDistanceLimits (+26 more)

### Community 7 - "Bao Chau 3D Model Builder"
Cohesion: 0.14
Nodes (31): addMesh(), boxBetween(), buildArm(), buildBody(), buildCharacter(), buildGlasses(), buildHair(), buildHead() (+23 more)

### Community 8 - "SyncManager"
Cohesion: 0.12
Nodes (11): QuestionStat, formatTimeAgo(), getSyncStatusLabel(), hasLocalProgress(), mergeStates(), MIGRATION_KEY, MigrationResult, runLocalStorageMigration() (+3 more)

### Community 9 - "Adventure Progression & Rewards"
Cohesion: 0.12
Nodes (3): Adventure, entityKey(), getLevel()

### Community 10 - "World.ts"
Cohesion: 0.09
Nodes (40): resolveZoneProblemsWithPositions(), computeLakeAnchors(), computeLakeEntityPositions(), createLakeLand(), isValidLakePosition(), isWithinLakeLand(), LAKE_ARRIVAL_OFFSET, LAKE_FALLBACK_RADIUS (+32 more)

### Community 11 - "ref_node_assert"
Cohesion: 0.12
Nodes (12): DailyDrillState, freshState(), loadState(), parseSave(), positive(), sanitizeSaveState(), SolvedEntityMeta, todayDateKey() (+4 more)

### Community 12 - "Vite PWA & Build Config"
Cohesion: 0.10
Nodes (25): dependencies, three@^0.180.0, devDependencies, @gltf-transform/core@^4.5.1, @gltf-transform/extensions@^4.5.1, @gltf-transform/functions@^4.5.1, sharp@^0.35.5, tsx@^4.20.5 (+17 more)

### Community 13 - "Google Sheets Client & Cache"
Cohesion: 0.12
Nodes (28): extractMarkdownImage(), resolveImageUrl(), APPS_SCRIPT_URL_KEY, DEFAULT_APPS_SCRIPT_URL, fetchRemoteData(), getAppsScriptUrl(), getBundledFallbackData(), getCachedRemoteData() (+20 more)

### Community 14 - "SceneBatchPool.ts"
Cohesion: 0.20
Nodes (9): BatchTemplateOptions, SPARK_COLORS, SparkSlot, StaticPlacement, TRAIL_PALETTES, TrailEffectKind, TrailPool, TrailPoolKey (+1 more)

### Community 16 - "Explorer Profile & Passcodes"
Cohesion: 0.15
Nodes (14): defaultStorage, EXPLORER_PROFILE_KEY, ExplorerProfileManager, FRIENDLY_NICKNAMES, generateExplorerId(), generateExplorerPasscode(), memoryStore, normalizePasscode() (+6 more)

### Community 19 - "Farm Sanctuary Animal Spawning"
Cohesion: 0.19
Nodes (3): isInsideFarmPenLocal(), isWithinFarmPlayableBoundsLocal(), FarmSanctuary

### Community 20 - "HUD Frame Presentation"
Cohesion: 0.15
Nodes (10): formatPortalOverlay(), HudPresenter, PortalOverlayInfo, FloatingLabelPose, HudPresentationState, HudSnapshotContext, PortalSummary, PresentationPresenterSeam (+2 more)

### Community 21 - "qhmj_road.test.ts"
Cohesion: 0.13
Nodes (21): computeQhmjAnchors(), QHMJ_REGION_RADIUS, QHMJ_RETURN_PORTAL_LOCAL, QHMJ_ROAD_MESH_NAME, QHMJ_SCALE, QHMJ_SPAWN_LOCAL, QHMJ_SPEED, QHMJ_TEMPLATE (+13 more)

### Community 22 - "Player Sync Design & Issues"
Cohesion: 0.18
Nodes (14): Client Cloud Endpoints (savePlayerProgressToSheets & loadPlayerProgressFromSheets), Issue 01: Google Sheets PLAYERS Schema & Apps Script API, PLAYERS Tab 14-Column Schema, ExplorerProfileManager Auto-Provisioning, Issue 02: Explorer Passcode Generator & Cross-Device Recovery, Recovery Modal & applyRestoredPlayer() 3D Sync, Issue 03: Union-Max Conflict Resolution & Throttled Sync Queue, Topbar #cloud-status-btn & Settings Cloud Management UI (+6 more)

### Community 23 - "GitHub Pages Deploy Workflow"
Cohesion: 0.07
Nodes (31): runs-on, steps, concurrency, cancel-in-progress, group, environment, needs, runs-on (+23 more)

### Community 24 - "Portal Links & Hub Overlap"
Cohesion: 0.14
Nodes (13): WORLD, FARM_PLAYABLE_BOUNDS, DEFAULT_LAKE_SANCTUARIES, FLOWER_COORDS, PlayerPose, QhmjNodeAnchor, ROAD_SLIDE_ANGLES, SpatialInput (+5 more)

### Community 26 - "3D Model Scanner CLI"
Cohesion: 0.15
Nodes (21): CHARACTER_MODEL_FOLDERS, classifyMeshSemantic(), computeEntityGeometry(), EntityTarget, extractMaterials(), find3DModelFiles(), identifyEntitiesInDocument(), isCharacterModelPath() (+13 more)

### Community 30 - "Apps Script Generator Tests"
Cohesion: 0.13
Nodes (3): FakeSheet, FakeSpreadsheet, source

### Community 31 - "RemoteZoneConfig"
Cohesion: 0.15
Nodes (9): RemoteContentPayload, RemoteContentSnapshot, WorldSession, zoneCountsForBadges(), zoneSpawnsMonoliths(), ZoneTemplateKind, CachedRemotePayload, RemoteProblem (+1 more)

### Community 32 - "AudioManager"
Cohesion: 0.17
Nodes (6): AudioCue, AudioManager, getPurchasableShopItems(), getShopItemsByType(), ShopModal, ShopModalContext

### Community 33 - "QhmjLayout.ts"
Cohesion: 0.16
Nodes (16): QhmjAnchors, buildJumpLinks(), BuildQhmjLayoutInput, buildQhmjNodeLayout(), collectIslandCandidates(), dist3(), findGateSpot(), ISLAND1_LANDMARK_LOCALS (+8 more)

### Community 34 - "Starter Village & Core Gameplay"
Cohesion: 0.18
Nodes (9): Đoạn Cầu (Bridge Segment), Cây Hoa Thử Thách (Challenge Flower), Tiệm Tạp Hóa Vương Quốc (Kingdom Emporium), Vườn Hoa Tri Thức (Knowledge Flower Garden), Bùa Trợ Thủ Toán Học (Math Helper Charm), NPC Milo, Bảng Cửu Chương (Multiplication Table), Làng Khởi Đầu (Starter Village) (+1 more)

### Community 35 - "Sheets CMS & Batch Ingestion"
Cohesion: 0.19
Nodes (10): Nhân Vật Đồng Hành (Companion Avatar), Tên Dũng Sĩ (Explorer Nickname), Hồ Sơ Dũng Sĩ (Explorer Profile), Chức Danh Khám Phá (Explorer Title), Thẻ Người Chơi (Player Card), Nhật Ký Thám Hiểm Trực Tuyến (Remote Adventure Log), Bảng Thử Thách Vùng Đất (Zone Quest Sheet), Sổ Đăng Ký Vùng Đất (Zone Registry / CONFIG) (+2 more)

### Community 36 - "Bai 310 Workbook Screenshot"
Cohesion: 0.26
Nodes (10): Problem a1: 80 -> (+8) -> [ ] -> (+12) -> [ ], Problem a2: 876 -> (-124) -> [ ] -> (-231) -> [ ], Problem b1: [ ] -> (-12) -> [ ] -> (+36) -> 78, Problem b2: [ ] -> (-276) -> 600 -> (-38) -> [ ], Cropped Printed Workbook Origin and Bleed-Through Text, Bai 310 Math Workbook Screenshot, Exercise Prompt: Dien so thich hop vao o trong, Section a: Forward-Chaining Arithmetic Diagrams (+2 more)

### Community 38 - "Mesh Catalog Pipeline Issues"
Cohesion: 0.24
Nodes (11): Issue 01: 3D Mesh Catalog Schema & @gltf-transform Scanner CLI, MeshCatalog & MeshCatalogItem Types (src/data/meshCatalogTypes.ts), Model Scanner (@gltf-transform NodeIO, scripts/modelScanner.ts), AssetRepository prefab:* Lazy Loading & Geometry/Material Sharing, instantiatePrefab() & Auto Obstacle Radius Registration, Issue 03: Prefab Catalog Integration into AssetRepository & Client, PrefabCatalog Singleton & Placeholder Fallback (src/world/assets/PrefabCatalog.ts), Issue 04: PROCEDURAL_SANCTUARY Dynamic Island Builder from Catalog (+3 more)

### Community 39 - "Scene Isolation & Prefab Slicing"
Cohesion: 0.20
Nodes (8): scan3dModels CLI (npm run scan:models), Issue 02: Prefab Slicer CLI & Normalized Standalone GLB Exporter, slicePrefabs CLI (npm run slice:prefabs), Eager All-in-One Scene Bottleneck, Region Partitioning Boundaries (CORE_VILLAGE_GARDEN & Lazy Regions), Zone Scene Isolation & Portal Loading Technical Report, VRAM LRU Policy & Workbox 3d-models-cache Expansion, WorldRegion Controller Descriptor

### Community 40 - "Deep Modules & MVP QA"
Cohesion: 0.18
Nodes (9): Tiến Trình Thám Hiểm (Adventure Progress), Túi Đồ Dũng Sĩ (Explorer Inventory), Nông Sản Thu Hoạch (Farmstead Produce), Nút Tương Tác (Interact Button), Adventure Deep Module, AudioAdapter Deep Module, QuizSession Deep Module, MVP QA & Browser Verification Status (+1 more)

### Community 41 - "Farm Countryside & Animal Rescue"
Cohesion: 0.21
Nodes (6): Khu Chuồng Trại Trung Tâm (Central Farm Pen), Động Vật Xổng Chuồng (Escaped Farm Animal), Bản Mẫu Nông Trại (FARM_SANCTUARY), Cánh Đồng Tự Do (Free-Range Pasture), Cổng Gỗ Đồng Quê (Rustic Farm Gate), Chòi Trú Ẩn Theo Loài (Species Shelter)

### Community 42 - "classifyZoneTemplate"
Cohesion: 0.21
Nodes (21): classifyZoneTemplate(), buildFarmTrackerSources(), ensureWorld(), getActiveFarmZone(), handlePortalAction(), hideLoadingOverlay(), interactAction(), onNeedRefresh() (+13 more)

### Community 43 - "TypeScript Compiler Config"
Cohesion: 0.17
Nodes (11): compilerOptions, allowImportingTsExtensions, lib, module, moduleResolution, noEmit, skipLibCheck, strict (+3 more)

### Community 44 - "Procedural Land Builder Spec"
Cohesion: 0.25
Nodes (7): 4 Headless Node.js Testing Seams, Technical Spec: 3D Mesh Catalog, Prefab Slicer & Procedural Land Builder, 3D Mesh Catalog & Procedural Land Builder Design Guide, MeshCatalogItem Schema & Heuristic Semantic Classifier, Prefab Slicer & Coordinate/Pivot Baking, ProceduralLandBuilder (PROCEDURAL_SANCTUARY), Google Sheets Teacher Island Workflow (ZONES & PROBLEMS)

### Community 45 - "Vương Quốc Học Toán 3D — Game Design Document (Remake v2.0)"
Cohesion: 0.18
Nodes (11): Change log, Core loop, Decisions, Direction, Feature index, Milestones, Open questions, Pillars (+3 more)

### Community 46 - "WorldSession Port Interfaces"
Cohesion: 0.12
Nodes (3): WorldLaunchOptions, WorldSessionAdventurePort, WorldSessionPorts

### Community 47 - "ProceduralLandBuilder Implementation"
Cohesion: 0.23
Nodes (5): computeProceduralPortalAnchors(), ProceduralLandBuilder, proceduralLandBuilder, ProceduralLandResult, Obstacle

### Community 48 - "Archimedes Archipelago & Cozy Lake"
Cohesion: 0.22
Nodes (8): Đền Cổng Archimedes (Archimedes Gatehouse), Vùng Đất Luyện Tập Archimedes (Archimedes Trial Grounds), Địa Hình Hồ Yên Bình (Cozy Lake Terrain), Cổng Hào Quang Năng Động (Dynamic Portal Arch), Bia Đá Tri Thức (Knowledge Monolith), Ốc Đảo Chuyên Đề (Thematic Zone Sanctuary), Bản Đồ Thử Thách (Trial Map), Rune Crystal Beacons & Sky Beams

### Community 49 - "Spatial Bounds & Deferred Spawn"
Cohesion: 0.24
Nodes (3): Tọa Độ Thám Hiểm Lưu Lại (Saved Adventure Coordinates), SpatialWorld Deep Module, Shared Lake Land Descriptor

### Community 51 - "three"
Cohesion: 0.12
Nodes (14): three, MeshCatalog, MeshCatalogItem, AssetRepositoryOptions, createBrowserTransport(), HeadlessTransportError, AssetPostProcessOptions, AssetRepositorySeam (+6 more)

### Community 52 - "Modular FarmAnimalEntity"
Cohesion: 0.21
Nodes (5): AnimalKind, AnimalPart, FarmAnimalEntity, getSharedAnimalHitbox(), getSharedBeaconResources()

### Community 53 - "3D Prefab & Safety Clearing"
Cohesion: 0.31
Nodes (6): Bộ Khảo Sát Mô Hình 3D (3D Mesh Catalog), Phân Loại Ngữ Nghĩa 3D (3D Semantic Classification), Bản Mẫu Vùng Đất Tùy Biến (PROCEDURAL_SANCTUARY), Mảnh Ghép Mô Hình (Prefab Mesh / Standalone GLB), Bộ Cắt Tách Mô Hình (Prefab Slicer CLI), PrefabCatalog & AssetRepository Lazy VRAM Sharing

### Community 54 - "Park Sanctuary & Tree Awakening"
Cohesion: 0.25
Nodes (5): Công Viên Xanh (Green Park Sanctuary), Cây Tri Thức (Knowledge Tree), Park Sanctuary Template (PARK_SANCTUARY), Starter Village Park Portal, Multi-Park Destination Picker Dialog

### Community 55 - "settings"
Cohesion: 0.20
Nodes (14): getExplorerProfile(), saveExplorerProfile(), getCharacter(), applyRestoredPlayer(), initWelcomeProfile(), menu(), openRestorePasscodeDialog(), settings() (+6 more)

### Community 56 - "Apps Script Setup & Players Roster"
Cohesion: 0.29
Nodes (5): seedFullKingdomDatabase, Google Apps Script Setup & Authoring Guide, Mã Thám Hiểm (Explorer Passcode), Bản Khởi Tạo Toàn Diện (Full Kingdom Seed), Sổ Theo Dõi Người Chơi (Players Roster / Tab PLAYERS)

### Community 57 - "PWA Offline & Brand Assets"
Cohesion: 0.25
Nodes (4): Mô Hình Đồng Hành 3D (3D Companion Model), Biểu Tượng Vương Quốc (Kingdom Brand Mark), Multi-Scale PWA & Brand Icon Pipeline, index.html Application Entry Shell

### Community 58 - "QHMJ Design & Jump-Pad Graph"
Cohesion: 0.32
Nodes (5): 12 JumpLink Graph (10 GLB + 2 Synthetic Pads), QHMJ Landmarks (Gears, Giant Clock, Fans, Forest, Castle), QHMJ_SANCTUARY (map_qhmj.glb), QHMJ_SANCTUARY Interactions & Dynamic Questions Research Doc, RoadSurface 5 Road Islands & Overpass Overlap

### Community 59 - "prefabSlicer.ts"
Cohesion: 0.16
Nodes (11): @gltf-transform/core, @gltf-transform/extensions, sliceCatalogItem(), SliceOptions, slicePrefabs(), SliceResult, main(), parseEnvFile() (+3 more)

### Community 60 - "openArchimedesMapDialog"
Cohesion: 0.26
Nodes (13): getArchimedesSolvedCount(), challengeDialog, closeDialog(), getThemeBadgeIcon(), help(), learn(), openArchimedesMapDialog(), openDialog() (+5 more)

### Community 61 - "adventure.ts"
Cohesion: 0.10
Nodes (21): AdventureListener, CrossingDelta, defaultStorage, EntitySolveDelta, FlowerBloomDelta, MonolithActivationDelta, ParkTreeAwakenDelta, QuizProgressDelta (+13 more)

### Community 62 - "Cross-Design Portal & QHMJ Links"
Cohesion: 0.29
Nodes (5): Namespaced QHMJ Progress, Zone Badges (>5) & SaveState.position.y, 3-Source QHMJ Question Pipeline (Sheets, Apps Script, Fallback), anchorQhmjProblemsToSurface 3D Placement, Deferred Spawn (ADR 0007) & Unloaded Map Dialog Fallbacks, Portal Loading Lifecycle & Anti-Flicker Transition

### Community 63 - "scripts"
Cohesion: 0.18
Nodes (11): scripts, build, build:apps-script, build:baochau, dev, generate:icons, preview, scan:models (+3 more)

### Community 64 - "Multi-Slot Question Inputs"
Cohesion: 0.40
Nodes (4): Ký Tự Phân Tách Đáp Án (Answer Slot Delimiter), Ô Nhập Giá Trị (Input Slot), Câu Hỏi Nhiều Ô Nhập (Multi-Slot Question), parseAnswer Multi-Slot Parser

### Community 66 - "engine.ts"
Cohesion: 0.38
Nodes (8): TABLES, generateQuestion(), getHint(), makeQuestion(), Option, recordAnswer(), shuffle(), validateAnswer()

### Community 67 - "Numbers & Schema"
Cohesion: 0.33
Nodes (6): A. Sheet `CONFIG` (Sổ Đăng Ký Vùng Đất — 18 cột), B. Sheet Câu Hỏi (`Zone Quest Sheets` — 18 cột), C. Sheet `PLAYERS` (15 cột — Tương thích ngược 14 cột v1), D. Sheet `LOGS` (10 cột — Tương thích ngược 9 cột v1), E. Cấu trúc `SaveState v2` (Client), Numbers & Schema

### Community 68 - "Farm Asset Attribution & Save Key"
Cohesion: 0.40
Nodes (3): moorhuhn kart 2 farm (CC-BY-4.0 Asset), LocalStorage Save Key (aigame3d_multiplication_save), Vương Quốc Học Toán 3D Project README

### Community 70 - "Google Sheets v2 & SaveState v2 Specification"
Cohesion: 0.25
Nodes (4): Edge cases, Google Sheets v2 & SaveState v2 Specification, History, Rules

### Community 76 - "C. Danh mục Vật Phẩm & Cửa Hàng (`SHOP_CATALOG`)"
Cohesion: 0.25
Nodes (8): 1. Hiệu Ứng Bước Chân (Trails — Mua 1 lần, trang bị vĩnh viễn), 2. Bùa Trợ Thủ (Charms — Tiêu hao, tối đa 99 cái/loại), 3. Nông Sản Thu Hoạch (Produce — Chỉ nhận từ Nông Trại, bán/đổi tại Tiệm), 4. Trang Trí Làng & Phụ Kiện (`later` — Scope mở rộng), A. Bảng phần thưởng (Reward Matrix), B. Đường cong 20 Cấp Độ (Level 1 → Level 20), C. Danh mục Vật Phẩm & Cửa Hàng (`SHOP_CATALOG`), Numbers

### Community 77 - "archimedes_trial_map.test.ts"
Cohesion: 0.43
Nodes (6): ARCHIMEDES_MONOLITHS, ARCHIMEDES_ZONES, ArchimedesMonolith, ArchimedesZone, getMonolithById(), getMonolithsByZone()

### Community 79 - "World Style, Lighting, Unified Camera & Region Plugins"
Cohesion: 0.33
Nodes (5): Edge cases, History, Numbers, Rules, World Style, Lighting, Unified Camera & Region Plugins

### Community 80 - "Progression, Economy & Item Catalog"
Cohesion: 0.40
Nodes (5): Edge cases, History, Open questions, Progression, Economy & Item Catalog, Rules

### Community 81 - "Rules"
Cohesion: 0.40
Nodes (5): Edge cases, History, Numbers, Rules, UI/UX Shell, HUD & Unified Challenge Modal

## Ambiguous Edges - Review These
- `Cropped Printed Workbook Origin and Bleed-Through Text` → `Bai 310 Math Workbook Screenshot`  [AMBIGUOUS]
  public/Screenshot 2026-09-27 160421.png · relation: conceptually_related_to

## Knowledge Gaps
- **29 isolated node(s):** `Cây Hoa Thử Thách (Challenge Flower)`, `Bùa Trợ Thủ Toán Học (Math Helper Charm)`, `Hiệu Ứng Bước Chân (Trail Footstep Effect)`, `Nhân Vật Đồng Hành (Companion Avatar)`, `Chức Danh Khám Phá (Explorer Title)` (+24 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 403 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **19 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `World` connect `3D Primitives & Park Loading` to `AudioManager`, `Challenge Dialog & Sessions`, `QhmjRegion.ts`, `PlayerAvatar`, `Region Activation & Teleportation`, `.syncRenderLoopState`, `World.ts`, `.burst`, `World Style, Lighting, Unified Camera & Region Plugins`, `SpatialWorld Kinematics & Collision`, `Farm Sanctuary Animal Spawning`, `HUD Frame Presentation`, `SceneBatchPool & Particle Effects`, `.renderDynamicZones`, `RemoteZoneConfig`?**
  _High betweenness centrality (0.107) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `Adventure` (e.g. with `Rules` and `Milestones`) actually correct?**
  _`Adventure` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Cây Hoa Thử Thách (Challenge Flower)`, `Bùa Trợ Thủ Toán Học (Math Helper Charm)`, `Hiệu Ứng Bước Chân (Trail Footstep Effect)` to the rest of the system?**
  _29 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `main.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07459677419354839 - nodes in this community are weakly interconnected._
- **Why does `three` connect `three` to `Challenge Dialog & Sessions`, `QhmjRegion.ts`, `Farm Sanctuary & Terrain`, `Farm Guidance & Tracker HUD`, `Bao Chau 3D Model Builder`, `Region Scene Isolation Tests`, `World.ts`, `ref_node_assert`, `Vite PWA & Build Config`, `SceneBatchPool.ts`, `ProceduralLandBuilder Implementation`, `Modular FarmAnimalEntity`, `qhmj_road.test.ts`, `3D Model Scanner CLI`, `prefabSlicer.ts`?**
  _High betweenness centrality (0.077) - this node is a cross-community bridge._
- **Should `Challenge Dialog & Sessions` be split into smaller, more focused modules?**
  _Cohesion score 0.05303392259913999 - nodes in this community are weakly interconnected._

### Low-confidence Hints
_AMBIGUOUS edges — the extractor was unsure. Verify before acting on these._

- **What is the exact relationship between `Cropped Printed Workbook Origin and Bleed-Through Text` and `Bai 310 Math Workbook Screenshot`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._