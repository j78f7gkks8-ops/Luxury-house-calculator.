/**
 * Раздел 6: статусы достоверности. Ноль, неизвестное значение и исключённая позиция —
 * разные состояния, поэтому статус хранится отдельно от числа и НИКОГДА не подменяется нулём.
 */
export type ValueStatus =
  | "confirmed" // подтверждено
  | "from_drawing_needs_check" // по чертежу, требуется сверка
  | "preliminary_by_analog" // предварительно по аналогу
  | "needs_price" // нужна цена
  | "needs_size" // нужен размер
  | "version_conflict" // конфликт версий
  | "not_in_order" // не входит в заказ
  | "included_in_package" // включено в пакет
  | "replaced"; // заменено

export interface Provenance {
  source?: string | null;
  sourceDate?: string | null; // ISO date, может отсутствовать
  region?: string | null;
  version?: string | null;
  author?: string | null;
  comment?: string | null;
  sourceUnit?: string | null;
}

/**
 * Значение с явным статусом и происхождением. `value === null` означает "неизвестно" —
 * это не то же самое, что 0 (раздел 6: "Отсутствие цены означает «не задана», а не бесплатную позицию").
 */
export interface StatusValue<T> extends Provenance {
  value: T | null;
  status: ValueStatus;
}

export function confirmed<T>(value: T, prov: Provenance = {}): StatusValue<T> {
  return { value, status: "confirmed", ...prov };
}

export function byAnalog<T>(value: T, prov: Provenance = {}): StatusValue<T> {
  return { value, status: "preliminary_by_analog", ...prov };
}

export function unknownPrice<T = number>(prov: Provenance = {}): StatusValue<T> {
  return { value: null, status: "needs_price", ...prov };
}

export function unknownSize<T = number>(prov: Provenance = {}): StatusValue<T> {
  return { value: null, status: "needs_size", ...prov };
}

export function isResolved<T>(sv: StatusValue<T>): boolean {
  return sv.value !== null && sv.status !== "needs_price" && sv.status !== "needs_size" && sv.status !== "version_conflict";
}

/**
 * Ручная корректировка: хранит рассчитанное значение и переопределение отдельно
 * (раздел 6: "Ручное изменение не уничтожает рассчитанный вариант").
 */
export interface Overridable<T> {
  calculatedValue: T;
  overrideValue?: T | null;
  overrideReason?: string | null;
  overrideAuthor?: string | null;
  overriddenAt?: string | null;
}

export function effectiveValue<T>(o: Overridable<T>): T {
  return o.overrideValue !== undefined && o.overrideValue !== null ? o.overrideValue : o.calculatedValue;
}

/** Строка сметы с явным статусом полноты — используется, чтобы честно показывать пробелы (раздел 7.5). */
export interface Gap {
  code: string;
  message: string;
  blocksFinal: boolean;
}
