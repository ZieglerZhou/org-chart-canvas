import { pinyin } from 'pinyin-pro';

export function getPinyin(text: string): string {
  return pinyin(text, { toneType: 'none', type: 'array' }).join('');
}

export function getPinyinInitials(text: string): string {
  return pinyin(text, { toneType: 'none', type: 'array' }).map(c => c.charAt(0)).join('');
}

export function sortByPinyin<T extends { name: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const pa = getPinyin(a.name);
    const pb = getPinyin(b.name);
    return pa.localeCompare(pb);
  });
}

export function filterByPinyin<T extends { name: string; position?: string }>(
  items: T[],
  query: string
): T[] {
  if (!query.trim()) return items;
  const q = query.trim().toLowerCase();
  return items.filter(item => {
    const name = item.name;
    const py = getPinyin(name).toLowerCase();
    const initials = getPinyinInitials(name).toLowerCase();
    return (
      name.includes(q) ||
      py.includes(q) ||
      initials.includes(q) ||
      (item.position && item.position.toLowerCase().includes(q))
    );
  });
}
