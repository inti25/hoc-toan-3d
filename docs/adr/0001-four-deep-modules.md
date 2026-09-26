# 0001. Four Deep Modules for Game Architecture

Context: Game progression, dual quiz loops, spatial math, and audio unlock calls were entangled across a 408-line `main.ts` and a 482-line `World.ts`, leaving game invariants and spatial physics untested in Node.

Decision: Decompose the game into four deep modules with narrow interfaces and zero leaky mutations:
1. `Adventure`: encapsulates progression state, reward formulas, quest completion, and atomic persistence.
2. `QuizSession`: provides a polymorphic challenge runner for both arithmetic quizzes and flower riddles with encapsulated attempt and hint staging.
3. `SpatialWorld`: pure TypeScript kinematics and collision math with zero Three.js imports, allowing headless spatial testing.
4. `AudioAdapter`: auto-unlocking Web Audio synthesis exposing domain sound cues without caller lifecycle management.

Consequences: `main.ts` and `World.ts` shrink to thin view adapters. All domain progression, challenge flows, and collision physics are testable headlessly in Node.
