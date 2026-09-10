import { CalcError } from "./money";

/**
 * Electrical panel sizing - §13.
 *
 * "Щит 24 модуля не подходит как контейнер для набора, занимающего уже 36.
 * Показывай конфликт вместимости." The check therefore reports a conflict
 * rather than silently picking a bigger panel or trimming the device list.
 */

export interface PanelDevice {
  name: string;
  /** DIN modules this device occupies. */
  modules: number;
  qty: number;
}

export interface PanelCapacityResult {
  /** Modules taken by the devices themselves. */
  usedModules: number;
  /** Spare modules the owner's policy requires on top. */
  reserveModules: number;
  requiredModules: number;
  panelCapacityModules: number;
  fits: boolean;
  /** How many modules short the chosen panel is; 0 when it fits. */
  shortfallModules: number;
  message?: string;
}

export function checkPanelCapacity(
  devices: PanelDevice[],
  panelCapacityModules: number,
  reserveModules = 0,
): PanelCapacityResult {
  if (panelCapacityModules <= 0) {
    throw new CalcError("Некорректная вместимость щита", "INVALID_PANEL_CAPACITY");
  }
  if (reserveModules < 0) {
    throw new CalcError("Резерв щита не может быть отрицательным", "INVALID_PANEL_RESERVE");
  }

  const usedModules = devices.reduce((sum, d) => {
    if (d.modules <= 0 || d.qty <= 0) {
      throw new CalcError(`Некорректный аппарат "${d.name}" в щите`, "INVALID_PANEL_DEVICE", {
        name: d.name,
      });
    }
    return sum + d.modules * d.qty;
  }, 0);

  const requiredModules = usedModules + reserveModules;
  const fits = requiredModules <= panelCapacityModules;
  const shortfallModules = fits ? 0 : requiredModules - panelCapacityModules;

  return {
    usedModules,
    reserveModules,
    requiredModules,
    panelCapacityModules,
    fits,
    shortfallModules,
    message: fits
      ? undefined
      : `Щит на ${panelCapacityModules} модулей не вмещает набор: нужно ${requiredModules} (аппараты ${usedModules} + резерв ${reserveModules}), не хватает ${shortfallModules}.`,
  };
}

/**
 * Sockets/switches grouped into frames: the number of frames follows the
 * grouping of mechanisms, not the count of mechanisms (§13).
 */
export function frameCount(groups: number[]): number {
  for (const g of groups) {
    if (!Number.isInteger(g) || g <= 0) {
      throw new CalcError("Некорректная группировка механизмов", "INVALID_FRAME_GROUP");
    }
  }
  return groups.length;
}
