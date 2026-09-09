import { CalcError } from "./money";

/**
 * Options-as-rules engine - §19. A whole composition is always recomputed
 * fresh from (base lines + the current set of selected option ids); there is
 * no incremental toggle/undo state to get wrong. This makes re-selecting an
 * option (idempotency) and de-selecting one (only ITS dependent lines
 * disappear, nothing owned by another still-selected option is touched)
 * both trivial consequences of the same recompute, rather than special cases.
 */

export interface CompositionLineData {
  material: string;
  qty: number;
  unit: string;
}

export type OptionAction =
  | { type: "ADD"; key: string; line: CompositionLineData }
  | { type: "REPLACE"; key: string; line: CompositionLineData }
  | { type: "REMOVE"; key: string }
  | { type: "REQUIRE"; requiredOptionId: string }
  | { type: "EXCLUDE"; excludedOptionId: string };

export interface OptionDefinition {
  id: string;
  actions: OptionAction[];
}

export interface OwnedLine {
  key: string;
  ownerOptionId: string; // "BASE" for the seed composition
  line: CompositionLineData;
}

export interface ApplyOptionsResult {
  lines: OwnedLine[];
  /** Two selected options touching the same physical key - surfaced, never silently resolved. */
  conflicts: string[];
}

export function applyOptions(
  baseLines: OwnedLine[],
  selectedOptionIds: string[],
  optionDefs: Record<string, OptionDefinition>,
): ApplyOptionsResult {
  // Idempotent by construction: dedupe, and apply each option's actions exactly once.
  const uniqueSelected = Array.from(new Set(selectedOptionIds));

  for (const id of uniqueSelected) {
    if (!optionDefs[id]) {
      throw new CalcError(`Неизвестная опция "${id}"`, "UNKNOWN_OPTION", { id });
    }
  }

  // REQUIRE / EXCLUDE validation over the whole selected set before mutating anything.
  const selectedSet = new Set(uniqueSelected);
  for (const id of uniqueSelected) {
    for (const action of optionDefs[id]!.actions) {
      if (action.type === "REQUIRE" && !selectedSet.has(action.requiredOptionId)) {
        throw new CalcError(
          `Опция "${id}" требует опцию "${action.requiredOptionId}"`,
          "MISSING_REQUIRED_OPTION",
          { optionId: id, requiredOptionId: action.requiredOptionId },
        );
      }
      if (action.type === "EXCLUDE" && selectedSet.has(action.excludedOptionId)) {
        throw new CalcError(
          `Опции "${id}" и "${action.excludedOptionId}" несовместимы`,
          "EXCLUDED_OPTION_SELECTED",
          { optionId: id, excludedOptionId: action.excludedOptionId },
        );
      }
    }
  }

  const byKey = new Map<string, OwnedLine>();
  for (const l of baseLines) byKey.set(l.key, l);

  const conflicts: string[] = [];

  for (const id of uniqueSelected) {
    for (const action of optionDefs[id]!.actions) {
      switch (action.type) {
        case "ADD": {
          const existing = byKey.get(action.key);
          if (!existing) {
            byKey.set(action.key, { key: action.key, ownerOptionId: id, line: action.line });
          } else if (existing.ownerOptionId !== id) {
            // Same physical node/consumer already served (e.g. one pump -> one socket) - do not duplicate.
            conflicts.push(
              `ADD "${action.key}": опция "${id}" не добавлена повторно - узел уже обслужен опцией "${existing.ownerOptionId}"`,
            );
          }
          break;
        }
        case "REPLACE": {
          const existing = byKey.get(action.key);
          if (existing && existing.ownerOptionId !== "BASE" && existing.ownerOptionId !== id) {
            conflicts.push(
              `REPLACE "${action.key}": опция "${id}" заменяет строку, уже заменённую опцией "${existing.ownerOptionId}"`,
            );
          }
          byKey.set(action.key, { key: action.key, ownerOptionId: id, line: action.line });
          break;
        }
        case "REMOVE": {
          const existing = byKey.get(action.key);
          if (existing && existing.ownerOptionId === id) {
            byKey.delete(action.key);
          }
          // Removing a key not owned by this option, or already absent, is a no-op (idempotent).
          break;
        }
        case "REQUIRE":
        case "EXCLUDE":
          break; // validated above
      }
    }
  }

  return { lines: Array.from(byKey.values()), conflicts };
}
