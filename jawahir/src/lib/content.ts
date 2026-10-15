import { themeLoaders, unitLoaders } from '@/content/loaders';

export type BlockType = 'h1' | 'h2' | 'h3' | 'p' | 'q' | 'fn';
export interface Block {
  t: BlockType;
  x: string;
  pg: number;
}
export interface Note {
  pg: number;
  n: number | null;
  x: string;
  ref: number | null;
}
export interface PlanItem {
  i: number;
  t: 'h1' | 'h2' | 'h3';
  x: string;
  pg: number;
}
export interface Unit {
  id: string;
  title: string;
  subtitle: string;
  groupTitle: string;
  pages: [number, number];
  words: number;
  plan: PlanItem[];
  notes: Note[];
  blocks: Block[];
}
export interface TocUnit {
  id: string;
  title: string;
  subtitle: string;
  pages: [number, number];
  words: number;
  blocks: number;
}
export interface TocGroup {
  id: string;
  title: string;
  units: TocUnit[];
}
export interface ThemeMeta {
  id: string;
  title: string;
  description: string;
  count: number;
}
export interface Passage {
  unit: string;
  block: number;
  pages: [number, number];
  score: number;
  excerpt: string;
}
export interface Theme extends ThemeMeta {
  passages: Passage[];
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const toc = require('@/content/toc.json') as { groups: TocGroup[]; themes: ThemeMeta[] };

export const groups: TocGroup[] = toc.groups;
export const themes: ThemeMeta[] = toc.themes;
export const allUnits: (TocUnit & { groupId: string; groupTitle: string })[] = groups.flatMap((g) =>
  g.units.map((u) => ({ ...u, groupId: g.id, groupTitle: g.title })),
);
export const TOTAL_PAGES = 549;

const unitCache = new Map<string, Unit>();
export function getUnit(id: string): Unit | undefined {
  const hit = unitCache.get(id);
  if (hit) return hit;
  const loader = unitLoaders[id];
  if (!loader) return undefined;
  const u = loader() as Unit;
  unitCache.set(id, u);
  return u;
}

export function unitMeta(id: string) {
  return allUnits.find((u) => u.id === id);
}

export function neighbour(id: string, delta: 1 | -1) {
  const i = allUnits.findIndex((u) => u.id === id);
  return i < 0 ? undefined : allUnits[i + delta];
}

/** Finds the unit that contains a printed page number of the book. */
export function unitForPage(page: number) {
  return allUnits.find((u) => page >= u.pages[0] && page <= u.pages[1]);
}

export function blockForPage(unit: Unit, page: number) {
  const i = unit.blocks.findIndex((b) => b.pg >= page);
  return i < 0 ? unit.blocks.length - 1 : i;
}

export function getTheme(id: string): Theme | undefined {
  const loader = themeLoaders[id];
  return loader ? (loader() as Theme) : undefined;
}

export function readingMinutes(words: number) {
  return Math.max(1, Math.round(words / 190));
}

export function formatPages(p: [number, number]) {
  return p[0] === p[1] ? `p. ${p[0]}` : `p. ${p[0]}–${p[1]}`;
}
