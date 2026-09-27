# 0004. Unified Batch Ingestion & Manual Hot Sync

## Context
In ADR 0003, we established Google Sheets as the database for islands and quests. As the system expanded to support dynamic user-authored zones and procedural scenery, we needed to define the exact networking protocol between the client and Google Apps Script, the relationship between the `CONFIG` registry and question tabs, and the caching invalidation strategy for content creators.

Specifically, two approaches were considered:
1. **Cascading Two-Step Fetch**: The client first fetches `CONFIG` to discover zones, then fires multiple sequential or parallel HTTP requests to fetch questions for each zone's `sheetName`.
2. **Unified Batch Ingestion (`action=getAll`)**: The client sends a single HTTP GET request. The Apps Script backend reads `CONFIG` as the single source of truth, iterates over all declared `sheetName` tabs, bundles everything into a single JSON payload, and returns it.

## Decision
1. **Unified Batch Ingestion**:
   - We adopt **Unified Batch Ingestion (`action=getAll`)** as the primary synchronization protocol.
   - Google Apps Script executions have significant cold start overhead (~800ms - 1.5s per request). Multi-step cascading fetches would multiply this latency by N zones, delaying game initialization by 4 to 8 seconds.
   - The backend reads `CONFIG` (Zone Registry) first, using it to determine exactly which question sheets to query. Sheets not listed in `CONFIG` are ignored.
2. **Graceful Zone Fallback**:
   - If a zone is defined in `CONFIG` but its question sheet has not yet been created (or has a typographical error in `sheetName`), the backend returns an empty question list (`[]`).
   - The 3D world safely renders the island and themed procedural scenery without crashing, and the Kingdom Map displays a helpful status message for educators.
3. **Manual Hot Sync**:
   - Alongside the 30-minute Stale-While-Revalidate cache, we provide explicit manual sync triggers:
     - In the **Cài Đặt (Settings)** dialog (`#refresh-sheets-btn`).
     - In the **Bản Đồ Vương Quốc (Kingdom Map)** header banner (`#map-sync-sheets-btn`).
   - Clicking either button bypasses the 30-minute TTL, invalidates local cache, pulls fresh data from Google Sheets, and hot-updates 3D islands, scenery, and monolith questions in real time.

## Consequences
- Single network round-trip delivers both island configuration and all question sets in ~1.5s cold start / ~300ms warm.
- `CONFIG` acts as the strict authoritative gatekeeper for what gets rendered in the 3D world.
- Content creators can instantly verify modifications by pressing "🔄 Đồng bộ Sheets" without waiting 30 minutes or clearing browser storage.
- Zero client crashes when authoring new zones in progress.
