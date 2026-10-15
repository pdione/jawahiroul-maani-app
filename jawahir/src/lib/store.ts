import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

export type ThemeName = 'auto' | 'light' | 'sepia' | 'dark';

export interface Settings {
  theme: ThemeName;
  fontSize: number;
  serif: boolean;
  showPages: boolean;
  keepAwake: boolean;
}
export interface Position {
  unit: string;
  block: number;
  pg: number;
  at: number;
}
export interface Bookmark {
  id: string;
  unit: string;
  block: number;
  pg: number;
  excerpt: string;
  at: number;
}
export interface State {
  ready: boolean;
  settings: Settings;
  progress: Record<string, Position>;
  last?: Position;
  bookmarks: Bookmark[];
}

const KEY = 'jawahir.v1';
const DEFAULTS: Settings = { theme: 'auto', fontSize: 18, serif: true, showPages: true, keepAwake: true };

let state: State = { ready: false, settings: DEFAULTS, progress: {}, bookmarks: [] };
const listeners = new Set<() => void>();
let saveTimer: ReturnType<typeof setTimeout> | undefined;

function emit() {
  listeners.forEach((l) => l());
}

function persist() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const { settings, progress, last, bookmarks } = state;
    AsyncStorage.setItem(KEY, JSON.stringify({ settings, progress, last, bookmarks })).catch(() => {});
  }, 500);
}

function set(patch: Partial<State>, save = true) {
  state = { ...state, ...patch };
  emit();
  if (save) persist();
}

export async function hydrate() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) {
      const d = JSON.parse(raw);
      state = {
        ready: true,
        settings: { ...DEFAULTS, ...(d.settings ?? {}) },
        progress: d.progress ?? {},
        last: d.last,
        bookmarks: d.bookmarks ?? [],
      };
      emit();
      return;
    }
  } catch {
    // ignore corrupted storage and start fresh
  }
  set({ ready: true }, false);
}

export function useStore<T>(selector: (s: State) => T): T {
  const snap = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
    () => state,
  );
  return selector(snap);
}

export const actions = {
  setSettings(patch: Partial<Settings>) {
    set({ settings: { ...state.settings, ...patch } });
  },
  setPosition(unit: string, block: number, pg: number) {
    const pos: Position = { unit, block, pg, at: Date.now() };
    set({ progress: { ...state.progress, [unit]: pos }, last: pos });
  },
  addBookmark(b: Omit<Bookmark, 'id' | 'at'>) {
    const exists = state.bookmarks.find((x) => x.unit === b.unit && x.block === b.block);
    if (exists) return;
    const bm: Bookmark = { ...b, id: `${b.unit}:${b.block}:${Date.now()}`, at: Date.now() };
    set({ bookmarks: [bm, ...state.bookmarks] });
  },
  removeBookmark(id: string) {
    set({ bookmarks: state.bookmarks.filter((b) => b.id !== id) });
  },
  resetProgress() {
    set({ progress: {}, last: undefined });
  },
};
