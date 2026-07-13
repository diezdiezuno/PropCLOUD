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
