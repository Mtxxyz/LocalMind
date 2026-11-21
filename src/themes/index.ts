export interface Palette {
  bg: string
  sidebar: string
  surface: string
  surface2: string
  elevated: string
  border: string
  text: string
  muted: string
  faint: string
  accent: string
  accentFg: string
  danger: string
  shadow: string
  selection: string
}

export interface ThemeTemplate {
  id: string
  name: string
  swatch: string
  light: Palette
  dark: Palette
}

const shadowDark = '0 18px 48px rgba(0, 0, 0, 0.42)'
const shadowLight = '0 14px 36px rgba(24, 32, 72, 0.14)'

export const themes: ThemeTemplate[] = [
  {
    id: 'midnight',
    name: 'Midnight',
    swatch: '#7c8cff',
    dark: {
      bg: '#0b1020', sidebar: '#0e1428', surface: '#121a33', surface2: '#182243',
      elevated: '#1b264a', border: '#263259', text: '#e8ecff', muted: '#98a3c9',
      faint: '#616d94', accent: '#7c8cff', accentFg: '#0b1020', danger: '#ff6b81',
      shadow: shadowDark, selection: 'rgba(124,140,255,0.22)',
    },
    light: {
      bg: '#f4f6ff', sidebar: '#ebeeff', surface: '#ffffff', surface2: '#f6f8ff',
      elevated: '#ffffff', border: '#dde3fb', text: '#171c38', muted: '#5d668f',
      faint: '#98a1c2', accent: '#5566e8', accentFg: '#ffffff', danger: '#d94f68',
      shadow: shadowLight, selection: 'rgba(85,102,232,0.14)',
    },
  },
  {
    id: 'aurora',
    name: 'Aurora',
    swatch: '#a78bfa',
    dark: {
      bg: '#0b1018', sidebar: '#0f1622', surface: '#141d2b', surface2: '#1a2636',
      elevated: '#1e2c3e', border: '#2a3b52', text: '#e9fbff', muted: '#9db6c7',
      faint: '#648193', accent: '#a78bfa', accentFg: '#0b1018', danger: '#fb7185',
      shadow: shadowDark, selection: 'rgba(167,139,250,0.22)',
    },
    light: {
      bg: '#f6f8fd', sidebar: '#edf1fb', surface: '#ffffff', surface2: '#f7f9ff',
      elevated: '#ffffff', border: '#dfe5f5', text: '#16203a', muted: '#5f6d8a',
      faint: '#9aa5bd', accent: '#7c5cf0', accentFg: '#ffffff', danger: '#d94f68',
      shadow: shadowLight, selection: 'rgba(124,92,240,0.14)',
    },
  },
  {
    id: 'slate',
    name: 'Slate',
    swatch: '#94a3b8',
    dark: {
      bg: '#0e1116', sidebar: '#12161d', surface: '#171c24', surface2: '#1d2430',
      elevated: '#222b38', border: '#2c3746', text: '#e6eaf0', muted: '#94a3b8',
      faint: '#5f6c7d', accent: '#94a3b8', accentFg: '#0e1116', danger: '#f87171',
      shadow: shadowDark, selection: 'rgba(148,163,184,0.2)',
    },
    light: {
      bg: '#f5f7f9', sidebar: '#eceff3', surface: '#ffffff', surface2: '#f7f9fb',
      elevated: '#ffffff', border: '#dde3e9', text: '#1b2430', muted: '#64748b',
      faint: '#9aa7b6', accent: '#475569', accentFg: '#ffffff', danger: '#dc2626',
      shadow: shadowLight, selection: 'rgba(71,85,105,0.12)',
    },
  },
  {
    id: 'paper',
    name: 'Paper',
    swatch: '#b4795a',
    dark: {
      bg: '#17130f', sidebar: '#1c1712', surface: '#221b15', surface2: '#2a221a',
      elevated: '#312720', border: '#413328', text: '#f6ede2', muted: '#bda78f',
      faint: '#806b57', accent: '#d39a76', accentFg: '#17130f', danger: '#f87171',
      shadow: shadowDark, selection: 'rgba(211,154,118,0.2)',
    },
    light: {
      bg: '#faf7f2', sidebar: '#f2ece3', surface: '#fffdf9', surface2: '#faf5ed',
      elevated: '#ffffff', border: '#e6dccd', text: '#2c231b', muted: '#7c6b58',
      faint: '#a89a88', accent: '#b4795a', accentFg: '#ffffff', danger: '#c2413c',
      shadow: shadowLight, selection: 'rgba(180,121,90,0.14)',
    },
  },
  {
    id: 'obsidian',
    name: 'Obsidian',
    swatch: '#e4e4e7',
    dark: {
      bg: '#000000', sidebar: '#080808', surface: '#0d0d0f', surface2: '#141417',
      elevated: '#1a1a1f', border: '#26262d', text: '#f4f4f5', muted: '#a1a1aa',
      faint: '#5f5f6b', accent: '#e4e4e7', accentFg: '#000000', danger: '#fb7185',
      shadow: '0 20px 60px rgba(0,0,0,0.8)', selection: 'rgba(228,228,231,0.18)',
    },
    light: {
      bg: '#fafafa', sidebar: '#f0f0f1', surface: '#ffffff', surface2: '#f7f7f8',
      elevated: '#ffffff', border: '#e2e2e5', text: '#18181b', muted: '#6b6b75',
      faint: '#a1a1aa', accent: '#27272a', accentFg: '#ffffff', danger: '#dc2626',
      shadow: shadowLight, selection: 'rgba(39,39,42,0.1)',
    },
  },
  {
    id: 'frost',
    name: 'Frost',
    swatch: '#38bdf8',
    dark: {
      bg: '#09131b', sidebar: '#0d1923', surface: '#112230', surface2: '#172c3c',
      elevated: '#1c3547', border: '#27475d', text: '#e6f8ff', muted: '#9bc4d8',
      faint: '#628da3', accent: '#38bdf8', accentFg: '#09131b', danger: '#fb7185',
      shadow: shadowDark, selection: 'rgba(56,189,248,0.2)',
    },
    light: {
      bg: '#f2f9fd', sidebar: '#e7f3fb', surface: '#ffffff', surface2: '#f4fbff',
      elevated: '#ffffff', border: '#d4e9f5', text: '#13293a', muted: '#5d8499',
      faint: '#98b6c6', accent: '#0284c7', accentFg: '#ffffff', danger: '#dc2626',
      shadow: shadowLight, selection: 'rgba(2,132,199,0.13)',
    },
  },
  {
    id: 'ember',
    name: 'Ember',
    swatch: '#fb923c',
    dark: {
      bg: '#140e0a', sidebar: '#1b120d', surface: '#231811', surface2: '#2c1e15',
      elevated: '#37261a', border: '#4a3222', text: '#fff2e6', muted: '#c9a88d',
      faint: '#8a6a53', accent: '#fb923c', accentFg: '#140e0a', danger: '#f87171',
      shadow: shadowDark, selection: 'rgba(251,146,60,0.2)',
    },
    light: {
      bg: '#fdf8f3', sidebar: '#f8eee3', surface: '#ffffff', surface2: '#fdf5ec',
      elevated: '#ffffff', border: '#efdfcf', text: '#2d1b10', muted: '#8a6a53',
      faint: '#b49a85', accent: '#ea6c1d', accentFg: '#ffffff', danger: '#c2413c',
      shadow: shadowLight, selection: 'rgba(234,108,29,0.13)',
    },
  },
  {
    id: 'mint',
    name: 'Mint',
    swatch: '#34d399',
    dark: {
      bg: '#09130f', sidebar: '#0d1a14', surface: '#11231b', surface2: '#172e24',
      elevated: '#1c392d', border: '#27513f', text: '#e6fff3', muted: '#9bcbb4',
      faint: '#62927a', accent: '#34d399', accentFg: '#09130f', danger: '#fb7185',
      shadow: shadowDark, selection: 'rgba(52,211,153,0.2)',
    },
    light: {
      bg: '#f2fbf6', sidebar: '#e6f6ed', surface: '#ffffff', surface2: '#f4fcf7',
      elevated: '#ffffff', border: '#d3eddf', text: '#12301f', muted: '#5b8a70',
      faint: '#96bba5', accent: '#059669', accentFg: '#ffffff', danger: '#dc2626',
      shadow: shadowLight, selection: 'rgba(5,150,105,0.13)',
    },
  },
]

export function getTheme(id: string): ThemeTemplate {
  return themes.find((t) => t.id === id) ?? themes[0]
}

export function applyPalette(palette: Palette, accentOverride?: string, mode?: 'light' | 'dark') {
  const root = document.documentElement
  const vars: Record<string, string> = {
    '--bg': palette.bg,
    '--sidebar': palette.sidebar,
    '--surface': palette.surface,
    '--surface-2': palette.surface2,
    '--elevated': palette.elevated,
    '--border': palette.border,
    '--text': palette.text,
    '--muted': palette.muted,
    '--faint': palette.faint,
    '--accent': accentOverride || palette.accent,
    '--accent-fg': palette.accentFg,
    '--danger': palette.danger,
    '--shadow': palette.shadow,
    '--selection': palette.selection,
  }
  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value)
  }
  root.style.colorScheme = mode ?? (palette.bg.startsWith('#0') || palette.bg === '#000000' ? 'dark' : 'light')
}
