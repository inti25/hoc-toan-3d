# 0013. Standardized Multi-Step Challenges Across All Learning Entities

## Context
Originally, only Archimedes Monoliths supported multi-step questions (`steps` array in `RemoteProblem`), while Park Sanctuary Trees, Knowledge Flowers, and Farm Sanctuary Animals treated questions as single-step entities and hardcoded `step = remoteQ.steps[0]`. When teachers created multi-step problems (e.g. `ProblemId = 221_1` with 4 steps in "Công viên phép nhân"), only step 1 rendered in-game, and subsequent steps were inaccessible. Furthermore, if teachers left `ProblemId` blank on subsequent rows of a multi-step question in Google Sheets, the Apps Script parser dropped those rows.

## Decision
1. **Universal Stepper Architecture**:
   - Standardize `ChallengeDialog` so all interactive learning entities (`park_tree`, `flower`, `farm_animal`, and `archimedes`) accept `stepIndex` (default `0`) and render a unified step progression UI (`Bước X/Y`).
   - For intermediate steps (`stepIndex + 1 < totalSteps`), answering correctly awards incremental step XP (+10 XP), logs step telemetry (`stepId`), and reveals a "Bước tiếp theo ➜" button.
   - The 3D world entity state (awakening the tree, blooming the flower, rescuing the animal, or activating the monolith) only transitions on the final step (`isLastStep`), triggering celebratory burst particles and full reward distribution.
2. **Resilient Google Sheets Ingestion**:
   - In Google Apps Script (`fetchQuestionsFromSheet`), automatically inherit `ProblemId` from the preceding row when subsequent rows of a multi-step problem have an empty `ProblemId` but contain content (prompt or step ID).
