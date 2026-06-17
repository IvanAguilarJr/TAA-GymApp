export const C = {
  bgBlack: '#000000',
  bgSurface1: '#111111',
  bgSurface2: '#1c1c1c',
  bgSurface3: '#222222',

  textPrimary: '#EEEDE9',
  textSecondary: '#888780',
  textTertiary: '#5F5E5A',
  textQuaternary: '#444441',
  textLightGray: '#B4B2A9',

  accentYellow: '#FFD944',
  accentYellowText: '#412402',

  accentBlue: '#84BFCB',
  accentBlueBg: '#102426',

  accentOrange: '#D6822E',
  accentOrangeBg: '#2a1d10',
} as const;

export const PRESET_COLORS = ['#FFD944', '#84BFCB', '#D6822E'] as const;
export type PresetColor = (typeof PRESET_COLORS)[number];

const TILE_BG_MAP: Record<string, string> = {
  '#FFD944': '#2a2510',
  '#84BFCB': '#102426',
  '#D6822E': '#2a1d10',
};

export function getExerciseTileBg(color: string): string {
  if (TILE_BG_MAP[color]) return TILE_BG_MAP[color];
  const upper = color.toUpperCase();
  if (TILE_BG_MAP[upper]) return TILE_BG_MAP[upper];
  // Compute darkened tint for any future non-preset color
  const hex = color.replace('#', '').padEnd(6, '0');
  const r = Math.round(parseInt(hex.slice(0, 2), 16) * 0.14);
  const g = Math.round(parseInt(hex.slice(2, 4), 16) * 0.14);
  const b = Math.round(parseInt(hex.slice(4, 6), 16) * 0.14);
  const h = (n: number) => n.toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}
