import { Platform, useColorScheme } from 'react-native';
import { useStore } from './store';

export interface Palette {
  name: 'light' | 'sepia' | 'dark';
  bg: string;
  surface: string;
  card: string;
  text: string;
  muted: string;
  border: string;
  accent: string;
  accentSoft: string;
  onAccent: string;
  highlight: string;
}

export const palettes: Record<Palette['name'], Palette> = {
  light: {
    name: 'light',
    bg: '#FAF6EE',
    surface: '#FFFDF8',
    card: '#F2EBDC',
    text: '#2B2319',
    muted: '#7C705E',
    border: '#E3D8C3',
    accent: '#1E6A57',
    accentSoft: '#DCEBE4',
    onAccent: '#FFFFFF',
    highlight: '#FFE08A',
  },
  sepia: {
    name: 'sepia',
    bg: '#F2E6CB',
    surface: '#F8EFDA',
    card: '#EADCB9',
    text: '#3B2E1C',
    muted: '#76623F',
    border: '#DCCAA0',
    accent: '#2F6B4F',
    accentSoft: '#D7E3C9',
    onAccent: '#FFFFFF',
    highlight: '#F3C969',
  },
  dark: {
    name: 'dark',
    bg: '#121513',
    surface: '#1A1E1C',
    card: '#212624',
    text: '#E8E3D6',
    muted: '#9A9585',
    border: '#2D332F',
    accent: '#74BBA6',
    accentSoft: '#1F3A33',
    onAccent: '#0E1411',
    highlight: '#7A6420',
  },
};

export function useColors(): Palette {
  const pref = useStore((s) => s.settings.theme);
  const system = useColorScheme();
  const name = pref === 'auto' ? (system === 'dark' ? 'dark' : 'light') : pref;
  return palettes[name];
}

export const fonts = {
  serif: Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia, "Times New Roman", serif' }) as string,
  sans: Platform.select({ ios: 'System', android: 'sans-serif', default: 'system-ui, sans-serif' }) as string,
};
