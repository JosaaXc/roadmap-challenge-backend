export function toStringList(value: unknown): string[] {
  if (typeof value === 'string') return value.split(',');
  if (Array.isArray(value)) return value.flatMap((v) => (typeof v === 'string' ? v.split(',') : []));
  return [];
}

function dedupe(items: string[]): string[] | undefined {
  return items.length > 0 ? [...new Set(items)] : undefined;
}

/** CSV query param → lowercase array (e.g. `tags=node,Docker` → `['node','docker']`). */
export function csvToArray(value: unknown): string[] | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  return dedupe(toStringList(value).map((v) => v.trim().toLowerCase()).filter(Boolean));
}

/** CSV query param → uppercase array (e.g. `level=beginner` → `['BEGINNER']`). */
export function csvToUpperArray(value: unknown): string[] | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  return dedupe(toStringList(value).map((v) => v.trim().toUpperCase()).filter(Boolean));
}
