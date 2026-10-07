# 0012. Farm Sanctuary Template & Roaming Animal Rescue

## Context
Following the static park template (`PARK_SANCTUARY`) and procedural landscape builder (`PROCEDURAL_SANCTUARY`), we require an interactive farm sanctuary template (`FARM_SANCTUARY`) inspired by `cute_game-main` and its `farm.glb` model kit. In this sanctuary, escaped farm animals (cows, calves, pigs, piglets, ducks, chickens, dogs) wander across a free-range pasture. Students explore the farm, locate the animals, trigger curriculum-aligned math problems generated procedurally from the multiplication tables (or loaded from Google Sheets), and upon answering correctly, watch the animal perform a celebratory dance and walk autonomously back into its designated species shelter in the central pen, dropping collectible farmstead produce.

## Decision

1. **FARM_SANCTUARY Zone Template & Spatial Topology**:
   - Registered dynamically via Google Sheets `CONFIG` (`template = 'FARM_SANCTUARY'`).
   - Modeled as an independent pasture island (radius ~28m) comprising a **Khu Chuồng Trại Trung Tâm (Central Farm Pen)** enclosed by fences, a pen gate, feeding troughs, and **Chòi Trú Ẩn Theo Loài (Species Shelters)**, surrounded by a **Cánh Đồng Tự Do (Free-Range Pasture)**.
   - Connected directly from Starter Village via a **Cổng Gỗ Đồng Quê (Rustic Farm Gate)** located at the riverbank near the windmill ($X = -8, Z = 14$).
   - Return portal from the farm brings the student back in front of the rustic gate ($X = -8, Z = 12$).

2. **Procedural Question Generation (No Hardcoding)**:
   - When no specific quest sheet is provided on Google Sheets, challenge questions are procedurally generated on the fly from the Multiplication Tables (Bảng Cửu Chương $2 \times 2$ to $9 \times 9$) with fun farm-themed framing, eliminating hardcoded question arrays.

3. **Procedural Modular Animal Entity & Roam AI**:
   - Extract animal parts (`body`, `head`, `legs`, `wings`, `tail`) from `farm.glb` and assemble them into animated dynamic models with sinusoidal joint motions (stepping legs, bobbing head, tail wagging, grazing/pecking).
   - 4-state lifecycle machine:
     - `ROAMING`: Gentle wander within pasture boundary, pausing periodically to graze or peck.
     - `ENGAGED`: When the student approaches ($\le 2.5\text{m}$), the animal halts, rotates to face the student, and prompts the Math Challenge dialog.
     - `HOMEWARD`: On correct answer, triggers celebratory particle bursts, dances happily, and navigates back through the pen gate into its species shelter.
     - `RESTING`: Settles peacefully inside its shelter for the remainder of the session.

4. **Rescue Flow & Farmstead Produce Economy**:
   - Upon entering the shelter, the rescued animal produces a species-specific **Nông Sản Thu Hoạch (Farmstead Produce)** (e.g. Milk bottle, Golden Egg, Truffle, Duck Egg, Lucky Bone) that floats up with a sparkle effect into the **Túi Đồ Dũng Sĩ (Explorer Inventory)**, along with coins and XP.
   - Farm produce items can be inspected in the backpack or exchanged at the Kingdom Emporium riverside stall.

5. **Resilient Persistence**:
   - Solved animal states are tracked in `AdventureState.farmRescued: Record<string, boolean>` and synchronized with Google Sheets.
   - When revisiting the sanctuary, previously rescued animals start directly in their rested state inside their shelters.

## Consequences
- Clean separation of concerns through deep modules (`FarmSanctuary`, `FarmAnimalEntity`, `FarmRoamSystem`).
- Zero hardcoded question burden; dynamic scaling based on multiplication table curriculum or custom Google Sheets rows.
- Full parity with existing offline-first PWA caching and Sheets sync pipelines.
