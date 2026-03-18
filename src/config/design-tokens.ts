// file: src/config/design-tokens.ts
// Design tokens extracted from Figma "Product Design System" (VVjvQJQTMcFPDkWqB0Bf39TD).
// Single source of truth for colors, typography, shadows, radii, and spacing.
// Used by: Tailwind theme (globals.css), component styles, and any runtime token access.
// Regenerate by re-reading the Figma file when the design system is updated.

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------

export const colors = {
  neutral: {
    white: '#FFFFFF',
    50: '#F2F4F7',
    100: '#EDF0F5',
    150: '#D9DDE5',
    200: '#C5CBD6',
    300: '#A2AAB8',
    400: '#7C8594',
    500: '#565C66',
    600: '#454952',
    700: '#33373D',
    800: '#222529',
    900: '#101114',
  },

  green: {
    100: '#E0FFE0',
    200: '#BAF5BA',
    300: '#93F593',
    400: '#51E051',
    500: '#1EC71E', // Base
    600: '#1BB31B',
    700: '#189F18',
    800: '#158B15',
    900: '#0F630F',
  },

  red: {
    100: '#FFE0E6',
    200: '#FFC2CC',
    300: '#FF99AA',
    400: '#FF5C77',
    500: '#E00025', // Base
    600: '#B8001F',
    700: '#A3001B',
    800: '#7A0014',
    900: '#52000E',
  },

  orange: {
    100: '#FFF3E0',
    200: '#FFE7C2',
    300: '#FFD699',
    400: '#FFBE5C',
    500: '#F59300', // Base
    600: '#D17D00',
    700: '#A36200',
    800: '#7A4900',
    900: '#523100',
  },

  blue: {
    100: '#E0F0FF',
    200: '#C2E0FF',
    300: '#99CCFF',
    400: '#5CADFF',
    450: '#3E9EFF',
    500: '#1F8FFF', // Base
    600: '#0975E0',
    700: '#075FB8',
    800: '#064A8F',
    900: '#043566',
  },

  purple: {
    100: '#EBE0FF',
    200: '#D6C2FF',
    300: '#C9ADFF',
    400: '#AD85FF',
    500: '#925CFF',
    600: '#6F36E0', // Base
    700: '#5B2CB8',
    800: '#46228F',
    900: '#321866',
  },

  cyan: {
    100: '#E0F9FF',
    200: '#BEF3FF',
    300: '#83EBFF',
    400: '#00DEF7',
    500: '#00BBD1', // Base
    600: '#00A0B2',
    700: '#007D8C',
    800: '#005D69',
    900: '#003F47',
  },

  teal: {
    100: '#CFFFE6',
    200: '#96FFCE',
    300: '#00FAAF',
    400: '#00E6A1',
    500: '#00C287', // Base
    600: '#00A673',
    700: '#008159',
    800: '#006141',
    900: '#00422B',
  },

  yellow: {
    100: '#FFFFCC',
    200: '#FFFF99',
    300: '#FFFF33',
    400: '#F5F500',
    500: '#E5E500', // Base
    600: '#CCCC00',
    700: '#B2B200',
    800: '#999900',
    900: '#808000',
  },

  pink: {
    100: '#FDE8FB',
    200: '#FAD1F6',
    300: '#F8BCF2',
    400: '#F28CE8',
    500: '#ED5EDF',
    600: '#E619D1', // Base
    700: '#B814A7',
    800: '#8A0F7D',
    900: '#5C0A54',
  },
} as const;

// Semantic aliases — map intent to palette tokens
export const semantic = {
  primary: colors.green[500],
  primaryHover: colors.green[600],
  secondary: colors.neutral[200],
  secondaryHover: colors.neutral[300],
  danger: colors.red[500],
  dangerHover: colors.red[600],
  info: colors.blue[500],
  infoHover: colors.blue[600],
  success: colors.green[500],
  warning: colors.orange[500],
  error: colors.red[500],
  link: colors.blue[600],
  linkHover: colors.blue[700],
  textPrimary: colors.neutral[900],
  textSecondary: colors.neutral[500],
  textMuted: colors.neutral[400],
  textInverse: colors.neutral.white,
  bgPage: colors.neutral[50],
  bgCard: colors.neutral.white,
  bgOverlay: colors.neutral[800], // + opacity 0.4
  border: colors.neutral[200],
  borderFocus: colors.blue[500],
} as const;

// ---------------------------------------------------------------------------
// Typography
// ---------------------------------------------------------------------------

export const fontFamily = {
  sans: 'Inter, system-ui, -apple-system, sans-serif',
} as const;

export const typography = {
  h1: { fontSize: '32px', lineHeight: '1.25', fontWeight: '500' },
  h2: { fontSize: '24px', lineHeight: '1.333', fontWeight: '500' },
  h3: { fontSize: '16px', lineHeight: '1.5', fontWeight: '500' },
  body: { fontSize: '14px', lineHeight: '1.429', fontWeight: '400' },
  bodyMedium: { fontSize: '14px', lineHeight: '1.429', fontWeight: '500' },
  button: { fontSize: '12px', lineHeight: '1.667', fontWeight: '500', letterSpacing: '0.08em', textTransform: 'uppercase' as const },
} as const;

// ---------------------------------------------------------------------------
// Shadows
// ---------------------------------------------------------------------------

export const shadows = {
  card: '0px 3px 3px 0px rgba(34, 37, 41, 0.08)',
  dialog: '0px 3px 4px 0px rgba(34, 37, 41, 0.12)',
} as const;

// ---------------------------------------------------------------------------
// Border Radius
// ---------------------------------------------------------------------------

export const radii = {
  sm: '2px',
  md: '4px',
  lg: '8px',
  xl: '10px',
  full: '9999px',
} as const;

// ---------------------------------------------------------------------------
// Spacing (4px grid, common in design systems)
// ---------------------------------------------------------------------------

export const spacing = {
  px: '1px',
  0: '0px',
  0.5: '2px',
  1: '4px',
  1.5: '6px',
  2: '8px',
  2.5: '10px',
  3: '12px',
  4: '16px',
  5: '20px',
  6: '24px',
  8: '32px',
  10: '40px',
  12: '48px',
  16: '64px',
  20: '80px',
} as const;

// ---------------------------------------------------------------------------
// Component tokens — Button
// ---------------------------------------------------------------------------

export const buttonSizes = {
  sm: { height: '32px', paddingX: '12px', fontSize: '12px' },
  md: { height: '40px', paddingX: '16px', fontSize: '12px' },
  lg: { height: '48px', paddingX: '20px', fontSize: '12px' },
} as const;

export const buttonVariants = {
  primary: {
    bg: colors.green[500],
    bgHover: colors.green[600],
    text: colors.neutral.white,
    border: 'transparent',
  },
  secondary: {
    bg: colors.neutral.white,
    bgHover: colors.neutral[50],
    text: colors.neutral[800],
    border: colors.neutral[200],
  },
  danger: {
    bg: colors.red[500],
    bgHover: colors.red[600],
    text: colors.neutral.white,
    border: 'transparent',
  },
  invisible: {
    bg: 'transparent',
    bgHover: colors.neutral[50],
    text: colors.neutral[500],
    border: 'transparent',
  },
} as const;

// ---------------------------------------------------------------------------
// Component tokens — Modal
// ---------------------------------------------------------------------------

export const modalSizes = {
  sm: '480px',
  md: '640px',
  lg: '900px',
  fullscreen: '100%',
} as const;
