import type { TenantTheme } from '@/types'
import type { CSSProperties } from 'react'

// Fallback si el tenant no tiene theme configurado (ver tenants.theme en schema.sql)
export const DEFAULT_THEME: TenantTheme = {
  primaryColor: '#111111',
  accentColor: '#f59e0b',
  fontHeading: 'system-ui, sans-serif',
  fontBody: 'system-ui, sans-serif',
  mapStyle: 'mapbox://styles/mapbox/streets-v12',
}

// ── Superficie "glass" compartida ──────────────────────────────
// Tarjeta translúcida con blur: se ve el degradado (o el scrim difuminado)
// detrás. Fuente única para unificar el look en todo el admin — dashboard,
// vCards, y donde se quiera. Cada lugar agrega su radius/padding.
export function glass(alpha = 0.72): CSSProperties {
  return {
    background: `rgba(255,255,255,${alpha})`,
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: '1px solid rgba(236,236,240,.85)',
  }
}
// Scrim claro y difuminado para modales glass: en vez del velo oscuro, un
// velo tenue + blur del fondo, así la tarjeta translúcida se lee clara.
export const glassScrim: CSSProperties = {
  background: 'rgba(17,19,24,.30)',
  backdropFilter: 'blur(3px)',
  WebkitBackdropFilter: 'blur(3px)',
}

// CSS variables que consumen los componentes admin (PageHeader, etc.)
// para que el superadmin pueda definir el theme por tenant sin tocar código.
export function themeCssVars(theme?: Partial<TenantTheme> | null): CSSProperties {
  const t = { ...DEFAULT_THEME, ...theme }
  return {
    '--color-primary': t.primaryColor,
    '--color-accent': t.accentColor,
    '--font-heading': t.fontHeading,
    '--font-body': t.fontBody,
  } as CSSProperties
}
