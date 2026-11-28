# Graph Report - vuong-quoc-cuu-chuong-3d  (2026-11-28)

## Corpus Check
- 157 files · ~219,535 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 211 file(s) not represented in the graph (top: .glb 188, .bin 9, .gltf 9)
- WARNING: 211 of 371 files seen (57%) have no supported extractor and are missing from this graph entirely. It may look complete while representing only part of the codebase.

## Summary
- 1659 nodes · 4254 edges · 85 communities (68 shown, 17 thin omitted)
- Extraction: 93% EXTRACTED · 7% INFERRED · 0% AMBIGUOUS · INFERRED: 287 edges (avg confidence: 0.86)
- Token cost: 287,380 input · 154,182 output

## Graph Freshness
- Built from commit: `c46f67a2`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- main.ts
- ChallengeDialog
- qhmj_road.test.ts
- PlayerAvatar
- Farm Sanctuary & Terrain
- Farm Guidance & Tracker HUD
- RemoteProblem
- Bao Chau 3D Model Builder
- SyncManager
- Adventure Progression & Rewards
- lakeLand.ts
- ref_node_assert
- Vite PWA & Build Config
- Google Sheets Client & Cache
- ref_node_assert
- 3D Primitives & Park Loading
- RemoteProblem
- SpatialWorld Kinematics & Collision
- WorldSession Handle & Sync
- FarmSanctuary
- HUD Frame Presentation
- profile.ts
- Player Sync Design & Issues
- GitHub Pages Deploy Workflow
- Portal Links & Hub Overlap
- SceneBatchPool & Particle Effects
- 3D Model Scanner CLI
- farm_race_logic.test.ts
- session.ts
- Apps Script Generator Tests
- RemoteZoneConfig
- ChallengeSession
- ref_node_fs
- Starter Village & Core Gameplay
- Sheets CMS & Batch Ingestion
- Bai 310 Workbook Screenshot
- Region Activation & Teleportation
- Mesh Catalog Pipeline Issues
- Scene Isolation & Prefab Slicing
- Deep Modules & MVP QA
- Farm Countryside & Animal Rescue
- FarmRaceHud
- TypeScript Compiler Config
- Procedural Land Builder Spec
- Vương Quốc Học Toán 3D — Game Design Document (Remake v2.0)
- World.ts
- portal_stuck_and_hub_overlap.test.ts
- Archimedes Archipelago & Cozy Lake
- Spatial Bounds & Deferred Spawn
- AssetRepository
- three
- .renderFrame
- 3D Prefab & Safety Clearing
- Park Sanctuary & Tree Awakening
- engine.ts
- Apps Script Setup & Players Roster
- PWA Offline & Brand Assets
- QHMJ Design & Jump-Pad Graph
- ChallengeDialog.ts
- .constructor
- ShopModal.ts
- Cross-Design Portal & QHMJ Links
- AssetRepositorySeam
- Multi-Slot Question Inputs
- Multi-Step Challenge Stepper
- FarmRaceArena.ts
- Numbers & Schema
- Farm Asset Attribution & Save Key
- ScreenStack
- Google Sheets v2 & SaveState v2 Specification
- Touch Wheel Direct Locomotion
- Manual Hot Sync Triggers
- C. Danh mục Vật Phẩm & Cửa Hàng (`SHOP_CATALOG`)
- .constructor
- World Style, Lighting, Unified Camera & Region Plugins
- Progression, Economy & Item Catalog
- Rules
- scripts
- FarmColliderGrid
- WorldSessionAdventurePort

## God Nodes (most connected - your core abstractions)
1. `World` - 98 edges
2. `Adventure` - 74 edges
3. `SpatialWorld` - 71 edges
4. `RemoteProblem` - 45 edges
5. `ChallengeDialog` - 40 edges
6. `RemoteZoneConfig` - 39 edges
7. `FarmSanctuary` - 37 edges
8. `WorldHandle` - 35 edges
9. `AssetRepository` - 35 edges
10. `FarmRaceArena` - 33 edges

## Surprising Connections (you probably didn't know these)
- `Rules` --references--> `World`  [INFERRED]
  docs/features/world-style-camera/design.md → src/world/World.ts
- `Edge cases` --references--> `AssetRepository`  [INFERRED]
  docs/features/world-style-camera/design.md → src/world/assets/AssetRepository.ts
- `Edge cases` --references--> `ScreenStack`  [INFERRED]
  docs/features/ui-ux-shell/design.md → src/ui/ScreenStack.ts
- `Edge cases` --references--> `sanitizeRemoteZones()`  [INFERRED]
  docs/features/google-sheets-v2/design.md → src/core/sheetsClient.ts
- `Rules` --references--> `WorldSession`  [INFERRED]
  docs/features/ui-ux-shell/design.md → src/boot/WorldSession.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Four Deep Modules Game Decomposition** — docs_adr_0001_four_deep_modules_four_deep_modules_architecture, docs_adr_0001_four_deep_modules_adventure, docs_adr_0001_four_deep_modules_quizsession, docs_adr_0001_four_deep_modules_spatialworld, docs_adr_0001_four_deep_modules_audioadapter [EXTRACTED 1.00]
- **Offline-First Google Sheets Two-Way Player Sync Architecture** — _scratch_sheets_player_sync_issues_01_sheets_players_schema_and_apps_script_api_playerssheetschema, _scratch_sheets_player_sync_issues_02_explorer_passcode_generator_and_recovery_passcodegenerator, _scratch_sheets_player_sync_issues_03_union_max_sync_and_throttled_queue_mergestatesunionmax, _scratch_sheets_player_sync_issues_04_local_storage_migration_and_cloud_status_ui_runlocalstoragemigration [EXTRACTED 1.00]
- **4-Tier 3D Mesh Catalog to Procedural Sanctuary Pipeline** — docs_design_3d_mesh_catalog_and_custom_land_builder_meshcatalogschema, docs_design_3d_mesh_catalog_and_custom_land_builder_prefabslicer, docs_design_3d_mesh_catalog_and_custom_land_builder_vramsharingdeepclone, docs_design_3d_mesh_catalog_and_custom_land_builder_procedurallandbuilder [EXTRACTED 1.00]
- **QHMJ_SANCTUARY 3-Tier Dynamic Question & 3D Interaction System** — docs_design_qhmj_sanctuary_interactions_and_dynamic_questions_3tierelevationmodel, docs_design_qhmj_sanctuary_interactions_and_dynamic_questions_qhmjquestionsources, docs_design_qhmj_sanctuary_interactions_and_dynamic_questions_surfaceanchoring, docs_design_qhmj_sanctuary_interactions_and_dynamic_questions_3draycastandproximity [EXTRACTED 1.00]
- **Google Sheets CMS Batch Ingestion, Schedule & Sync Pipeline** — context_zone_registry, docs_adr_0003_google_sheets_backend_and_zone_templates_google_sheets_cms, docs_adr_0004_unified_batch_ingestion_and_manual_sync_unified_batch_ingestion, docs_adr_0004_unified_batch_ingestion_and_manual_sync_manual_hot_sync_triggers, docs_adr_0011_zone_unlock_schedule_zone_unlock_schedule_architecture [EXTRACTED 1.00]
- **Universal Multi-Step Challenge & 3D Entity Awakening Loop** — docs_adr_0013_standardized_multi_step_challenges_universal_stepper_architecture, context_challenge_flower, context_knowledge_monolith, context_knowledge_tree, context_escaped_farm_animal, context_multistep_awakening [EXTRACTED 1.00]

## Communities (85 total, 17 thin omitted)

### Community 0 - "main.ts"
Cohesion: 0.05
Nodes (89): AudioCue, AudioManager, classifyZoneTemplate(), generateFarmMultiplicationProblem(), getArchimedesSolvedCount(), getExplorerProfile(), saveExplorerProfile(), generateQhmjProblems() (+81 more)

### Community 1 - "ChallengeDialog"
Cohesion: 0.19
Nodes (3): ChallengeDialog, ChallengeOutcome, ChallengeSpec

### Community 2 - "qhmj_road.test.ts"
Cohesion: 0.06
Nodes (55): computeQhmjAnchors(), QHMJ_HIDDEN_NODE_PATTERNS, QHMJ_REGION_RADIUS, QHMJ_RETURN_PORTAL_LOCAL, QHMJ_ROAD_MESH_NAME, QHMJ_SCALE, QHMJ_SPAWN_LOCAL, QHMJ_SPEED (+47 more)

### Community 4 - "Farm Sanctuary & Terrain"
Cohesion: 0.12
Nodes (25): computeFarmAnchors(), FARM_ANIMAL_ANCHORS_LOCAL, FARM_DIRECT_HOMEWARD_MAX_DIST, FARM_FENCE_MATERIALS, FARM_GROUND_MATERIALS, FARM_PEN_CENTER_LOCAL, FARM_PEN_ENTRY_LOCAL, FARM_PEN_EXCLUSION_RADIUS (+17 more)

### Community 5 - "Farm Guidance & Tracker HUD"
Cohesion: 0.07
Nodes (31): FARM_RETURN_PORTAL_LOCAL, FarmTrackerHud, FarmTrackerHudOptions, FarmTrackerSyncParams, CAMERA_ZOOM_LIMITS, CameraDistanceLimits, CameraZoomMode, clamp() (+23 more)

### Community 6 - "RemoteProblem"
Cohesion: 0.23
Nodes (4): CachedRemotePayload, RemoteProblem, RemoteZoneConfig, Obstacle

### Community 7 - "Bao Chau 3D Model Builder"
Cohesion: 0.14
Nodes (31): addMesh(), boxBetween(), buildArm(), buildBody(), buildCharacter(), buildGlasses(), buildHair(), buildHead() (+23 more)

### Community 8 - "SyncManager"
Cohesion: 0.11
Nodes (14): Milestones, defaultStorage, profileManager, SaveState, formatTimeAgo(), getSyncStatusLabel(), hasLocalProgress(), mergeStates() (+6 more)

### Community 9 - "Adventure Progression & Rewards"
Cohesion: 0.13
Nodes (3): Adventure, entityKey(), getLevel()

### Community 10 - "lakeLand.ts"
Cohesion: 0.14
Nodes (25): resolveZoneProblemsWithPositions(), computeLakeAnchors(), computeLakeEntityPositions(), createLakeLand(), isValidLakePosition(), isWithinLakeLand(), LAKE_ARRIVAL_OFFSET, LAKE_FALLBACK_RADIUS (+17 more)

### Community 11 - "ref_node_assert"
Cohesion: 0.09
Nodes (25): AdventureListener, CrossingDelta, defaultStorage, EntitySolveDelta, FlowerBloomDelta, MonolithActivationDelta, ParkTreeAwakenDelta, QuizProgressDelta (+17 more)

### Community 12 - "Vite PWA & Build Config"
Cohesion: 0.10
Nodes (25): dependencies, three@^0.180.0, devDependencies, @gltf-transform/core@^4.5.1, @gltf-transform/extensions@^4.5.1, @gltf-transform/functions@^4.5.1, sharp@^0.35.5, tsx@^4.20.5 (+17 more)

### Community 13 - "Google Sheets Client & Cache"
Cohesion: 0.12
Nodes (28): extractMarkdownImage(), resolveImageUrl(), APPS_SCRIPT_URL_KEY, DEFAULT_APPS_SCRIPT_URL, fetchRemoteData(), getAppsScriptUrl(), getBundledFallbackData(), getCachedRemoteData() (+20 more)

### Community 14 - "ref_node_assert"
Cohesion: 0.11
Nodes (15): three, BRIDGE_PARTS, Avatar3DId, BaoChauRig, ElsaArmRig, PlayerAvatarOptions, BatchTemplateOptions, SPARK_COLORS (+7 more)

### Community 16 - "RemoteProblem"
Cohesion: 0.08
Nodes (8): AnimalKind, AnimalPart, FarmAnimalEntity, getSharedAnimalHitbox(), getSharedBeaconResources(), FarmRaceArena, FarmRaceEngine, FarmRaceTrack

### Community 17 - "SpatialWorld Kinematics & Collision"
Cohesion: 0.09
Nodes (5): computeFarmRaceAnchors(), evalJumpArc(), SpatialWorld, buildFarmPortalLinks(), buildFarmRacePortalLinks()

### Community 19 - "FarmSanctuary"
Cohesion: 0.21
Nodes (3): isInsideFarmPenLocal(), isWithinFarmPlayableBoundsLocal(), FarmSanctuary

### Community 20 - "HUD Frame Presentation"
Cohesion: 0.15
Nodes (10): formatPortalOverlay(), HudPresenter, PortalOverlayInfo, FloatingLabelPose, HudPresentationState, HudSnapshotContext, PortalSummary, PresentationPresenterSeam (+2 more)

### Community 21 - "profile.ts"
Cohesion: 0.17
Nodes (12): EXPLORER_PROFILE_KEY, ExplorerProfileManager, FRIENDLY_NICKNAMES, generateExplorerId(), generateExplorerPasscode(), memoryStore, normalizePasscode(), PASSCODE_ALPHABET (+4 more)

### Community 22 - "Player Sync Design & Issues"
Cohesion: 0.18
Nodes (14): Client Cloud Endpoints (savePlayerProgressToSheets & loadPlayerProgressFromSheets), Issue 01: Google Sheets PLAYERS Schema & Apps Script API, PLAYERS Tab 14-Column Schema, ExplorerProfileManager Auto-Provisioning, Issue 02: Explorer Passcode Generator & Cross-Device Recovery, Recovery Modal & applyRestoredPlayer() 3D Sync, Issue 03: Union-Max Conflict Resolution & Throttled Sync Queue, Topbar #cloud-status-btn & Settings Cloud Management UI (+6 more)

### Community 23 - "GitHub Pages Deploy Workflow"
Cohesion: 0.07
Nodes (31): runs-on, steps, concurrency, cancel-in-progress, group, environment, needs, runs-on (+23 more)

### Community 24 - "Portal Links & Hub Overlap"
Cohesion: 0.13
Nodes (14): FARM_FENCE_JUMP_CLEARANCE, FARM_PLAYABLE_BOUNDS, FARM_REGION_RADIUS, DEFAULT_LAKE_SANCTUARIES, FLOWER_COORDS, PlayerPose, QhmjNodeAnchor, ROAD_SLIDE_ANGLES (+6 more)

### Community 25 - "SceneBatchPool & Particle Effects"
Cohesion: 0.10
Nodes (3): ArchimedesZoneBuilder, MonolithItem, SceneBatchPool

### Community 26 - "3D Model Scanner CLI"
Cohesion: 0.15
Nodes (21): CHARACTER_MODEL_FOLDERS, classifyMeshSemantic(), computeEntityGeometry(), EntityTarget, extractMaterials(), find3DModelFiles(), identifyEntitiesInDocument(), isCharacterModelPath() (+13 more)

### Community 28 - "farm_race_logic.test.ts"
Cohesion: 0.09
Nodes (30): FARM_RAW_OFFSET, FARM_SPEED, FarmAnimalKind, FARM_RACE_ANIMALS, FARM_RACE_BOOST_DURATION_SEC, FARM_RACE_BOOST_SPEED, FARM_RACE_CAMERA_DEFAULTS, FARM_RACE_FIRST_TRY_BOOST_SEC (+22 more)

### Community 29 - "session.ts"
Cohesion: 0.14
Nodes (20): ARCHIMEDES_MONOLITHS, ARCHIMEDES_ZONES, ArchimedesMonolith, ArchimedesStep, ArchimedesZone, getMonolithById(), getMonolithsByZone(), FLOWER_QUESTIONS (+12 more)

### Community 30 - "Apps Script Generator Tests"
Cohesion: 0.13
Nodes (3): FakeSheet, FakeSpreadsheet, source

### Community 31 - "RemoteZoneConfig"
Cohesion: 0.09
Nodes (8): RemoteContentPayload, RemoteContentSnapshot, WorldLaunchOptions, WorldSessionPorts, WorldSession, zoneCountsForBadges(), zoneSpawnsMonoliths(), ZoneTemplateKind

### Community 32 - "ChallengeSession"
Cohesion: 0.16
Nodes (6): ChallengeSession, checkSlotMatch(), createArchimedesChallenge(), createFlowerChallenge(), createMultiplicationChallenge(), parseAnswer()

### Community 33 - "ref_node_fs"
Cohesion: 0.16
Nodes (10): @gltf-transform/core, @gltf-transform/extensions, sliceCatalogItem(), SliceOptions, slicePrefabs(), SliceResult, main(), parseEnvFile() (+2 more)

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

### Community 42 - "FarmRaceHud"
Cohesion: 0.21
Nodes (5): FarmRaceHud, FarmRaceHudOptions, getRankBadgeText(), FarmRaceHudSnapshot, FarmRaceLeaderboardEntry

### Community 43 - "TypeScript Compiler Config"
Cohesion: 0.17
Nodes (11): compilerOptions, allowImportingTsExtensions, lib, module, moduleResolution, noEmit, skipLibCheck, strict (+3 more)

### Community 44 - "Procedural Land Builder Spec"
Cohesion: 0.25
Nodes (7): 4 Headless Node.js Testing Seams, Technical Spec: 3D Mesh Catalog, Prefab Slicer & Procedural Land Builder, 3D Mesh Catalog & Procedural Land Builder Design Guide, MeshCatalogItem Schema & Heuristic Semantic Classifier, Prefab Slicer & Coordinate/Pivot Baking, ProceduralLandBuilder (PROCEDURAL_SANCTUARY), Google Sheets Teacher Island Workflow (ZONES & PROBLEMS)

### Community 45 - "Vương Quốc Học Toán 3D — Game Design Document (Remake v2.0)"
Cohesion: 0.20
Nodes (10): Change log, Core loop, Decisions, Direction, Feature index, Open questions, Pillars, Screens and flow (+2 more)

### Community 46 - "World.ts"
Cohesion: 0.18
Nodes (11): FARM_CAMERA_DEFAULTS, FARM_VILLAGE_PORTAL, FARM_VILLAGE_RETURN_TARGET, FARM_RACE_BASE_SPEED, FARM_RACE_REGION_RADIUS, QHMJ_VILLAGE_PORTAL, FlowerItem, ParkTreeEntity (+3 more)

### Community 47 - "portal_stuck_and_hub_overlap.test.ts"
Cohesion: 0.29
Nodes (8): allocateDynamicHubPortalSlot(), computePortalPillarObstacles(), DYNAMIC_HUB_CANDIDATE_COORDS, HubPortalSlot, isWithinPortalKeepOut(), STATIC_HUB_PORTAL_POSITIONS, PORTAL_LINKS, PortalLink

### Community 48 - "Archimedes Archipelago & Cozy Lake"
Cohesion: 0.22
Nodes (8): Đền Cổng Archimedes (Archimedes Gatehouse), Vùng Đất Luyện Tập Archimedes (Archimedes Trial Grounds), Địa Hình Hồ Yên Bình (Cozy Lake Terrain), Cổng Hào Quang Năng Động (Dynamic Portal Arch), Bia Đá Tri Thức (Knowledge Monolith), Ốc Đảo Chuyên Đề (Thematic Zone Sanctuary), Bản Đồ Thử Thách (Trial Map), Rune Crystal Beacons & Sky Beams

### Community 49 - "Spatial Bounds & Deferred Spawn"
Cohesion: 0.24
Nodes (3): Tọa Độ Thám Hiểm Lưu Lại (Saved Adventure Coordinates), SpatialWorld Deep Module, Shared Lake Land Descriptor

### Community 50 - "AssetRepository"
Cohesion: 0.20
Nodes (4): AssetRepository, createBrowserTransport(), AssetKey, AssetPostProcessOptions

### Community 51 - "three"
Cohesion: 0.36
Nodes (6): MeshCatalog, MeshCatalogItem, AssetRepositoryOptions, HeadlessTransportError, AssetTransportAdapter, PrefabInstanceResult

### Community 53 - "3D Prefab & Safety Clearing"
Cohesion: 0.31
Nodes (6): Bộ Khảo Sát Mô Hình 3D (3D Mesh Catalog), Phân Loại Ngữ Nghĩa 3D (3D Semantic Classification), Bản Mẫu Vùng Đất Tùy Biến (PROCEDURAL_SANCTUARY), Mảnh Ghép Mô Hình (Prefab Mesh / Standalone GLB), Bộ Cắt Tách Mô Hình (Prefab Slicer CLI), PrefabCatalog & AssetRepository Lazy VRAM Sharing

### Community 54 - "Park Sanctuary & Tree Awakening"
Cohesion: 0.25
Nodes (5): Công Viên Xanh (Green Park Sanctuary), Cây Tri Thức (Knowledge Tree), Park Sanctuary Template (PARK_SANCTUARY), Starter Village Park Portal, Multi-Park Destination Picker Dialog

### Community 55 - "engine.ts"
Cohesion: 0.38
Nodes (8): TABLES, generateQuestion(), getHint(), makeQuestion(), Option, recordAnswer(), shuffle(), validateAnswer()

### Community 56 - "Apps Script Setup & Players Roster"
Cohesion: 0.29
Nodes (5): seedFullKingdomDatabase, Google Apps Script Setup & Authoring Guide, Mã Thám Hiểm (Explorer Passcode), Bản Khởi Tạo Toàn Diện (Full Kingdom Seed), Sổ Theo Dõi Người Chơi (Players Roster / Tab PLAYERS)

### Community 57 - "PWA Offline & Brand Assets"
Cohesion: 0.25
Nodes (4): Mô Hình Đồng Hành 3D (3D Companion Model), Biểu Tượng Vương Quốc (Kingdom Brand Mark), Multi-Scale PWA & Brand Icon Pipeline, index.html Application Entry Shell

### Community 58 - "QHMJ Design & Jump-Pad Graph"
Cohesion: 0.32
Nodes (5): 12 JumpLink Graph (10 GLB + 2 Synthetic Pads), QHMJ Landmarks (Gears, Giant Clock, Fans, Forest, Castle), QHMJ_SANCTUARY (map_qhmj.glb), QHMJ_SANCTUARY Interactions & Dynamic Questions Research Doc, RoadSurface 5 Road Islands & Overpass Overlap

### Community 59 - "ChallengeDialog.ts"
Cohesion: 0.09
Nodes (18): RemoteStep, ChallengeDialogHost, closeLightbox(), icons, isLightboxOpen(), openLightbox(), renderQuestionImage(), UnifiedStepViewOptions (+10 more)

### Community 61 - "ShopModal.ts"
Cohesion: 0.15
Nodes (9): getPurchasableShopItems(), getShopItem(), getShopItemsByType(), ItemRarity, SHOP_CATALOG, ShopItem, ShopItemType, ShopModal (+1 more)

### Community 62 - "Cross-Design Portal & QHMJ Links"
Cohesion: 0.29
Nodes (5): Namespaced QHMJ Progress, Zone Badges (>5) & SaveState.position.y, 3-Source QHMJ Question Pipeline (Sheets, Apps Script, Fallback), anchorQhmjProblemsToSurface 3D Placement, Deferred Spawn (ADR 0007) & Unloaded Map Dialog Fallbacks, Portal Loading Lifecycle & Anti-Flicker Transition

### Community 63 - "AssetRepositorySeam"
Cohesion: 0.11
Nodes (6): AssetRepositorySeam, computeProceduralPortalAnchors(), ProceduralLandBuilder, proceduralLandBuilder, ProceduralLandResult, Obstacle

### Community 64 - "Multi-Slot Question Inputs"
Cohesion: 0.40
Nodes (4): Ký Tự Phân Tách Đáp Án (Answer Slot Delimiter), Ô Nhập Giá Trị (Input Slot), Câu Hỏi Nhiều Ô Nhập (Multi-Slot Question), parseAnswer Multi-Slot Parser

### Community 66 - "FarmRaceArena.ts"
Cohesion: 0.29
Nodes (7): FARM_SCALE, FARM_SKY_MATERIALS, FARM_RACE_START_LOCAL, GateVisual, CheckpointStatus, FarmRaceTickResult, RaceCheckpointState

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

### Community 79 - "World Style, Lighting, Unified Camera & Region Plugins"
Cohesion: 0.33
Nodes (5): Edge cases, History, Numbers, Rules, World Style, Lighting, Unified Camera & Region Plugins

### Community 80 - "Progression, Economy & Item Catalog"
Cohesion: 0.40
Nodes (5): Edge cases, History, Open questions, Progression, Economy & Item Catalog, Rules

### Community 81 - "Rules"
Cohesion: 0.40
Nodes (5): Edge cases, History, Numbers, Rules, UI/UX Shell, HUD & Unified Challenge Modal

### Community 82 - "scripts"
Cohesion: 0.18
Nodes (11): scripts, build, build:apps-script, build:baochau, dev, generate:icons, preview, scan:models (+3 more)

### Community 86 - "FarmColliderGrid"
Cohesion: 0.21
Nodes (5): buildFarmTerrainFromMeshTriangles(), FarmColliderGrid, FarmZoneState, loadRealFarmTerrain(), loadRealFarmTerrain()

## Ambiguous Edges - Review These
- `Cropped Printed Workbook Origin and Bleed-Through Text` → `Bai 310 Math Workbook Screenshot`  [AMBIGUOUS]
  public/Screenshot 2026-09-27 160421.png · relation: conceptually_related_to

## Knowledge Gaps
- **29 isolated node(s):** `Cây Hoa Thử Thách (Challenge Flower)`, `Bùa Trợ Thủ Toán Học (Math Helper Charm)`, `Hiệu Ứng Bước Chân (Trail Footstep Effect)`, `Nhân Vật Đồng Hành (Companion Avatar)`, `Chức Danh Khám Phá (Explorer Title)` (+24 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 424 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **17 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `three` connect `ref_node_assert` to `ref_node_fs`, `FarmRaceArena.ts`, `qhmj_road.test.ts`, `Farm Sanctuary & Terrain`, `Farm Guidance & Tracker HUD`, `RemoteProblem`, `Bao Chau 3D Model Builder`, `Region Scene Isolation Tests`, `Vite PWA & Build Config`, `World.ts`, `portal_stuck_and_hub_overlap.test.ts`, `RemoteProblem`, `three`, `3D Model Scanner CLI`, `ChallengeDialog.ts`, `farm_race_logic.test.ts`, `AssetRepositorySeam`?**
  _High betweenness centrality (0.095) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `Adventure` (e.g. with `Rules` and `Milestones`) actually correct?**
  _`Adventure` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Cây Hoa Thử Thách (Challenge Flower)`, `Bùa Trợ Thủ Toán Học (Math Helper Charm)`, `Hiệu Ứng Bước Chân (Trail Footstep Effect)` to the rest of the system?**
  _29 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `main.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0509683995922528 - nodes in this community are weakly interconnected._
- **Why does `World` connect `3D Primitives & Park Loading` to `qhmj_road.test.ts`, `PlayerAvatar`, `Region Activation & Teleportation`, `RemoteProblem`, `lakeLand.ts`, `World.ts`, `World Style, Lighting, Unified Camera & Region Plugins`, `.constructor`, `SpatialWorld Kinematics & Collision`, `FarmSanctuary`, `HUD Frame Presentation`, `.renderFrame`, `.burst`, `SceneBatchPool & Particle Effects`, `ChallengeDialog.ts`, `farm_race_logic.test.ts`, `ShopModal.ts`?**
  _High betweenness centrality (0.091) - this node is a cross-community bridge._
- **Should `qhmj_road.test.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05583308845136644 - nodes in this community are weakly interconnected._

### Low-confidence Hints
_AMBIGUOUS edges — the extractor was unsure. Verify before acting on these._

- **What is the exact relationship between `Cropped Printed Workbook Origin and Bleed-Through Text` and `Bai 310 Math Workbook Screenshot`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._