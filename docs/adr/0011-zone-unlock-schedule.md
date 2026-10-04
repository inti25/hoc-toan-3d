# 0011. Zone Unlock Schedule (CONFIG `Active` and `StartAt`)

## Context
Teachers need to prepare zones in the `CONFIG` sheet ahead of time and reveal them at a chosen moment (or hide them), without redeploying the client. The client caches data for 30 minutes (ADR 0004), so server-side filtering would delay reveals.

## Decision
1. Append two columns to `CONFIG`: `Active` (TRUE/FALSE) and `StartAt` (date-time).
2. A zone is visible only if `Active` is not FALSE **and** now >= `StartAt`. Empty `Active` = TRUE and empty `StartAt` = visible immediately, so existing sheets keep working.
3. `StartAt` without a timezone is interpreted as Vietnam time (UTC+7). Apps Script normalizes Date cells to ISO with `+07:00`.
4. Apps Script always returns every row with `active`/`startAt`; the client filters with `isZoneVisible` in `syncDynamicContent`, comparing against device time.
5. Hidden zones keep stored progress (reconcile still sees them). A player whose saved coordinates lie in a hidden zone stays at Starter Village (Deferred Spawn, ADR 0007).
6. Applies only to `CONFIG` rows, not to Starter Village or Knowledge Flower Garden.

## Consequences
- Reveals take effect at next data load/sync, not live while the game is open.
- Relies on the device clock; a wrong device clock can reveal early or late.
