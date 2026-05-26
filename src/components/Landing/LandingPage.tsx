export default function LandingPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#fff', fontFamily: 'system-ui, sans-serif' }}>

      {/* Nav */}
      <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, padding: '0 32px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #1a1a1a', background: 'rgba(10,10,10,0.9)', backdropFilter: 'blur(12px)' }}>
        <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em' }}>
          Prop<span style={{ color: '#6b2fa0' }}>CLOUD</span>
        </div>
        <a href="mailto:hola@propcloud.app" style={{ fontSize: 13, color: '#888', textDecoration: 'none', border: '1px solid #2a2a2a', borderRadius: 8, padding: '8px 16px' }}>
          Contacto
        </a>
      </nav>

      {/* Hero */}
      <section style={{ paddingTop: 160, paddingBottom: 100, textAlign: 'center', padding: '160px 24px 100px' }}>
        <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.15em', textTransform: 'uppercase', color: '#6b2fa0', marginBottom: 20 }}>
          Plataforma multi-tenant para inmobiliarias
        </div>
        <h1 style={{ fontSize: 'clamp(36px, 6vw, 72px)', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.1, margin: '0 auto 24px', maxWidth: 800 }}>
          Tu inmobiliaria online,<br />
          <span style={{ color: '#6b2fa0' }}>lista en minutos</span>
        </h1>
        <p style={{ fontSize: 18, color: '#666', maxWidth: 520, margin: '0 auto 40px', lineHeight: 1.7 }}>
          PropCLOUD es la plataforma que le da a cada inmobiliaria su propio sitio web con mapa interactivo, listado de propiedades y panel de administración.
        </p>
        <a href="mailto:hola@propcloud.app" style={{ display: 'inline-block', background: '#6b2fa0', color: '#fff', textDecoration: 'none', borderRadius: 12, padding: '14px 32px', fontSize: 15, fontWeight: 600 }}>
          Solicitar demo
        </a>
      </section>

      {/* Features */}
      <section style={{ padding: '80px 24px', maxWidth: 1000, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 24 }}>
          {[
            { icon: '🗺️', title: 'Mapa interactivo', desc: 'Todas tus propiedades en un mapa con precios, filtros y fichas en popup.' },
            { icon: '🎨', title: 'Branding propio', desc: 'Colores, logo, tipografía y dominio personalizado para cada inmobiliaria.' },
            { icon: '⚡', title: 'Sin código', desc: 'Panel de administración completo. El cliente configura todo sin tocar código.' },
            { icon: '🔗', title: 'Múltiples fuentes', desc: 'Conecta con RE/MAX CCA, APIs externas o carga propiedades manualmente.' },
          ].map(f => (
            <div key={f.title} style={{ background: '#111', borderRadius: 16, padding: '28px 24px', border: '1px solid #1e1e1e' }}>
              <div style={{ fontSize: 32, marginBottom: 16 }}>{f.icon}</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#fff', marginBottom: 8 }}>{f.title}</div>
              <div style={{ fontSize: 14, color: '#666', lineHeight: 1.6 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid #1a1a1a', padding: '32px 24px', textAlign: 'center' }}>
        <div style={{ fontSize: 12, color: '#444' }}>
          © {new Date().getFullYear()} PropCLOUD · <a href="mailto:hola@propcloud.app" style={{ color: '#555', textDecoration: 'none' }}>hola@propcloud.app</a>
        </div>
      </footer>

    </div>
  )
}
