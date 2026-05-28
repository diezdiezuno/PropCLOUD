'use client'

import { useState } from 'react'
import { track } from '@/lib/gtag'

const BENEFITS = [
  {
    icon: '👑',
    title: 'Apoyo del Team Leader',
    desc: 'Acompañamiento directo del Team Leader en cada etapa: desde tu primera propiedad hasta cerrar ventas complejas. No estás solo.',
  },
  {
    icon: '🎓',
    title: 'Entrenamiento completo',
    desc: 'Desde cero hasta tu primera venta. Técnicas de negociación, manejo de clientes y todas las herramientas REMAX.',
  },
  {
    icon: '💰',
    title: 'Ingresos sin techo',
    desc: 'Comisiones sin límite. El mercado está activo todo el año. Vos decidís cuánto querés ganar.',
  },
  {
    icon: '🌍',
    title: 'Marca mundial REMAX',
    desc: 'Credibilidad y captación de clientes desde el primer día con el respaldo de la red internacional REMAX.',
  },
]

const ZONES_EAST = [
  'Montes de Oca / San Pedro',
  'Goicoechea / Guadalupe',
  'Moravia',
  'Tibás',
  'Curridabat',
  'Tres Ríos / La Unión',
  'Desamparados',
  'Cartago centro',
  'El Guarco / Tejar',
  'Paraíso / Oreamuno',
  'San Diego / San Juan',
  'Otra zona del este',
]
const ZONES_GAM = [
  'San José centro',
  'Escazú / Santa Ana',
  'La Uruca / Pavas',
  'Heredia',
  'Alajuela',
  'Otra zona',
]

export default function ReclutamientoClient() {
  const [nombre,     setNombre]     = useState('')
  const [apellido,   setApellido]   = useState('')
  const [telefono,   setTelefono]   = useState('')
  const [email,      setEmail]      = useState('')
  const [zona,       setZona]       = useState('')
  const [perfil,     setPerfil]     = useState('')
  const [ocupacion,  setOcupacion]  = useState('')
  const [motivacion, setMotivacion] = useState('')
  const [cvLink,     setCvLink]     = useState('')
  const [linkedin,   setLinkedin]   = useState('')

  const [sending, setSending] = useState(false)
  const [sent,    setSent]    = useState(false)
  const [error,   setError]   = useState('')

  const canSubmit = nombre.trim() && apellido.trim() && email.trim() && telefono.trim() && zona && perfil

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setSending(true)
    setError('')
    track('contact_form_submit', { source: 'reclutamiento', perfil })

    try {
      const res = await fetch('/api/recruit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, apellido, telefono, email, zona, perfil, ocupacion, motivacion, cv_link: cvLink, linkedin }),
      })
      if (!res.ok) throw new Error('error')
      setSent(true)
    } catch {
      setError('Hubo un error al enviar. Por favor intentá de nuevo.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div style={{ paddingTop: 'var(--nav-h,68px)', fontFamily: 'var(--font-body,system-ui,sans-serif)' }}>

      {/* ── HERO ────────────────────────────────────────────────── */}
      <section style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'flex-start', justifyContent: 'center',
        padding: 'clamp(80px,10vw,120px) clamp(24px,6vw,80px)',
        maxWidth: 1100, margin: '0 auto',
      }}>
        {/* Badge */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          border: '1px solid #e8e4df', borderRadius: 100,
          padding: '6px 16px', fontSize: 12, fontWeight: 500,
          letterSpacing: '.1em', textTransform: 'uppercase',
          color: '#888480', marginBottom: 36,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--primary,#6b2fa0)', display: 'inline-block' }} />
          REMAX Central · GAM · Costa Rica
        </div>

        {/* Headline */}
        <h1 style={{
          fontFamily: 'var(--font-heading,serif)',
          fontSize: 'clamp(52px,8.5vw,92px)',
          fontWeight: 900, lineHeight: .93,
          letterSpacing: '-.03em', marginBottom: 32, maxWidth: 700,
        }}>
          Tu carrera<br />en{' '}
          <span style={{
            background: 'linear-gradient(90deg,var(--primary,#6b2fa0),#D44E2A,#E8920A)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>
            bienes<br />raíces
          </span>
          <br />empieza aquí.
        </h1>

        {/* Subtitle */}
        <p style={{
          fontSize: 'clamp(16px,2vw,20px)', fontWeight: 300,
          color: '#888480', maxWidth: 500, lineHeight: 1.65, marginBottom: 44,
        }}>
          Únete a <strong style={{ fontWeight: 500, color: '#111' }}>TEAM SUNRISE | REMAX Central</strong> — el equipo especializado en el este de San José, en la oficina más grande y con más experiencia del GAM.
        </p>

        {/* CTAs */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 72 }}>
          <a href="#aplicar" style={{
            background: '#111', color: '#fff',
            fontSize: 15, fontWeight: 500,
            padding: '16px 36px', borderRadius: 100,
            textDecoration: 'none', display: 'inline-block',
          }}>
            Quiero unirme
          </a>
          <a href="#beneficios" style={{
            background: 'transparent', color: '#111',
            fontSize: 15, fontWeight: 400,
            padding: '16px 36px', borderRadius: 100,
            border: '1.5px solid #e8e4df',
            textDecoration: 'none', display: 'inline-block',
          }}>
            Conocé más
          </a>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: 48, flexWrap: 'wrap' }}>
          {[
            { num: '+30',  label: 'Agentes activos' },
            { num: '#1',   label: 'Oficina en el GAM' },
            { num: '100%', label: 'Apoyo y entrenamiento' },
          ].map(({ num, label }) => (
            <div key={label}>
              <div style={{
                fontFamily: 'var(--font-heading,serif)',
                fontSize: 42, fontWeight: 700, lineHeight: 1,
                letterSpacing: '-.02em', color: '#111',
              }}>{num}</div>
              <div style={{
                fontSize: 12, color: '#888480',
                textTransform: 'uppercase', letterSpacing: '.08em', marginTop: 6,
              }}>{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── BENEFICIOS ──────────────────────────────────────────── */}
      <section id="beneficios" style={{
        padding: 'clamp(70px,8vw,100px) clamp(24px,6vw,80px)',
        maxWidth: 1100, margin: '0 auto',
        borderTop: '1px solid #e8e4df',
      }}>
        <p style={{ fontSize: 11, fontWeight: 500, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--primary,#6b2fa0)', marginBottom: 14 }}>
          Por qué TEAM SUNRISE | REMAX Central
        </p>
        <h2 style={{
          fontFamily: 'var(--font-heading,serif)',
          fontSize: 'clamp(28px,4vw,46px)', fontWeight: 700,
          lineHeight: 1.1, letterSpacing: '-.02em',
          marginBottom: 52, maxWidth: 540,
        }}>
          Todo el respaldo que necesitás para vender y crecer.
        </h2>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(2,1fr)',
          gap: 1, background: '#e8e4df',
          border: '1px solid #e8e4df', borderRadius: 20, overflow: 'hidden',
        }}>
          {BENEFITS.map(({ icon, title, desc }) => (
            <div key={title} style={{ background: '#fff', padding: '36px 32px' }}>
              <span style={{ fontSize: 28, marginBottom: 18, display: 'block' }}>{icon}</span>
              <div style={{
                fontFamily: 'var(--font-heading,serif)',
                fontSize: 18, fontWeight: 700, marginBottom: 10, letterSpacing: '-.01em',
              }}>{title}</div>
              <p style={{ fontSize: 14, color: '#888480', lineHeight: 1.7, margin: 0 }}>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── PERFILES ────────────────────────────────────────────── */}
      <section id="perfiles" style={{
        padding: 'clamp(70px,8vw,100px) clamp(24px,6vw,80px)',
        maxWidth: 1100, margin: '0 auto',
        borderTop: '1px solid #e8e4df',
      }}>
        <p style={{ fontSize: 11, fontWeight: 500, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--primary,#6b2fa0)', marginBottom: 14 }}>
          ¿Para quién es esto?
        </p>
        <h2 style={{
          fontFamily: 'var(--font-heading,serif)',
          fontSize: 'clamp(28px,4vw,46px)', fontWeight: 700,
          lineHeight: 1.1, letterSpacing: '-.02em',
          marginBottom: 52, maxWidth: 560,
        }}>
          Buscamos agentes del este de San José y zonas aledañas.
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

          {/* Featured — sin experiencia */}
          <div style={{ background: '#111', borderRadius: 20, padding: '40px 36px', color: '#fff' }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center',
              fontSize: 11, fontWeight: 500, letterSpacing: '.1em', textTransform: 'uppercase',
              padding: '5px 12px', borderRadius: 100, marginBottom: 20,
              background: 'rgba(232,146,10,.15)', color: '#E8920A',
              border: '1px solid rgba(232,146,10,.25)',
            }}>Sin experiencia</span>
            <h3 style={{ fontFamily: 'var(--font-heading,serif)', fontSize: 26, fontWeight: 700, marginBottom: 14, lineHeight: 1.2, letterSpacing: '-.02em' }}>
              Nuevo en bienes raíces
            </h3>
            <p style={{ fontSize: 15, color: 'rgba(255,255,255,.5)', lineHeight: 1.65, marginBottom: 24 }}>
              No necesitás saber nada del sector. Con el apoyo del Team Leader y el Broker, te enseñamos todo desde el principio.
            </p>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10, padding: 0, margin: 0 }}>
              {[
                'Personas que quieren cambiar de carrera',
                'Profesionales que buscan independencia económica',
                'Estudiantes o recién graduados con ambición',
                'Emprendedores que buscan nuevas fuentes de ingresos',
              ].map(item => (
                <li key={item} style={{ fontSize: 14, color: 'rgba(255,255,255,.55)', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <span style={{ color: '#E8920A', flexShrink: 0 }}>→</span>{item}
                </li>
              ))}
            </ul>
          </div>

          {/* Con experiencia */}
          <div style={{ border: '1.5px solid #e8e4df', borderRadius: 20, padding: '40px 36px', background: '#fff' }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center',
              fontSize: 11, fontWeight: 500, letterSpacing: '.1em', textTransform: 'uppercase',
              padding: '5px 12px', borderRadius: 100, marginBottom: 20,
              background: 'rgba(107,63,160,.08)', color: 'var(--primary,#6b2fa0)',
              border: '1px solid rgba(107,63,160,.18)',
            }}>Con experiencia</span>
            <h3 style={{ fontFamily: 'var(--font-heading,serif)', fontSize: 26, fontWeight: 700, marginBottom: 14, lineHeight: 1.2, letterSpacing: '-.02em', color: '#111' }}>
              Agente inmobiliario activo
            </h3>
            <p style={{ fontSize: 15, color: '#888480', lineHeight: 1.65, marginBottom: 24 }}>
              Ya trabajás en el sector y querés el respaldo de un team líder especializado en tu misma zona.
            </p>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10, padding: 0, margin: 0 }}>
              {[
                'Agentes del este de San José y zonas aledañas',
                'Independientes que quieren crecer con equipo y oficina',
                'Agentes de otras franquicias que buscan más resultados',
                'Profesionales con cartera de clientes propia',
              ].map(item => (
                <li key={item} style={{ fontSize: 14, color: '#888480', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <span style={{ color: 'var(--primary,#6b2fa0)', flexShrink: 0 }}>→</span>{item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── FORMULARIO ──────────────────────────────────────────── */}
      <section id="aplicar" style={{
        padding: 'clamp(70px,8vw,100px) 24px clamp(80px,10vw,120px)',
        maxWidth: 740, margin: '0 auto',
        borderTop: '1px solid #e8e4df',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 52 }}>
          <p style={{ fontSize: 11, fontWeight: 500, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--primary,#6b2fa0)', marginBottom: 14 }}>
            Aplicá ahora
          </p>
          <h2 style={{
            fontFamily: 'var(--font-heading,serif)',
            fontSize: 'clamp(28px,4vw,46px)', fontWeight: 700,
            letterSpacing: '-.02em', marginBottom: 14, lineHeight: 1.1,
          }}>
            Da el primer paso hoy.
          </h2>
          <p style={{ fontSize: 17, color: '#888480', lineHeight: 1.6, maxWidth: 480, margin: '0 auto' }}>
            Llenás el formulario, el Team Leader te contacta personalmente y conversamos sin ningún compromiso.
          </p>
        </div>

        {sent ? (
          <div style={{
            background: '#f7f6f4', border: '1px solid #e8e4df',
            borderRadius: 24, padding: 'clamp(40px,6vw,60px)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', textAlign: 'center', gap: 18,
          }}>
            <div style={{
              width: 68, height: 68, borderRadius: '50%',
              background: '#fff', border: '1.5px solid #e8e4df',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 32,
            }}>🌅</div>
            <h3 style={{ fontFamily: 'var(--font-heading,serif)', fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>
              ¡Aplicación recibida!
            </h3>
            <p style={{ fontSize: 15, color: '#888480', maxWidth: 380, lineHeight: 1.65, margin: 0 }}>
              Gracias por tu interés en TEAM SUNRISE. El Team Leader te contactará en las próximas 24 horas.
            </p>
          </div>
        ) : (
          <form onSubmit={submit} style={{
            background: '#f7f6f4', border: '1px solid #e8e4df',
            borderRadius: 24, padding: 'clamp(32px,5vw,52px) clamp(24px,5vw,48px)',
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>

              <FInp label="Nombre *"   value={nombre}   onChange={setNombre}   placeholder="Tu nombre" />
              <FInp label="Apellido *" value={apellido} onChange={setApellido} placeholder="Tu apellido" />

              <FInp label="WhatsApp / Teléfono *" value={telefono} onChange={setTelefono} placeholder="+506 8888 8888" type="tel" />
              <FInp label="Correo electrónico *"  value={email}    onChange={setEmail}    placeholder="tu@correo.com"   type="email" />

              {/* Zona */}
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelSt}>Zona donde vivís *</label>
                <select value={zona} onChange={e => setZona(e.target.value)} style={inpSt} required>
                  <option value="" disabled>Seleccioná tu zona</option>
                  <optgroup label="Este de San José (zona principal)">
                    {ZONES_EAST.map(z => <option key={z} value={z}>{z}</option>)}
                  </optgroup>
                  <optgroup label="Otras zonas del GAM">
                    {ZONES_GAM.map(z => <option key={z} value={z}>{z}</option>)}
                  </optgroup>
                </select>
              </div>

              {/* Perfil */}
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelSt}>¿Cuál es tu perfil? *</label>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {[
                    { value: 'nuevo',       label: 'Nuevo en bienes raíces' },
                    { value: 'experiencia', label: 'Agente con experiencia' },
                    { value: 'otro',        label: 'Explorando opciones' },
                  ].map(opt => (
                    <label key={opt.value} style={{
                      flex: 1, minWidth: 130, textAlign: 'center',
                      padding: '12px 14px', cursor: 'pointer',
                      border: `1.5px solid ${perfil === opt.value ? '#111' : '#e8e4df'}`,
                      borderRadius: 12,
                      fontSize: 13, fontWeight: perfil === opt.value ? 500 : 400,
                      color: perfil === opt.value ? '#111' : '#888480',
                      background: '#fff',
                      letterSpacing: '.01em', textTransform: 'none',
                      display: 'block',
                    }}>
                      <input
                        type="radio" name="perfil" value={opt.value}
                        checked={perfil === opt.value}
                        onChange={() => setPerfil(opt.value)}
                        style={{ display: 'none' }}
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </div>

              {/* Ocupación */}
              <div style={{ gridColumn: '1 / -1' }}>
                <FInp label="¿A qué te dedicás actualmente?" value={ocupacion} onChange={setOcupacion} placeholder="Ej: vendedor, administrador, estudiante..." />
              </div>

              {/* Motivación */}
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelSt}>¿Por qué te interesa el mundo inmobiliario?</label>
                <textarea
                  value={motivacion}
                  onChange={e => setMotivacion(e.target.value)}
                  placeholder="Contanos un poco sobre tus motivaciones..."
                  rows={4}
                  style={{ ...inpSt, resize: 'vertical', lineHeight: 1.6, minHeight: 108 }}
                />
              </div>

              {/* CV link */}
              <div style={{ gridColumn: '1 / -1' }}>
                <FInp
                  label="Link de tu CV (opcional · Google Drive, Dropbox, etc.)"
                  value={cvLink} onChange={setCvLink}
                  placeholder="https://drive.google.com/..."
                  type="url"
                />
              </div>

              {/* LinkedIn */}
              <div style={{ gridColumn: '1 / -1' }}>
                <FInp
                  label="Perfil de LinkedIn (opcional)"
                  value={linkedin} onChange={setLinkedin}
                  placeholder="https://linkedin.com/in/tu-perfil"
                  type="url"
                />
              </div>

              {/* Divider */}
              <div style={{ gridColumn: '1 / -1', height: 1, background: '#e8e4df', margin: '8px 0' }} />

              {/* Submit */}
              <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
                {error && <p style={{ fontSize: 13, color: '#e53e3e', margin: 0 }}>{error}</p>}
                <button
                  type="submit"
                  disabled={sending || !canSubmit}
                  style={{
                    width: '100%', background: '#111', color: '#fff',
                    fontSize: 16, fontWeight: 500,
                    padding: 18, borderRadius: 100, border: 'none',
                    cursor: (sending || !canSubmit) ? 'not-allowed' : 'pointer',
                    opacity: (sending || !canSubmit) ? 0.6 : 1,
                    fontFamily: 'inherit', letterSpacing: '.02em',
                  }}
                >
                  {sending ? 'Enviando…' : 'Enviar mi aplicación →'}
                </button>
                <p style={{ fontSize: 12, color: '#888480', textAlign: 'center', lineHeight: 1.6, margin: 0 }}>
                  Tu información es confidencial. Te contactaremos pronto.
                </p>
              </div>
            </div>
          </form>
        )}
      </section>
    </div>
  )
}

/* ── Sub-components ─────────────────────────────────────── */

function FInp({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string
}) {
  return (
    <div>
      <label style={labelSt}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={inpSt} />
    </div>
  )
}

const labelSt: React.CSSProperties = {
  fontSize: 11, fontWeight: 500, letterSpacing: '.1em',
  textTransform: 'uppercase', color: '#888480',
  display: 'block', marginBottom: 7,
}

const inpSt: React.CSSProperties = {
  background: '#fff', border: '1.5px solid #e8e4df', borderRadius: 12,
  padding: '13px 16px', fontFamily: 'inherit',
  fontSize: 15, fontWeight: 300, color: '#111',
  outline: 'none', width: '100%', boxSizing: 'border-box',
  WebkitAppearance: 'none',
}
