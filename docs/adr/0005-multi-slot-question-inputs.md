# 0005. Multi-Slot Question Inputs & Answer Delimiters

## Context
Certain mathematics problems require students to solve multiple intermediate or final values simultaneously, such as sequence diagram chains (e.g., Problem 310_1: `80 ➔ (+8) ➔ [ Lục giác ] ➔ (+12) ➔ [ Tam giác ]`).
Previously, the system only supported:
1. Multi-step monoliths (where each step has exactly one question and one answer, requiring step-by-step submission).
2. Single-answer numeric/choice inputs (one answer string per step).

We need an extensible, educator-friendly convention on Google Sheets to define multiple answer slots in a single step without breaking existing single-answer questions, alongside an intuitive multi-slot input interface on the client.

## Decision
1. **Answer Slot Delimiter (`|`) on Google Sheets**:
   - In the `Answer` column of Google Sheets, multiple answers are authored separated by the pipe character `|` (e.g., `88|100` or `88 | 100`).
   - If an answer string does not contain `|`, it is treated as a standard single answer (100% backwards compatible).
2. **Multi-Slot Parsing in `parseAnswer`**:
   - `parseAnswer` checks if the trimmed answer string contains `|`.
   - If present, it splits the string by `|` and parses each element individually via `parseAnswer` to support pure numbers, numbers with units (e.g., `88 kg|100 kg`), or symbols.
   - It returns a new parsed type: `{ type: 'multi', raw: string, slots: ParsedAnswer[], expectedAnswers: string[] }`.
3. **Multi-Slot Interactive UI**:
   - When `parsed.type === 'multi'`, the UI renders a sequence of interactive input slots: `(1) [ ? ] ➔ (2) [ ? ]`.
   - The currently focused slot is marked with an active ring (`active`).
   - Students can tap any slot directly to edit its value.
   - The on-screen Numpad provides a "Tiếp theo ➔" navigation button (also mapped to `Tab` / `Enter` on physical keyboards) to advance between slots.
4. **Per-Slot Feedback & Validation**:
   - Submitting validates each slot against its corresponding expected answer.
   - If all slots are correct, all glow green and the challenge completes.
   - If any slot is incorrect, correct slots remain green while incorrect slots shake with an error border, guiding the student to identify and fix specific calculation errors.

## Consequences
- Teachers and content creators can author multi-value calculation chains on Google Sheets using simple `value1|value2` syntax.
- Students can input multiple values simultaneously without needing separate multi-step screens.
- Completely backwards compatible with all existing single-slot numeric, comparison, and multiple-choice questions.
