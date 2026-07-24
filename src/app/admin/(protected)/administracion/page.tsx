'use client'
import PageHeader from '@/components/admin/PageHeader'

// Hub de Administración: agrupa la configuración del sitio, ajustes del CRM,
// gestión de oficina (Noduus admin), métricas y reclutamiento — para no
// saturar el sidebar con todo lo administrativo.

const card: React.CSSProperties = {
  background: '#fff', border: '1px solid #ececf0', borderRadius: 14, padding: '18px 20px',
  textDecoration: 'none', color: '#111', display: 'block',
}
const titleRow: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8 }
const desc: React.CSSProperties = { fontSize: 12.5, color: '#8a909b', margin: 0, lineHeight: 1.55 }

function Card({ href, icon, title, children }: { href: string; icon: string; title: string; children: React.ReactNode }) {
  return (
    <a href={href} style={card}
      onMouseEnter={e => (e.currentTarget.style.borderColor = '#d5d9e0')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = '#ececf0')}>
      <div style={titleRow}><span style={{ fontSize: 20 }}>{icon}</span><span style={{ fontWeight: 600, fontSize: 15 }}>{title}</span></div>
      {children}
    </a>
  )
}

const SITIO = [
  ['General', '/admin/general'], ['Mapa', '/admin/mapa'], ['Visualización', '/admin/visualizacion'],
  ['Páginas', '/admin/paginas'], ['Fuentes', '/admin/fuentes'], ['Agentes', '/admin/agentes'], ['SEO', '/admin/seo'],
]

export default function AdministracionPage() {
  return (
    <>
      <PageHeader title={<>Administración</>} subtitle={<>Configuración del sitio, CRM y gestión de la oficina.</>} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
        {/* Sitio web — ancho completo con chips a sus secciones */}
        <a href="/admin/general" style={{ ...card, gridColumn: '1 / -1' }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = '#d5d9e0')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = '#ececf0')}>
          <div style={titleRow}><span style={{ fontSize: 20 }}>🌐</span><span style={{ fontWeight: 600, fontSize: 15 }}>Sitio web</span></div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            {SITIO.map(([label, href]) => (
              <a key={href} href={href} onClick={e => e.stopPropagation()}
                style={{ fontSize: 12, background: '#f7f8fa', border: '1px solid #edeef1', borderRadius: 8, padding: '4px 10px', color: '#555', textDecoration: 'none' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#eef0f3'; e.currentTarget.style.color = '#111' }}
                onMouseLeave={e => { e.currentTarget.style.background = '#f7f8fa'; e.currentTarget.style.color = '#555' }}>
                {label}
              </a>
            ))}
          </div>
        </a>

        <Card href="/admin/crm-config" icon="⚙️" title="Configuración CRM">
          <p style={desc}>Tipos y fuentes de contacto, orden y opciones del CRM.</p>
        </Card>
        <Card href="/admin/tools/admin?tab=agentes" icon="👥" title="Agentes">
          <p style={desc}>Agentes activos e invitaciones de la oficina.</p>
        </Card>
        <Card href="/admin/tools/admin?tab=equipos" icon="📦" title="Equipos de oficina">
          <p style={desc}>Inventario de equipos compartidos.</p>
        </Card>
        <Card href="/admin/tools/admin?tab=calendario" icon="📅" title="Calendario">
          <p style={desc}>Calendarios de la oficina.</p>
        </Card>
        <Card href="/admin/tools/admin?tab=materiales" icon="🗂️" title="Materiales">
          <p style={desc}>Materiales guardados de los agentes.</p>
        </Card>
        <Card href="/admin/metricas" icon="📊" title="Métricas">
          <p style={desc}>Analíticas de tráfico y desempeño del sitio.</p>
        </Card>
        <Card href="/admin/reclutamiento" icon="🤝" title="Reclutamiento">
          <p style={desc}>Aplicaciones de agentes y notas.</p>
        </Card>
        <Card href="/admin/contratos" icon="📄" title="Contratos">
          <p style={desc}>Los tipos de contrato y el texto fijo de cada uno.</p>
        </Card>
        <Card href="/admin/bitacora" icon="🗂️" title="Bitácora">
          <p style={desc}>Qué fichas creó cada agente que ya salió de la oficina.</p>
        </Card>
        <Card href="/admin/auditoria" icon="🔍" title="Auditoría">
          <p style={desc}>Cada cambio en el CRM, los permisos y el sitio: quién y cuándo.</p>
        </Card>
      </div>
    </>
  )
}
