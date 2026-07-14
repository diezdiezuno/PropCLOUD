import type { ReactNode, CSSProperties } from 'react'

// Íconos de línea compartidos (reemplazan emojis en todo el admin).
// Uso: <Icon name="mail" size={16} color="#1B6EF3" />
const PATHS = {
  idCard:     <><rect x="2" y="5" width="20" height="14" rx="2" /><circle cx="8" cy="12" r="2" /><line x1="13" y1="10" x2="18" y2="10" /><line x1="13" y1="14" x2="18" y2="14" /></>,
  cake:       <><path d="M4 21h16v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2Z" /><path d="M4 16c1.5 0 1.5 1.2 3 1.2S9.5 16 11 16s1.5 1.2 3 1.2S16.5 16 18 16s1.5 1.2 2 1.2" /><line x1="8" y1="5" x2="8" y2="8" /><line x1="12" y1="4" x2="12" y2="8" /><line x1="16" y1="5" x2="16" y2="8" /></>,
  smartphone: <><rect x="6" y="2" width="12" height="20" rx="2" /><line x1="11" y1="18" x2="13" y2="18" /></>,
  phone:      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3A19.5 19.5 0 0 1 5.2 13 19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.8a2 2 0 0 1-.4 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.9.6 2.8.7a2 2 0 0 1 1.7 2Z" />,
  message:    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
  mail:       <><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m2 6 10 7 10-7" /></>,
  building:   <><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" /><path d="M10 6h4M10 10h4M10 14h4M10 18h4" /></>,
  home:       <><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><path d="M9 22V12h6v10" /></>,
  broadcast:  <><path d="M4 11a9 9 0 0 1 9 9" /><path d="M4 4a16 16 0 0 1 16 16" /><circle cx="5" cy="19" r="1" /></>,
  file:       <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></>,
  image:      <><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.5-3.5L9 20" /></>,
  camera:     <><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" /><circle cx="12" cy="13" r="3" /></>,
  user:       <><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>,
  users:      <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>,
  search:     <><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></>,
  lightbulb:  <><path d="M9 18h6" /><path d="M10 22h4" /><path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1V17h6v-.2c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2Z" /></>,
} as const

export type IconName = keyof typeof PATHS

export function Icon({ name, size = 16, color, style }: { name: IconName; size?: number; color?: string; style?: CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color ?? 'currentColor'}
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, display: 'block', ...style }}>
      {PATHS[name] as ReactNode}
    </svg>
  )
}
