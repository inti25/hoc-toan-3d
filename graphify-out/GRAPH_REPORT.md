# Graph Report - vuong-quoc-cuu-chuong-3d  (2026-11-21)

## Corpus Check
- 146 files · ~197,047 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 211 file(s) not represented in the graph (top: .glb 188, .bin 9, .gltf 9)
- WARNING: 211 of 357 files seen (59%) have no supported extractor and are missing from this graph entirely. It may look complete while representing only part of the codebase.

## Summary
- 1423 nodes · 3663 edges · 76 communities (56 shown, 20 thin omitted)
- Extraction: 93% EXTRACTED · 7% INFERRED · 0% AMBIGUOUS · INFERRED: 258 edges (avg confidence: 0.85)
- Token cost: 287,380 input · 154,182 output

## Community Hubs (Navigation)
- App Entry, Audio & HUD
- Challenge Dialog & Sessions
- QHMJ Region & Road Surfaces
- 3D Assets & Player Avatar
- Farm Sanctuary & Terrain
- Farm Guidance & Tracker HUD
- 3D World & Monolith Rendering
- Bao Chau 3D Model Builder
- Cloud SyncManager & Migration
- Adventure Progression & Rewards
- Cozy Lake Terrain & Anchors
- Save State & Bridge Config
- Vite PWA & Build Config
- Google Sheets Client & Cache
- Test Runner & Node Imports
- Explorer Profile & Passcodes
- SpatialWorld Kinematics & Collision
- WorldSession Handle & Sync
- Farm Sanctuary Animal Spawning
- HUD Frame Presentation
- Player Interaction & Raycasting
- Player Sync Design & Issues
- GitHub Pages Deploy Workflow
- Portal Links & Hub Overlap
- SceneBatchPool & Particle Effects
- 3D Model Scanner CLI
- Dynamic Zone & Portal Building
- Farm Collider Grid & Mesh Raster
- Apps Script Generator Tests
- Remote Zone & Problem Payloads
- Kingdom Emporium & Shop Economy
- Zone Visibility & Schedule Filters
- Starter Village & Core Gameplay
- Sheets CMS & Batch Ingestion
- Bai 310 Workbook Screenshot
- Region Activation & Teleportation
- Mesh Catalog Pipeline Issues
- Scene Isolation & Prefab Slicing
- Deep Modules & MVP QA
- Farm Countryside & Animal Rescue
- WorldSession Remote Boot Sync
- TypeScript Compiler Config
- Procedural Land Builder Spec
- NPM Build & Tooling Scripts
- WorldSession Port Interfaces
- ProceduralLandBuilder Implementation
- Archimedes Archipelago & Cozy Lake
- Spatial Bounds & Deferred Spawn
- Multiplication Quiz Engine
- Mesh Catalog Type Definitions
- Modular FarmAnimalEntity
- 3D Prefab & Safety Clearing
- Park Sanctuary & Tree Awakening
- Camera Zoom & Pinch Limits
- Apps Script Setup & Players Roster
- PWA Offline & Brand Assets
- QHMJ Design & Jump-Pad Graph
- Prefab Slicer CLI
- Lake Terrain & Zone Spawn
- Archimedes Static Monolith Map
- Cross-Design Portal & QHMJ Links
- Touch PinchOrbitController
- Multi-Slot Question Inputs
- Multi-Step Challenge Stepper
- WorldSession Adventure Port
- ShopModal UI Component
- Farm Asset Attribution & Save Key
- PWA Icon Generator Script
- Google Sheets Seeder Script
- Touch Wheel Direct Locomotion
- Manual Hot Sync Triggers

## God Nodes (most connected - your core abstractions)
1. `World` - 91 edges
2. `SpatialWorld` - 68 edges
3. `Adventure` - 59 edges
4. `RemoteZoneConfig` - 37 edges
5. `ChallengeDialog` - 36 edges
6. `FarmSanctuary` - 36 edges
7. `RemoteProblem` - 35 edges
8. `WorldHandle` - 33 edges
9. `AssetRepository` - 32 edges
10. `three` - 30 edges

## Surprising Connections (you probably didn't know these)
- `3-Source QHMJ Question Pipeline (Sheets, Apps Script, Fallback)` --semantically_similar_to--> `PrefabCatalog Singleton & Placeholder Fallback (src/world/assets/PrefabCatalog.ts)`  [INFERRED] [semantically similar]
  docs/design/qhmj-sanctuary-interactions-and-dynamic-questions.md → .scratch/3d-mesh-catalog-and-land-builder/issues/03-asset-repository-integration-and-prefab-instantiation.md
- `VRAM LRU Policy & Workbox 3d-models-cache Expansion` --semantically_similar_to--> `Zero-Login Offline-First PWA Architecture`  [INFERRED] [semantically similar]
  docs/design/zone-scene-isolation-and-portal-loading.md → .scratch/sheets-player-sync/map.md
- `PWA Split Caching Strategy (vite-plugin-pwa) (ADR 0006)` --semantically_similar_to--> `Hiển Thị Đồng Hành Đệm (Progressive Avatar Rendering)`  [INFERRED] [semantically similar]
  docs/adr/0006-progressive-web-app-offline-strategy.md → CONTEXT.md
- `Resilient ProblemId Row Inheritance (fetchQuestionsFromSheet)` --semantically_similar_to--> `Bộ Lọc Phục Hồi Dữ Liệu (Resilient Data Sanitizer)`  [INFERRED] [semantically similar]
  docs/adr/0013-standardized-multi-step-challenges.md → CONTEXT.md
- `Google Sheets Serverless CMS & Apps Script API (ADR 0003)` --implements--> `Bộ Lọc Phục Hồi Dữ Liệu (Resilient Data Sanitizer)`  [EXTRACTED]
  docs/adr/0003-google-sheets-backend-and-zone-templates.md → CONTEXT.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Four Deep Modules Game Decomposition** — docs_adr_0001_four_deep_modules_four_deep_modules_architecture, docs_adr_0001_four_deep_modules_adventure, docs_adr_0001_four_deep_modules_quizsession, docs_adr_0001_four_deep_modules_spatialworld, docs_adr_0001_four_deep_modules_audioadapter [EXTRACTED 1.00]
- **Google Sheets CMS Batch Ingestion, Schedule & Sync Pipeline** — context_zone_registry, docs_adr_0003_google_sheets_backend_and_zone_templates_google_sheets_cms, docs_adr_0004_unified_batch_ingestion_and_manual_sync_unified_batch_ingestion, docs_adr_0004_unified_batch_ingestion_and_manual_sync_manual_hot_sync_triggers, docs_adr_0011_zone_unlock_schedule_zone_unlock_schedule_architecture [EXTRACTED 1.00]
- **Universal Multi-Step Challenge & 3D Entity Awakening Loop** — docs_adr_0013_standardized_multi_step_challenges_universal_stepper_architecture, context_challenge_flower, context_knowledge_monolith, context_knowledge_tree, context_escaped_farm_animal, context_multistep_awakening [EXTRACTED 1.00]
- **4-Tier 3D Mesh Catalog to Procedural Sanctuary Pipeline** — docs_design_3d_mesh_catalog_and_custom_land_builder_meshcatalogschema, docs_design_3d_mesh_catalog_and_custom_land_builder_prefabslicer, docs_design_3d_mesh_catalog_and_custom_land_builder_vramsharingdeepclone, docs_design_3d_mesh_catalog_and_custom_land_builder_procedurallandbuilder [EXTRACTED 1.00]
- **QHMJ_SANCTUARY 3-Tier Dynamic Question & 3D Interaction System** — docs_design_qhmj_sanctuary_interactions_and_dynamic_questions_3tierelevationmodel, docs_design_qhmj_sanctuary_interactions_and_dynamic_questions_qhmjquestionsources, docs_design_qhmj_sanctuary_interactions_and_dynamic_questions_surfaceanchoring, docs_design_qhmj_sanctuary_interactions_and_dynamic_questions_3draycastandproximity [EXTRACTED 1.00]
- **Offline-First Google Sheets Two-Way Player Sync Architecture** — _scratch_sheets_player_sync_issues_01_sheets_players_schema_and_apps_script_api_playerssheetschema, _scratch_sheets_player_sync_issues_02_explorer_passcode_generator_and_recovery_passcodegenerator, _scratch_sheets_player_sync_issues_03_union_max_sync_and_throttled_queue_mergestatesunionmax, _scratch_sheets_player_sync_issues_04_local_storage_migration_and_cloud_status_ui_runlocalstoragemigration [EXTRACTED 1.00]

## Communities (76 total, 20 thin omitted)

### Community 0 - "App Entry, Audio & HUD"
Cohesion: 0.06
Nodes (75): AudioCue, AudioManager, classifyZoneTemplate(), getArchimedesSolvedCount(), getExplorerProfile(), saveExplorerProfile(), generateQhmjProblems(), mulberry32() (+67 more)

### Community 1 - "Challenge Dialog & Sessions"
Cohesion: 0.08
Nodes (33): ArchimedesStep, FlowerQuestion, ChallengeDialog, closeLightbox(), icon(), icons, isLightboxOpen(), openLightbox() (+25 more)

### Community 2 - "QHMJ Region & Road Surfaces"
Cohesion: 0.06
Nodes (55): computeQhmjAnchors(), QHMJ_HIDDEN_NODE_PATTERNS, QHMJ_REGION_RADIUS, QHMJ_RETURN_PORTAL_LOCAL, QHMJ_ROAD_MESH_NAME, QHMJ_SCALE, QHMJ_SPAWN_LOCAL, QHMJ_SPEED (+47 more)

### Community 3 - "3D Assets & Player Avatar"
Cohesion: 0.07
Nodes (17): AvatarId, MeshCatalog, MeshCatalogItem, AssetRepository, AssetRepositoryOptions, createBrowserTransport(), HeadlessTransportError, AssetKey (+9 more)

### Community 4 - "Farm Sanctuary & Terrain"
Cohesion: 0.09
Nodes (39): generateFarmMultiplicationProblem(), computeFarmAnchors(), FARM_ANIMAL_ANCHORS_LOCAL, FARM_CAMERA_DEFAULTS, FARM_DIRECT_HOMEWARD_MAX_DIST, FARM_FENCE_JUMP_CLEARANCE, FARM_FENCE_MATERIALS, FARM_GROUND_MATERIALS (+31 more)

### Community 5 - "Farm Guidance & Tracker HUD"
Cohesion: 0.09
Nodes (21): FarmTrackerHud, FarmTrackerHudOptions, FarmTrackerSyncParams, buildFarmTrackerSnapshot(), BuildFarmTrackerSnapshotInput, CompassGuidance, computeCompassGuidance(), describeFarmArea() (+13 more)

### Community 6 - "3D World & Monolith Rendering"
Cohesion: 0.09
Nodes (4): MonolithItem, Obstacle, shouldRunRenderLoop(), World

### Community 7 - "Bao Chau 3D Model Builder"
Cohesion: 0.14
Nodes (31): addMesh(), boxBetween(), buildArm(), buildBody(), buildCharacter(), buildGlasses(), buildHair(), buildHead() (+23 more)

### Community 8 - "Cloud SyncManager & Migration"
Cohesion: 0.10
Nodes (14): QuestionStat, formatTimeAgo(), getSyncStatusLabel(), hasLocalProgress(), mergeStates(), MIGRATION_KEY, MigrationResult, runLocalStorageMigration() (+6 more)

### Community 9 - "Adventure Progression & Rewards"
Cohesion: 0.12
Nodes (5): Adventure, getLevel(), ChallengeDialogHost, createMockChallengePorts(), createMockChallengePorts()

### Community 10 - "Cozy Lake Terrain & Anchors"
Cohesion: 0.12
Nodes (25): WORLD, FLOWER_QUESTIONS, FlowerOption, computeLakeAnchors(), computeLakeEntityPositions(), createLakeLand(), isValidLakePosition(), isWithinLakeLand() (+17 more)

### Community 11 - "Save State & Bridge Config"
Cohesion: 0.15
Nodes (16): CrossingDelta, defaultStorage, FlowerBloomDelta, MonolithActivationDelta, ParkTreeAwakenDelta, QuizProgressDelta, freshState(), loadState() (+8 more)

### Community 12 - "Vite PWA & Build Config"
Cohesion: 0.10
Nodes (25): dependencies, three@^0.180.0, devDependencies, @gltf-transform/core@^4.5.1, @gltf-transform/extensions@^4.5.1, @gltf-transform/functions@^4.5.1, tsx@^4.20.5, @types/node@^26.6.4 (+17 more)

### Community 13 - "Google Sheets Client & Cache"
Cohesion: 0.15
Nodes (23): extractMarkdownImage(), resolveImageUrl(), APPS_SCRIPT_URL_KEY, DEFAULT_APPS_SCRIPT_URL, fetchRemoteData(), getAppsScriptUrl(), getBundledFallbackData(), getCachedRemoteData() (+15 more)

### Community 14 - "Test Runner & Node Imports"
Cohesion: 0.15
Nodes (11): three, DYNAMIC_HUB_CANDIDATE_COORDS, HubPortalSlot, BatchTemplateOptions, SPARK_COLORS, SparkSlot, StaticPlacement, TRAIL_PALETTES (+3 more)

### Community 16 - "Explorer Profile & Passcodes"
Cohesion: 0.15
Nodes (14): defaultStorage, EXPLORER_PROFILE_KEY, ExplorerProfileManager, FRIENDLY_NICKNAMES, generateExplorerId(), generateExplorerPasscode(), memoryStore, normalizePasscode() (+6 more)

### Community 19 - "Farm Sanctuary Animal Spawning"
Cohesion: 0.19
Nodes (3): isInsideFarmPenLocal(), isWithinFarmPlayableBoundsLocal(), FarmSanctuary

### Community 20 - "HUD Frame Presentation"
Cohesion: 0.15
Nodes (10): formatPortalOverlay(), HudPresenter, PortalOverlayInfo, FloatingLabelPose, HudPresentationState, HudSnapshotContext, PortalSummary, PresentationPresenterSeam (+2 more)

### Community 22 - "Player Sync Design & Issues"
Cohesion: 0.18
Nodes (14): Client Cloud Endpoints (savePlayerProgressToSheets & loadPlayerProgressFromSheets), Issue 01: Google Sheets PLAYERS Schema & Apps Script API, PLAYERS Tab 14-Column Schema, ExplorerProfileManager Auto-Provisioning, Issue 02: Explorer Passcode Generator & Cross-Device Recovery, Recovery Modal & applyRestoredPlayer() 3D Sync, Issue 03: Union-Max Conflict Resolution & Throttled Sync Queue, Topbar #cloud-status-btn & Settings Cloud Management UI (+6 more)

### Community 23 - "GitHub Pages Deploy Workflow"
Cohesion: 0.10
Nodes (19): runs-on, steps, jobs, build, name, on, push, permissions (+11 more)

### Community 24 - "Portal Links & Hub Overlap"
Cohesion: 0.11
Nodes (17): allocateDynamicHubPortalSlot(), isWithinPortalKeepOut(), STATIC_HUB_PORTAL_POSITIONS, evalJumpArc(), DEFAULT_LAKE_SANCTUARIES, FLOWER_COORDS, PlayerPose, PORTAL_LINKS (+9 more)

### Community 26 - "3D Model Scanner CLI"
Cohesion: 0.22
Nodes (12): CHARACTER_MODEL_FOLDERS, classifyMeshSemantic(), computeEntityGeometry(), EntityTarget, extractMaterials(), find3DModelFiles(), identifyEntitiesInDocument(), isCharacterModelPath() (+4 more)

### Community 29 - "Farm Collider Grid & Mesh Raster"
Cohesion: 0.21
Nodes (4): buildFarmTerrainFromMeshTriangles(), FarmColliderGrid, FarmZoneState, loadRealFarmTerrain()

### Community 30 - "Apps Script Generator Tests"
Cohesion: 0.13
Nodes (3): FakeSheet, FakeSpreadsheet, source

### Community 31 - "Remote Zone & Problem Payloads"
Cohesion: 0.18
Nodes (4): WorldSession, CachedRemotePayload, RemoteProblem, RemoteZoneConfig

### Community 32 - "Kingdom Emporium & Shop Economy"
Cohesion: 0.17
Nodes (7): StorageAdapter, getShopItem(), ItemRarity, SHOP_CATALOG, ShopItem, ShopItemType, ShopModalContext

### Community 33 - "Zone Visibility & Schedule Filters"
Cohesion: 0.19
Nodes (10): isZoneVisible(), parseActiveFlag(), parseZoneStartAt(), sanitizeRemoteZones(), computeArchipelagoOrbitalPosition(), DecorDensityType, PARK_TREE_OFFSETS, RemoteStep (+2 more)

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

### Community 42 - "WorldSession Remote Boot Sync"
Cohesion: 0.29
Nodes (5): RemoteContentPayload, RemoteContentSnapshot, zoneCountsForBadges(), zoneSpawnsMonoliths(), ZoneTemplateKind

### Community 43 - "TypeScript Compiler Config"
Cohesion: 0.17
Nodes (11): compilerOptions, allowImportingTsExtensions, lib, module, moduleResolution, noEmit, skipLibCheck, strict (+3 more)

### Community 44 - "Procedural Land Builder Spec"
Cohesion: 0.25
Nodes (7): 4 Headless Node.js Testing Seams, Technical Spec: 3D Mesh Catalog, Prefab Slicer & Procedural Land Builder, 3D Mesh Catalog & Procedural Land Builder Design Guide, MeshCatalogItem Schema & Heuristic Semantic Classifier, Prefab Slicer & Coordinate/Pivot Baking, ProceduralLandBuilder (PROCEDURAL_SANCTUARY), Google Sheets Teacher Island Workflow (ZONES & PROBLEMS)

### Community 45 - "NPM Build & Tooling Scripts"
Cohesion: 0.18
Nodes (11): scripts, build, build:apps-script, build:baochau, dev, generate:icons, preview, scan:models (+3 more)

### Community 47 - "ProceduralLandBuilder Implementation"
Cohesion: 0.27
Nodes (5): computeProceduralPortalAnchors(), ProceduralLandBuilder, proceduralLandBuilder, ProceduralLandResult, Obstacle

### Community 48 - "Archimedes Archipelago & Cozy Lake"
Cohesion: 0.22
Nodes (8): Đền Cổng Archimedes (Archimedes Gatehouse), Vùng Đất Luyện Tập Archimedes (Archimedes Trial Grounds), Địa Hình Hồ Yên Bình (Cozy Lake Terrain), Cổng Hào Quang Năng Động (Dynamic Portal Arch), Bia Đá Tri Thức (Knowledge Monolith), Ốc Đảo Chuyên Đề (Thematic Zone Sanctuary), Bản Đồ Thử Thách (Trial Map), Rune Crystal Beacons & Sky Beams

### Community 49 - "Spatial Bounds & Deferred Spawn"
Cohesion: 0.24
Nodes (3): Tọa Độ Thám Hiểm Lưu Lại (Saved Adventure Coordinates), SpatialWorld Deep Module, Shared Lake Land Descriptor

### Community 50 - "Multiplication Quiz Engine"
Cohesion: 0.38
Nodes (8): TABLES, generateQuestion(), getHint(), makeQuestion(), Option, recordAnswer(), shuffle(), validateAnswer()

### Community 51 - "Mesh Catalog Type Definitions"
Cohesion: 0.20
Nodes (9): BoundingBox3D, CharacterSubCategory, FoliageSubCategory, MaterialSummary, MeshSubCategory, ObstacleSubCategory, PropSubCategory, SourceModelInfo (+1 more)

### Community 52 - "Modular FarmAnimalEntity"
Cohesion: 0.29
Nodes (3): AnimalKind, AnimalPart, FarmAnimalEntity

### Community 53 - "3D Prefab & Safety Clearing"
Cohesion: 0.31
Nodes (6): Bộ Khảo Sát Mô Hình 3D (3D Mesh Catalog), Phân Loại Ngữ Nghĩa 3D (3D Semantic Classification), Bản Mẫu Vùng Đất Tùy Biến (PROCEDURAL_SANCTUARY), Mảnh Ghép Mô Hình (Prefab Mesh / Standalone GLB), Bộ Cắt Tách Mô Hình (Prefab Slicer CLI), PrefabCatalog & AssetRepository Lazy VRAM Sharing

### Community 54 - "Park Sanctuary & Tree Awakening"
Cohesion: 0.25
Nodes (5): Công Viên Xanh (Green Park Sanctuary), Cây Tri Thức (Knowledge Tree), Park Sanctuary Template (PARK_SANCTUARY), Starter Village Park Portal, Multi-Park Destination Picker Dialog

### Community 55 - "Camera Zoom & Pinch Limits"
Cohesion: 0.33
Nodes (8): CAMERA_ZOOM_LIMITS, CameraDistanceLimits, clamp(), computePinchZoomDistance(), computeWheelZoomDistance(), getCameraDistanceLimits(), PinchOrbitMove, PinchPointerUpResult

### Community 56 - "Apps Script Setup & Players Roster"
Cohesion: 0.29
Nodes (5): seedFullKingdomDatabase, Google Apps Script Setup & Authoring Guide, Mã Thám Hiểm (Explorer Passcode), Bản Khởi Tạo Toàn Diện (Full Kingdom Seed), Sổ Theo Dõi Người Chơi (Players Roster / Tab PLAYERS)

### Community 57 - "PWA Offline & Brand Assets"
Cohesion: 0.25
Nodes (4): Mô Hình Đồng Hành 3D (3D Companion Model), Biểu Tượng Vương Quốc (Kingdom Brand Mark), Multi-Scale PWA & Brand Icon Pipeline, index.html Application Entry Shell

### Community 58 - "QHMJ Design & Jump-Pad Graph"
Cohesion: 0.32
Nodes (5): 12 JumpLink Graph (10 GLB + 2 Synthetic Pads), QHMJ Landmarks (Gears, Giant Clock, Fans, Forest, Castle), QHMJ_SANCTUARY (map_qhmj.glb), QHMJ_SANCTUARY Interactions & Dynamic Questions Research Doc, RoadSurface 5 Road Islands & Overpass Overlap

### Community 59 - "Prefab Slicer CLI"
Cohesion: 0.43
Nodes (6): sliceCatalogItem(), SliceOptions, slicePrefabs(), SliceResult, main(), MeshSemanticCategory

### Community 60 - "Lake Terrain & Zone Spawn"
Cohesion: 0.39
Nodes (5): resolveZoneProblemsWithPositions(), usesLakeTerrain(), computeProceduralEntityPositions(), computeZonePortalAnchors(), sanitizeZoneEntityPosition()

### Community 61 - "Archimedes Static Monolith Map"
Cohesion: 0.43
Nodes (6): ARCHIMEDES_MONOLITHS, ARCHIMEDES_ZONES, ArchimedesMonolith, ArchimedesZone, getMonolithById(), getMonolithsByZone()

### Community 62 - "Cross-Design Portal & QHMJ Links"
Cohesion: 0.29
Nodes (5): Namespaced QHMJ Progress, Zone Badges (>5) & SaveState.position.y, 3-Source QHMJ Question Pipeline (Sheets, Apps Script, Fallback), anchorQhmjProblemsToSurface 3D Placement, Deferred Spawn (ADR 0007) & Unloaded Map Dialog Fallbacks, Portal Loading Lifecycle & Anti-Flicker Transition

### Community 64 - "Multi-Slot Question Inputs"
Cohesion: 0.40
Nodes (4): Ký Tự Phân Tách Đáp Án (Answer Slot Delimiter), Ô Nhập Giá Trị (Input Slot), Câu Hỏi Nhiều Ô Nhập (Multi-Slot Question), parseAnswer Multi-Slot Parser

### Community 68 - "Farm Asset Attribution & Save Key"
Cohesion: 0.40
Nodes (3): moorhuhn kart 2 farm (CC-BY-4.0 Asset), LocalStorage Save Key (aigame3d_multiplication_save), Vương Quốc Học Toán 3D Project README

## Ambiguous Edges - Review These
- `Bai 310 Math Workbook Screenshot` → `Cropped Printed Workbook Origin and Bleed-Through Text`  [AMBIGUOUS]
  public/Screenshot 2026-09-27 160421.png · relation: conceptually_related_to

## Knowledge Gaps
- **29 isolated node(s):** `Cây Hoa Thử Thách (Challenge Flower)`, `Bản Đồ Thử Thách (Trial Map)`, `Bản Mẫu Vùng Đất (Zone Template)`, `Nhân Vật Đồng Hành (Companion Avatar)`, `Chức Danh Khám Phá (Explorer Title)` (+24 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 358 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **20 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `three` connect `Test Runner & Node Imports` to `Zone Visibility & Schedule Filters`, `QHMJ Region & Road Surfaces`, `3D Assets & Player Avatar`, `Farm Sanctuary & Terrain`, `Challenge Dialog & Sessions`, `Bao Chau 3D Model Builder`, `Region Scene Isolation Tests`, `Cozy Lake Terrain & Anchors`, `Vite PWA & Build Config`, `ProceduralLandBuilder Implementation`, `Modular FarmAnimalEntity`, `3D Model Scanner CLI`, `Prefab Slicer CLI`?**
  _High betweenness centrality (0.088) - this node is a cross-community bridge._
- **What connects `Cây Hoa Thử Thách (Challenge Flower)`, `Bản Đồ Thử Thách (Trial Map)`, `Bản Mẫu Vùng Đất (Zone Template)` to the rest of the system?**
  _29 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `App Entry, Audio & HUD` be split into smaller, more focused modules?**
  _Cohesion score 0.0565088080530771 - nodes in this community are weakly interconnected._
- **Why does `SpatialWorld` connect `SpatialWorld Kinematics & Collision` to `Zone Visibility & Schedule Filters`, `QHMJ Region & Road Surfaces`, `Challenge Dialog & Sessions`, `Farm Sanctuary & Terrain`, `Region Activation & Teleportation`, `3D World & Monolith Rendering`, `Cozy Lake Terrain & Anchors`, `Save State & Bridge Config`, `Lake Terrain & Zone Spawn`, `3D Primitives & Park Loading`, `Archimedes Static Monolith Map`, `Player Interaction & Raycasting`, `Portal Links & Hub Overlap`, `Region Scene Isolation Tests`, `Dynamic Zone & Portal Building`, `Farm Collider Grid & Mesh Raster`?**
  _High betweenness centrality (0.061) - this node is a cross-community bridge._
- **Should `Challenge Dialog & Sessions` be split into smaller, more focused modules?**
  _Cohesion score 0.07728474875110197 - nodes in this community are weakly interconnected._
- **Why does `World` connect `3D World & Monolith Rendering` to `Kingdom Emporium & Shop Economy`, `Challenge Dialog & Sessions`, `QHMJ Region & Road Surfaces`, `ShopModal UI Component`, `3D Assets & Player Avatar`, `Region Activation & Teleportation`, `Adventure Progression & Rewards`, `Cozy Lake Terrain & Anchors`, `3D Primitives & Park Loading`, `Farm Sanctuary Animal Spawning`, `HUD Frame Presentation`, `Player Interaction & Raycasting`, `SceneBatchPool & Particle Effects`, `Dynamic Zone & Portal Building`, `Remote Zone & Problem Payloads`?**
  _High betweenness centrality (0.049) - this node is a cross-community bridge._

### Low-confidence Hints
_AMBIGUOUS edges — the extractor was unsure. Verify before acting on these._

- **What is the exact relationship between `Bai 310 Math Workbook Screenshot` and `Cropped Printed Workbook Origin and Bleed-Through Text`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._