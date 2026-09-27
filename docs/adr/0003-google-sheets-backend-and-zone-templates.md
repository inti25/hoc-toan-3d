# 0003. Google Sheets Backend & Procedural Zone Templates

## Context
Currently, all quiz content and 3D map topologies (Flower Garden and 5 Archimedes Sanctuaries) are hardcoded in static TypeScript files (`flowerQuestions.ts`, `archimedesTrialMap.ts`, and `World.ts`). To allow educators and non-engineers to create, update, and expand math islands, quests, and trial questions without modifying code or redeploying the web app, we need an accessible, zero-cost content management system and database.

## Decision
1. **Google Sheets as Content Database**:
   - A single master spreadsheet acts as the database.
   - `CONFIG` sheet serves as the **Sổ Đăng Ký Vùng Đất (Zone Registry)** specifying zone ID, name, 3D template type, island center coordinates, theme color, badge, and target question tab name.
   - Dedicated sheets (e.g. `Zone_1_TinhToan`, `Zone_2_DaySo`, `VuonHoa`) serve as **Bảng Thử Thách Vùng Đất (Zone Quest Sheets)** storing questions, diagram SVGs, options, answers, hints, and explanations.
   - An optional `LOGS` sheet records **Nhật Ký Thám Hiểm Trực Tuyến (Remote Adventure Log)** (player session, completed questions, scores, timestamps).
2. **Google Apps Script as Serverless REST API**:
   - Deployed as a Web App (`doGet`, `doPost`) with `Anyone` access.
   - `doGet?action=getZones`: Returns zone registry metadata.
   - `doGet?action=getQuestions&sheetName=...`: Returns parsed questions for a zone.
   - `doPost`: Appends player completion logs.
3. **Procedural Zone Templates (Bản Mẫu Vùng Đất)**:
   - Introduce parameterized 3D templates (`FLOWER_BEDS`, `CIRCLE_SANCTUARY`, `GRID_SANCTUARY`).
   - Dynamic 3D island generation reads template parameters directly from zone config.
   - **Hybrid Procedural Layout**: Default algorithmic entity positioning based on template and question count, with optional per-question `PosX, PosZ` coordinate overrides.
4. **Resilient Client Caching & Offline Fallback**:
   - Client caches remote zone data in `localStorage` under a Stale-While-Revalidate pattern.
   - Built-in fallback to bundled static data ensures instant 60fps load times even offline or during Apps Script cold start.
5. **Explorer Profile & Teacher Progress Logs**:
   - Lightweight nickname and class input modal for young learners (with guest option).
   - Progression events asynchronously posted to the `LOGS` sheet for teacher review.
6. **Decoupled Apps Script Repository Structure**:
   - Self-contained `apps-script/` directory housing `Code.gs`, deployment guides, and spreadsheet seed templates.
7. **Flexible Source Configuration & Resilient Data Ingestion**:
   - Web App URL defaults to environment config (`VITE_APPS_SCRIPT_URL`) with an optional in-game settings modal for educators to paste custom URLs directly.
   - Dynamic Portal Arches spawn radially around the Archimedes Gatehouse alongside HUD Trial Map teleportation.
   - **Resilient Data Sanitizer** cleanses whitespace, infers missing options, and gracefully bypasses malformed entries without disrupting 3D rendering.

## Consequences
- Educators can add or edit questions and islands directly from Google Sheets without touching git or npm builds.
- Apps Script response latency (typically 500ms - 1.5s cold start) is completely bypassed via client caching and background pre-fetching.
- Zero server hosting maintenance and zero recurring database costs.
- Children enjoy immediate, responsive 3D gameplay while teachers retain visibility into learning progress.
- Typographical or schema errors in Google Sheets are isolated and never crash the 3D game client.
