import React from 'react'

// Encabezado de página estándar del admin: acento a la izquierda que abarca
// título + subtítulo. `right` = acción opcional alineada a la derecha.
export default function PageHeader({ title, subtitle, right, style }: {
  title: React.ReactNode
  subtitle?: React.ReactNode
  right?: React.ReactNode
  style?: React.CSSProperties
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 24, ...style }}>
      <div style={{ borderLeft: 'var(--color-primary, #111) solid 3px', paddingLeft: 14 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: '#111', margin: 0, lineHeight: 1.2 }}>{title}</h1>
        {subtitle != null && subtitle !== false && (
          <div style={{ fontSize: 14, color: '#aaa', margin: '5px 0 0' }}>{subtitle}</div>
        )}
      </div>
      {right}
    </div>
  )
}
