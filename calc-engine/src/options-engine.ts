/**
 * Раздел 19: опции как правила замены и зависимостей. Ключ дублей связан с физическим
 * узлом/потребителем/слоем и видом операции, а не с названием товара (например, "розетка
 * насоса кочегарки" — один узел, даже если на него претендуют две разные опции).
 */
export type OptionActionKind = "ADD" | "REPLACE" | "REMOVE";

export interface OptionEffect {
  action: OptionActionKind;
  /** Стабильный ключ физического узла/потребителя/слоя (например "kotelnaya.pump.socket"). */
  nodeKey: string;
  optionId: string;
  payload?: unknown;
}

export interface AppliedNode {
  optionId: string;
  payload?: unknown;
}

export type AppliedState = Map<string, AppliedNode>;

export function emptyState(): AppliedState {
  return new Map();
}

/**
 * ADD claim'ит физический узел только если он ещё свободен (иначе он уже обслуживает
 * тот же потребитель от другой опции — второй раз не добавляется, раздел 19 пример с насосом).
 * REPLACE — явная замена, всегда перезаписывает узел (например, тёплый пол меняет состав пола).
 * REMOVE — снимает эффект только если узел принадлежит именно этой опции: отключение опции
 * не должно случайно убрать чужую зависимость.
 */
export function applyEffect(state: AppliedState, effect: OptionEffect): AppliedState {
  const next = new Map(state);
  const existing = next.get(effect.nodeKey);

  switch (effect.action) {
    case "ADD":
      if (!existing) next.set(effect.nodeKey, { optionId: effect.optionId, payload: effect.payload });
      return next;
    case "REPLACE":
      next.set(effect.nodeKey, { optionId: effect.optionId, payload: effect.payload });
      return next;
    case "REMOVE":
      if (existing && existing.optionId === effect.optionId) next.delete(effect.nodeKey);
      return next;
  }
}

export function applyEffects(state: AppliedState, effects: OptionEffect[]): AppliedState {
  return effects.reduce(applyEffect, state);
}

/** Снимает все узлы, принадлежащие конкретной опции (отключение опции). */
export function retractOption(state: AppliedState, optionId: string): AppliedState {
  const next = new Map(state);
  for (const [key, node] of next) {
    if (node.optionId === optionId) next.delete(key);
  }
  return next;
}
